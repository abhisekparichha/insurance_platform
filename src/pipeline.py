"""High level pipeline orchestrating insurer crawling, product discovery, and data persistence."""
from __future__ import annotations

import argparse
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List, Optional

from . import insurer_crawler
from .database import InsuranceRepository
from .document_processing import DocumentProcessor, DocumentProcessorConfig, PolicyNormalizer
from .models import Insurer
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

        for index, insurer in enumerate(insurers, start=1):
            LOGGER.info(
                "Processing insurer %d/%d: %s",
                index,
                len(insurers),
                insurer.name,
            )
            result = self.product_crawler.crawl_insurer(insurer)

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
