"""High level pipeline orchestrating insurer crawling, product discovery, and data persistence."""
from __future__ import annotations

import csv
import json
import argparse
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List, Optional

from . import insurer_crawler
from .database import InsuranceRepository
from .document_processing import DocumentProcessor, DocumentProcessorConfig, PolicyNormalizer
from .models import Insurer, Product, ProductDocument
from .product_crawler import InsurerProductCrawler, ProductCrawlerConfig

LOGGER = logging.getLogger(__name__)


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


class InsuranceDataPipeline:
    """Coordinates all stages from crawling IRDAI listings to storing normalized data."""

    def __init__(self, config: PipelineConfig) -> None:
        self.config = config
        self.config.data_dir.mkdir(parents=True, exist_ok=True)
        self.config.document_dir.mkdir(parents=True, exist_ok=True)

        self.repository = InsuranceRepository(self.config.db_path)
        document_processor_config = DocumentProcessorConfig(
            base_dir=self.config.document_dir,
            download_documents=self.config.download_documents,
        )
        document_processor = DocumentProcessor(document_processor_config)
        crawler_config = ProductCrawlerConfig(
            max_pages_per_insurer=self.config.max_pages_per_insurer,
            max_depth=self.config.max_depth,
            download_documents=self.config.download_documents,
        )
        self.product_crawler = InsurerProductCrawler(
            config=crawler_config,
            document_processor=document_processor,
            policy_normalizer=PolicyNormalizer(),
        )

    def run(self) -> None:
        """Execute the full pipeline."""
        LOGGER.info("Initializing repository at %s", self.config.db_path)
        self.repository.initialize()

        LOGGER.info("Crawling insurer directory from IRDAI")
        insurers = self._crawl_insurer_directory()
        if self.config.max_insurers is not None:
            insurers = insurers[: self.config.max_insurers]

        LOGGER.info("Persisting %d insurers", len(insurers))
        self.repository.upsert_insurers(insurers)

        document_mappings: List[dict[str, str]] = []
        pending_downloads: List[dict[str, str]] = []

        for index, insurer in enumerate(insurers, start=1):
            LOGGER.info(
                "Processing insurer %d/%d: %s",
                index,
                len(insurers),
                insurer.name,
            )
            result = self.product_crawler.crawl_insurer(insurer)

            product_lookup = {product.product_id: product for product in result.products}

            self.repository.upsert_products(result.products)
            self.repository.upsert_documents(result.documents)

            sections = [
                section
                for product in result.products
                for section in product.policy_sections
            ]
            self.repository.upsert_policy_sections(sections)

            LOGGER.info(
                "Captured %d products and %d documents for %s",
                len(result.products),
                len(result.documents),
                insurer.name,
            )

            mappings = self._build_document_mappings(insurer.name, product_lookup, result.documents)
            document_mappings.extend(mappings)
            pending_downloads.extend(
                self._collect_pending_downloads(
                    insurer=insurer,
                    documents=result.documents,
                    products=product_lookup,
                )
            )

        if document_mappings:
            self._persist_document_mappings(document_mappings)
        self._persist_download_queue(pending_downloads)

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

    def _collect_pending_downloads(
        self,
        insurer: Insurer,
        documents: Iterable[ProductDocument],
        products: dict[str, Product],
    ) -> List[dict[str, str]]:
        queue: List[dict[str, str]] = []
        for document in documents:
            local_path = document.local_path
            if local_path and Path(local_path).exists():
                continue
            product = products.get(document.product_id or "")
            queue.append(
                {
                    "insurer_id": insurer.insurer_id,
                    "insurer_name": insurer.name,
                    "document_id": document.document_id,
                    "document_type": document.document_type,
                    "product_id": document.product_id or "",
                    "product_name": product.name if product else "",
                    "source_url": document.source_url,
                    "page_url": document.metadata.get("page_url", ""),
                    "anchor_text": document.metadata.get("anchor_text", ""),
                    "discovery_method": document.metadata.get("discovery_method", ""),
                    "extension": document.metadata.get("extension", ""),
                }
            )
        return queue

    def _persist_download_queue(self, queue: List[dict[str, str]]) -> None:
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "document_count": len(queue),
            "documents": queue,
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
    args = parser.parse_args(argv)

    return PipelineConfig(
        data_dir=args.data_dir,
        db_path=args.db,
        document_dir=args.documents_dir,
        download_documents=not args.no_download_documents,
        max_insurers=args.max_insurers,
        max_pages_per_insurer=args.max_pages_per_insurer,
        max_depth=args.max_depth,
    )


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    config = parse_args()
    pipeline = InsuranceDataPipeline(config)
    pipeline.run()


if __name__ == "__main__":
    main()
