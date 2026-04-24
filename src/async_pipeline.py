"""Async pipeline: sync discovery phase → asyncio worker pool for downloads.

Replaces the blocking InsuranceDataPipeline.run() with a two-phase approach:
  Phase 1  Discovery — crawls IRDAI + insurer sites for metadata (sync, fast).
  Phase 2  Downloads — N async workers pull from a queue, download, extract, store.

Usage:
    python -m src.async_pipeline [--workers 10] [--max-insurers N] [--db PATH]
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

import aiohttp

from .async_downloader import AsyncDocumentDownloader, DownloadError, compute_hash, detect_extension
from .database import InsuranceRepository
from .document_processing import PolicyNormalizer
from .models import Insurer, ProductDocument
from .pipeline import InsuranceDataPipeline, PipelineConfig
from .utils import slugify, strip_hindi

LOGGER = logging.getLogger(__name__)

# Poison pill sentinel used to stop workers cleanly
_STOP = object()


@dataclass
class AsyncPipelineConfig:
    """Configuration for the async pipeline."""

    pipeline: PipelineConfig
    num_download_workers: int = 10
    max_concurrency_per_domain: int = 3
    max_retries: int = 3


# ── Worker coroutine ──────────────────────────────────────────────────────────

async def _download_worker(
    worker_id: int,
    queue: asyncio.Queue,
    session: aiohttp.ClientSession,
    downloader: AsyncDocumentDownloader,
    repo: InsuranceRepository,
    doc_dir: Path,
) -> None:
    """Pull download tasks from *queue* until a stop sentinel is received."""
    while True:
        item = await queue.get()
        if item is _STOP:
            queue.task_done()
            return

        document: ProductDocument = item
        url = document.source_url
        doc_id = document.document_id

        LOGGER.debug("Worker %d: %s", worker_id, url)
        attempts = 0
        try:
            content = await downloader.download(session, url)
            attempts = 1
            content_hash = compute_hash(content)

            ext = detect_extension(url)
            local_path = doc_dir / document.insurer_id / f"{slugify(doc_id)}{ext}"
            local_path.parent.mkdir(parents=True, exist_ok=True)

            # Write bytes synchronously — negligible latency for local disk
            local_path.write_bytes(content)

            # Offload CPU-bound PDF extraction to the thread pool
            extracted = ""
            if ext == ".pdf":
                try:
                    from pdfminer.high_level import extract_text as _pdf_text
                    loop = asyncio.get_event_loop()
                    raw = await loop.run_in_executor(
                        None, lambda: _pdf_text(str(local_path))
                    )
                    extracted = strip_hindi(raw)
                except Exception as exc:
                    LOGGER.warning("PDF extraction failed for %s: %s", url, exc)

            document.local_path = local_path
            document.content_hash = content_hash
            document.extracted_text = extracted

            repo.update_document_fetch_status(doc_id, "success", attempts)
            LOGGER.info("Downloaded %s → %s", url, local_path.name)

        except DownloadError as exc:
            attempts = downloader.max_retries
            # 4xx → permanent dead link; 5xx/network → transient failure
            status = (
                "link_dead"
                if exc.status_code and exc.status_code < 500
                else "fetch_failed"
            )
            repo.update_document_fetch_status(doc_id, status, attempts)
            LOGGER.warning("Download %s for %s: %s", status, url, exc)

            # If the product's only document is dead, mark the product missing
            if status == "link_dead" and document.product_id:
                repo.update_product_status(document.product_id, "missing")

        except Exception as exc:
            repo.update_document_fetch_status(doc_id, "fetch_failed", attempts)
            LOGGER.error("Unexpected error for %s: %s", url, exc)

        finally:
            queue.task_done()


# ── Orchestrator ──────────────────────────────────────────────────────────────

async def run_async_pipeline(config: AsyncPipelineConfig) -> None:
    """Execute Phase 1 (sync discovery) then Phase 2 (async downloads)."""
    pc = config.pipeline

    # ── Phase 1: Discovery ────────────────────────────────────────────────────
    LOGGER.info("Phase 1: Discovery (sync crawl)")
    sync_pipeline = InsuranceDataPipeline(pc)
    sync_pipeline.repository.initialize()

    insurers: List[Insurer] = sync_pipeline._crawl_insurer_directory()
    if pc.max_insurers is not None:
        insurers = insurers[: pc.max_insurers]

    sync_pipeline.repository.upsert_insurers(insurers)

    all_documents: List[ProductDocument] = []

    for idx, insurer in enumerate(insurers, 1):
        LOGGER.info("Discovery %d/%d: %s", idx, len(insurers), insurer.name)
        # crawl_insurer collects metadata but its DocumentProcessor will skip
        # actual downloads because we handle them in Phase 2
        result = sync_pipeline.product_crawler.crawl_insurer(insurer)

        sync_pipeline.repository.upsert_products(result.products)
        sync_pipeline.repository.upsert_documents(result.documents)

        sections = [
            section
            for product in result.products
            for section in product.policy_sections
        ]
        sync_pipeline.repository.upsert_policy_sections(sections)

        # Tag each document with its insurer so workers know where to file it
        for doc in result.documents:
            doc.insurer_id = doc.insurer_id or insurer.insurer_id
        all_documents.extend(result.documents)

        LOGGER.info(
            "  → %d products, %d documents", len(result.products), len(result.documents)
        )

    LOGGER.info(
        "Phase 1 complete: %d insurers, %d documents queued for download",
        len(insurers), len(all_documents),
    )

    # ── Phase 2: Async downloads ──────────────────────────────────────────────
    LOGGER.info(
        "Phase 2: Async downloads (%d workers, %d concurrency/domain)",
        config.num_download_workers, config.max_concurrency_per_domain,
    )

    queue: asyncio.Queue = asyncio.Queue()
    for doc in all_documents:
        await queue.put(doc)
    for _ in range(config.num_download_workers):
        await queue.put(_STOP)

    downloader = AsyncDocumentDownloader(
        max_concurrency_per_domain=config.max_concurrency_per_domain,
        max_retries=config.max_retries,
    )

    connector = aiohttp.TCPConnector(limit=50, ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        workers = [
            asyncio.create_task(
                _download_worker(
                    i, queue, session, downloader,
                    sync_pipeline.repository, pc.document_dir,
                )
            )
            for i in range(config.num_download_workers)
        ]
        await queue.join()
        for w in workers:
            w.cancel()

    LOGGER.info("Phase 2 complete.")


# ── CLI entry point ───────────────────────────────────────────────────────────

def main() -> None:
    import argparse
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    parser = argparse.ArgumentParser(description="Run the async insurance data pipeline.")
    parser.add_argument("--db",           type=Path, default=Path("data/insurance.db"))
    parser.add_argument("--data-dir",     type=Path, default=Path("data"))
    parser.add_argument("--documents-dir",type=Path, default=Path("data/documents"))
    parser.add_argument("--workers",      type=int,  default=10)
    parser.add_argument("--max-insurers", type=int,  default=None)
    parser.add_argument(
        "--max-pages-per-insurer", type=int, default=80,
        help="BFS page limit per insurer website",
    )
    parser.add_argument("--max-depth",    type=int,  default=3)
    args = parser.parse_args()

    pipeline_config = PipelineConfig(
        data_dir=args.data_dir,
        db_path=args.db,
        document_dir=args.documents_dir,
        download_documents=True,
        max_insurers=args.max_insurers,
        max_pages_per_insurer=args.max_pages_per_insurer,
        max_depth=args.max_depth,
    )
    async_config = AsyncPipelineConfig(
        pipeline=pipeline_config,
        num_download_workers=args.workers,
    )
    asyncio.run(run_async_pipeline(async_config))


if __name__ == "__main__":
    main()
