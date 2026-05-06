"""High level pipeline orchestrating insurer crawling, product discovery, and data persistence."""
from __future__ import annotations

import csv
import hashlib
import json
import argparse
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List, Optional

import requests

from . import insurer_crawler
from .database import InsuranceRepository
from .document_processing import DocumentProcessor, DocumentProcessorConfig, PolicyNormalizer
from .models import Insurer, Product, ProductDocument
from .product_crawler import InsurerProductCrawler, ProductCrawlerConfig

LOGGER = logging.getLogger(__name__)

_INSURER_DIR_MAX_AGE_HOURS = 24


@dataclass
class PipelineConfig:
    """Configuration options for the end-to-end pipeline."""

    data_dir: Path = Path("data")
    db_path: Path = Path("data") / "insurance.db"
    document_dir: Path = Path("data") / "documents"
    download_documents: bool = True
    max_insurers: Optional[int] = None
    max_pages_per_insurer: int = 80
    max_depth: int = 3
    resume: bool = True          # skip insurers already in DB; False to re-crawl all
    max_download_attempts: int = 3


class InsuranceDataPipeline:
    """Coordinates all stages from crawling IRDAI listings to storing normalized data."""

    def __init__(self, config: PipelineConfig) -> None:
        self.config = config
        self.config.data_dir.mkdir(parents=True, exist_ok=True)
        self.config.document_dir.mkdir(parents=True, exist_ok=True)

        self.repository = InsuranceRepository(self.config.db_path)

        # Stage 1: crawl with download disabled — discover URLs only
        document_processor_config = DocumentProcessorConfig(
            base_dir=self.config.document_dir,
            download_documents=False,
        )
        document_processor = DocumentProcessor(document_processor_config)
        crawler_config = ProductCrawlerConfig(
            max_pages_per_insurer=self.config.max_pages_per_insurer,
            max_depth=self.config.max_depth,
            download_documents=False,
        )
        self.product_crawler = InsurerProductCrawler(
            config=crawler_config,
            document_processor=document_processor,
            policy_normalizer=PolicyNormalizer(),
        )

        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
            )
        })

    # ── Public entry point ─────────────────────────────────────────────────────

    def run(self) -> None:
        """Execute the incremental 3-stage pipeline."""
        LOGGER.info("Initializing repository at %s", self.config.db_path)
        self.repository.initialize()

        # ── Stage 1: Crawl (link + metadata discovery, no downloads) ──────────
        insurers = self._load_or_crawl_insurer_directory()
        if self.config.max_insurers is not None:
            insurers = insurers[: self.config.max_insurers]

        self.repository.upsert_insurers(insurers)

        document_mappings: List[dict[str, str]] = []

        for index, insurer in enumerate(insurers, start=1):
            if self.config.resume and self.repository.insurer_has_products(insurer.insurer_id):
                LOGGER.info(
                    "SKIP [%d/%d] %s — already crawled", index, len(insurers), insurer.name
                )
                continue

            LOGGER.info("CRAWL [%d/%d] %s", index, len(insurers), insurer.name)
            result = self.product_crawler.crawl_insurer(insurer)

            product_lookup = {p.product_id: p for p in result.products}
            self.repository.upsert_products(result.products)
            self.repository.upsert_documents(result.documents)
            self.repository.upsert_policy_sections(
                [s for p in result.products for s in p.policy_sections]
            )

            LOGGER.info(
                "Captured %d products and %d documents for %s",
                len(result.products),
                len(result.documents),
                insurer.name,
            )
            document_mappings.extend(
                self._build_document_mappings(insurer.name, product_lookup, result.documents)
            )

        # ── Stage 2: Download (idempotent, deduped by source_url) ─────────────
        if self.config.download_documents:
            self._run_downloads()

        # ── Stage 3: Persist output artefacts ─────────────────────────────────
        if document_mappings:
            self._persist_document_mappings(document_mappings)
        self._persist_download_queue(self.repository.get_documents_pending_download())

    # ── Stage helpers ──────────────────────────────────────────────────────────

    def _load_or_crawl_insurer_directory(self) -> List[Insurer]:
        """Return insurers from cache if fresh (<24 h), otherwise re-fetch from IRDAI."""
        insurer_json = self.config.data_dir / "insurers.json"
        if insurer_json.exists():
            try:
                data = json.loads(insurer_json.read_text(encoding="utf-8"))
                crawled_at = datetime.fromisoformat(data["crawled_at"])
                age_hours = (
                    datetime.now(timezone.utc) - crawled_at
                ).total_seconds() / 3600
                if age_hours < _INSURER_DIR_MAX_AGE_HOURS:
                    LOGGER.info(
                        "Using cached insurer directory (%.1f h old, limit %d h)",
                        age_hours,
                        _INSURER_DIR_MAX_AGE_HOURS,
                    )
                    return [
                        Insurer.from_normalized_row(r, source_url=r.get("source_url", ""))
                        for r in data["records"]
                    ]
            except Exception as exc:
                LOGGER.warning("Could not read cached insurer directory: %s", exc)

        LOGGER.info("Fetching insurer directory from IRDAI")
        return self._crawl_insurer_directory()

    def _run_downloads(self) -> None:
        """Stage 2: download all pending documents, deduping by source URL."""
        pending = self.repository.get_documents_pending_download(
            max_attempts=self.config.max_download_attempts
        )
        LOGGER.info("Stage 2: %d documents pending download", len(pending))
        for doc in pending:
            self._download_document(doc)

    def _download_document(self, doc: dict) -> None:
        """Download one document, reusing an already-fetched file if the URL was seen before."""
        source_url = doc["source_url"]
        document_id = doc["document_id"]
        attempts = (doc.get("fetch_attempts") or 0) + 1

        # Dedup: same URL already downloaded by a different document_id
        existing = self.repository.get_downloaded_by_url(source_url)
        if existing:
            LOGGER.info("DEDUP %s — reusing %s", source_url, existing["local_path"])
            self.repository.update_document_on_success(
                document_id,
                Path(existing["local_path"]),
                existing["content_hash"],
            )
            return

        # File already on disk (pipeline restarted mid-run)
        local_path_str = doc.get("local_path")
        if local_path_str and Path(local_path_str).exists():
            LOGGER.info("SKIP %s — file already on disk", source_url)
            self.repository.update_document_fetch_status(document_id, "success", attempts)
            return

        # Fetch
        local_path = self.config.document_dir / f"{document_id}.pdf"
        try:
            response = self._session.get(source_url, timeout=30, stream=True)
            response.raise_for_status()
            content = response.content
            content_hash = hashlib.sha256(content).hexdigest()
            local_path.write_bytes(content)
            self.repository.update_document_on_success(document_id, local_path, content_hash)
            LOGGER.info("DOWNLOADED %s → %s", source_url, local_path.name)
        except Exception as exc:
            LOGGER.warning("FAILED %s (attempt %d): %s", source_url, attempts, exc)
            self.repository.update_document_fetch_status(document_id, "error", attempts)

    def _crawl_insurer_directory(self) -> List[Insurer]:
        aggregated_rows = []
        for category in insurer_crawler.CATEGORIES:
            html = insurer_crawler.fetch_html(category.url)
            headers, raw_rows = insurer_crawler.parse_table(html, category.table_id)
            normalized_rows = insurer_crawler.build_normalized_rows(category, raw_rows)
            insurer_crawler.persist_category_data(
                self.config.data_dir, category, headers, raw_rows, normalized_rows
            )
            aggregated_rows.extend(normalized_rows)

        dataset = {
            "crawled_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "record_count": len(aggregated_rows),
            "records": aggregated_rows,
            "categories": [category.key for category in insurer_crawler.CATEGORIES],
        }
        insurer_crawler.write_json(self.config.data_dir / "insurers.json", dataset)
        headers = sorted({key for row in aggregated_rows for key in row.keys()})
        insurer_crawler.write_csv(self.config.data_dir / "insurers.csv", headers, aggregated_rows)

        insurers = [
            Insurer.from_normalized_row(row, source_url=row.get("source_url", ""))
            for row in aggregated_rows
        ]
        return insurers

    def _build_document_mappings(
        self,
        insurer_name: str,
        products: dict[str, Product],
        documents: Iterable[ProductDocument],
    ) -> List[dict[str, str]]:
        mappings: List[dict[str, str]] = []
        for document in documents:
            if document.document_type not in {"policy_wording", "brochure"}:
                continue
            product_id = document.product_id
            if not product_id:
                continue
            product = products.get(product_id)
            record = {
                "insurer_id": document.insurer_id,
                "insurer_name": insurer_name,
                "product_id": product_id,
                "product_name": product.name if product else "",
                "document_id": document.document_id,
                "document_type": document.document_type,
                "source_url": document.source_url,
                "local_path": str(document.local_path) if document.local_path else "",
                "anchor_text": document.metadata.get("anchor_text", ""),
                "discovered_from_url": document.metadata.get("page_url", ""),
                "discovery_method": document.metadata.get("discovery_method", ""),
            }
            mappings.append(record)
        return mappings

    def _persist_document_mappings(self, mappings: List[dict[str, str]]) -> None:
        if not mappings:
            LOGGER.info("No policy wording or brochure mappings to persist.")
            return

        output_dir = self.config.data_dir
        output_dir.mkdir(parents=True, exist_ok=True)

        json_path = output_dir / "product_document_mappings.json"
        csv_path = output_dir / "product_document_mappings.csv"

        json_payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "record_count": len(mappings),
            "records": mappings,
        }

        json_path.write_text(json.dumps(json_payload, ensure_ascii=False, indent=2), encoding="utf-8")

        headers = sorted({key for mapping in mappings for key in mapping.keys()})
        with csv_path.open("w", encoding="utf-8", newline="") as fp:
            writer = csv.DictWriter(fp, fieldnames=headers)
            writer.writeheader()
            for mapping in mappings:
                writer.writerow(mapping)

        LOGGER.info(
            "Persisted %d product document mappings to %s and %s",
            len(mappings),
            json_path,
            csv_path,
        )

    def _persist_download_queue(self, queue: List[dict]) -> None:
        """Write remaining pending downloads to JSON for external inspection."""
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "document_count": len(queue),
            "documents": [
                {k: v for k, v in doc.items() if k != "extracted_text"}
                for doc in queue
            ],
        }
        output_path = self.config.data_dir / "document_download_queue.json"
        output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        LOGGER.info(
            "Recorded %d pending document downloads to %s",
            len(queue),
            output_path,
        )


