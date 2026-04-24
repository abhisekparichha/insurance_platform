"""QC workers for verifying product availability and detecting content drift.

Job A — Link Verification (daily):
  HEAD-checks every active product URL and insurer document URL.
  Sets qc_status = verified | failed and logs to qc_log.

Job B — Content Drift (weekly):
  Re-downloads each successfully fetched document and compares SHA-256 hashes.
  If a hash changes the product is marked stale and re-scored on next API hit.
  If a document returns 4xx the product is marked missing.

IRDAI UIN check (wired into Job A):
  If a product has a uin field, a HEAD request to the IRDAI product registry
  URL is also checked and the result logged.

Usage:
    python -m src.qc_worker --db data/insurance.db --job all
    python -m src.qc_worker --db data/insurance.db --job a
    python -m src.qc_worker --db data/insurance.db --job b
"""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import List, Optional

import aiohttp

from .async_downloader import AsyncDocumentDownloader, DownloadError, compute_hash
from .database import InsuranceRepository

LOGGER = logging.getLogger(__name__)

# IRDAI product registry — UIN lookup endpoint (public, no auth required)
IRDAI_UIN_BASE = "https://www.irdai.gov.in/product-lookup?uin="

_HEAD_TIMEOUT = aiohttp.ClientTimeout(total=15, connect=8)
_UA = "InsurancePlatformQC/1.0 (health-check)"


# ── Shared helpers ─────────────────────────────────────────────────────────────

async def _head(
    session: aiohttp.ClientSession, url: str
) -> tuple[bool, str]:
    """HEAD *url*. Returns (reachable, detail_string)."""
    if not url:
        return False, "no_url"
    try:
        async with session.head(
            url,
            timeout=_HEAD_TIMEOUT,
            allow_redirects=True,
            headers={"User-Agent": _UA},
        ) as resp:
            ok = resp.status < 400
            return ok, f"HTTP {resp.status}"
    except asyncio.TimeoutError:
        return False, "timeout"
    except aiohttp.ClientError as exc:
        return False, f"client_error: {exc!s:.100}"
    except Exception as exc:
        return False, f"error: {exc!s:.100}"


# ── Job A: Link Verification ───────────────────────────────────────────────────

async def run_qc_job_a(db_path: Path, max_concurrency: int = 20) -> None:
    """Check every active product URL and optional IRDAI UIN URL."""
    repo = InsuranceRepository(db_path)
    products = repo.get_products_for_qc(days_since_last_check=1)

    if not products:
        LOGGER.info("QC Job A: no products due for check")
        return

    LOGGER.info("QC Job A: checking %d products", len(products))
    semaphore = asyncio.Semaphore(max_concurrency)
    counters = {"verified": 0, "failed": 0}

    async def check_one(product: dict) -> None:
        pid = product["product_id"]
        url = product.get("product_url") or ""
        uin = product.get("uin") or ""

        async with semaphore:
            ok, detail = await _head(session, url)

            # IRDAI UIN cross-check
            if uin:
                irdai_ok, irdai_detail = await _head(session, f"{IRDAI_UIN_BASE}{uin}")
                if not irdai_ok:
                    repo.log_qc_check(pid, "irdai_uin_check", "failed", irdai_detail)
                    detail += f"; IRDAI: {irdai_detail}"
                    ok = False  # treat as failed if IRDAI also can't find it
                else:
                    repo.log_qc_check(pid, "irdai_uin_check", "verified", irdai_detail)

        new_status = "verified" if ok else "failed"
        repo.update_qc_status(pid, new_status, detail)
        counters[new_status] += 1

        if not ok:
            LOGGER.warning("QC A: FAIL %s | %s | %s", pid, url, detail)

    async with aiohttp.ClientSession() as session:
        tasks = [check_one(p) for p in products]
        await asyncio.gather(*tasks, return_exceptions=True)

    LOGGER.info(
        "QC Job A complete — verified: %d, failed: %d",
        counters["verified"], counters["failed"],
    )


# ── Job B: Content Drift ───────────────────────────────────────────────────────

async def run_qc_job_b(
    db_path: Path,
    max_concurrency_per_domain: int = 2,
    days_since_last_check: int = 7,
) -> None:
    """Re-download documents and compare content hashes to detect drift."""
    repo = InsuranceRepository(db_path)
    docs = repo.get_documents_for_drift_check(days_since_last_check=days_since_last_check)

    if not docs:
        LOGGER.info("QC Job B: no documents due for drift check")
        return

    LOGGER.info("QC Job B: drift-checking %d documents", len(docs))
    downloader = AsyncDocumentDownloader(
        max_concurrency_per_domain=max_concurrency_per_domain,
        max_retries=2,
    )
    counters = {"unchanged": 0, "drift": 0, "dead": 0, "error": 0}

    async def check_one(doc: dict) -> None:
        doc_id = product_id = doc["document_id"]
        pid: Optional[str] = doc.get("product_id")
        url: str = doc.get("source_url", "")
        old_hash: str = doc.get("content_hash") or ""

        try:
            content = await downloader.download(session, url)
            new_hash = compute_hash(content)

            if old_hash and new_hash != old_hash:
                LOGGER.info("QC B: drift detected for doc %s", doc_id)
                repo.log_qc_check(
                    pid or doc_id, "content_drift", "drift_detected",
                    f"hash {old_hash[:8]}→{new_hash[:8]}",
                )
                if pid:
                    repo.update_product_status(pid, "stale")
                counters["drift"] += 1
            else:
                repo.log_qc_check(pid or doc_id, "content_drift", "ok", new_hash[:8])
                counters["unchanged"] += 1

            repo.update_document_content_hash(doc_id, new_hash)

        except DownloadError as exc:
            is_dead = exc.status_code and exc.status_code < 500
            result = "link_dead" if is_dead else "unreachable"
            repo.log_qc_check(pid or doc_id, "content_drift", result, str(exc)[:120])
            if is_dead and pid:
                repo.update_product_status(pid, "missing")
            counters["dead" if is_dead else "error"] += 1

        except Exception as exc:
            repo.log_qc_check(pid or doc_id, "content_drift", "error", str(exc)[:120])
            counters["error"] += 1

    connector = aiohttp.TCPConnector(limit=30, ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [check_one(d) for d in docs]
        await asyncio.gather(*tasks, return_exceptions=True)

    LOGGER.info(
        "QC Job B complete — unchanged: %d, drift: %d, dead: %d, error: %d",
        counters["unchanged"], counters["drift"], counters["dead"], counters["error"],
    )


# ── CLI entry point ────────────────────────────────────────────────────────────

def run_qc_now(db_path: Path, job: str = "all") -> None:
    if job in ("a", "all"):
        asyncio.run(run_qc_job_a(db_path))
    if job in ("b", "all"):
        asyncio.run(run_qc_job_b(db_path))


def main() -> None:
    import argparse
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    parser = argparse.ArgumentParser(description="Run QC workers.")
    parser.add_argument("--db",  type=Path, default=Path("data/insurance.db"))
    parser.add_argument("--job", choices=["a", "b", "all"], default="all")
    args = parser.parse_args()
    run_qc_now(args.db, args.job)


if __name__ == "__main__":
    main()