def parse_args(argv: Optional[Iterable[str]] = None) -> PipelineConfig:
    parser = argparse.ArgumentParser(description="Run the insurance data ingestion pipeline.")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("data"),
        help="Directory to store intermediate crawl artifacts.",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=Path("data") / "insurance.db",
        help="SQLite database path.",
    )
    parser.add_argument(
        "--documents-dir",
        type=Path,
        default=Path("data") / "documents",
        help="Directory to store downloaded documents.",
    )
    parser.add_argument(
        "--no-download-documents",
        action="store_true",
        help="Skip downloading policy documents; metadata is still collected.",
    )
    parser.add_argument(
        "--max-insurers",
        type=int,
        default=None,
        help="Limit the number of insurers to process.",
    )
    parser.add_argument(
        "--max-pages-per-insurer",
        type=int,
        default=80,
        help="Limit the number of pages to crawl per insurer website.",
    )
    parser.add_argument(
        "--max-depth",
        type=int,
        default=3,
        help="Maximum depth for website crawl breadth-first search.",
    )
    parser.add_argument(
        "--no-resume",
        action="store_true",
        help="Re-crawl all insurers even if they already have products in the database.",
    )
    parser.add_argument(
        "--max-download-attempts",
        type=int,
        default=3,
        help="Maximum download retries per document before giving up.",
    )
    args = parser.parse_args(argv)

    return PipelineConfig(
        data_dir=args.data_dir,
        db_path=args.db,
        document_dir=args.documents_dir,
        download_documents=not args.no_download_documents,
        max_insurers=args.max_insurers,
        max_pages_per_insurer=args.max_pages_per_insurer,
        max_depth=args.max_depth,
        resume=not args.no_resume,
        max_download_attempts=args.max_download_attempts,
    )


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    config = parse_args()
    pipeline = InsuranceDataPipeline(config)
    pipeline.run()


if __name__ == "__main__":
    main()
