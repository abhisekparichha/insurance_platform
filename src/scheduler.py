"""APScheduler-based job scheduler for periodic QC and re-crawl tasks.

Runs inside the same Python process as the pipeline server (or standalone).
Falls back gracefully if APScheduler is not installed — QC jobs can still
be triggered manually via src.qc_worker CLI.

Scheduled jobs:
  qc_link_check    — daily at 02:00 IST (Job A: link verification)
  qc_content_drift — every Sunday at 03:00 IST (Job B: content drift)

Usage (embedded in a long-running process):
    from src.scheduler import build_scheduler
    scheduler = build_scheduler(Path("data/insurance.db"))
    if scheduler:
        scheduler.start()
        # ... your event loop / server here ...
        scheduler.shutdown()

Usage (standalone):
    python -m src.scheduler --db data/insurance.db
"""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Optional

LOGGER = logging.getLogger(__name__)

try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    _HAS_APScheduler = True
except ImportError:
    _HAS_APScheduler = False


def build_scheduler(db_path: Path) -> Optional[object]:
    """Create and configure an AsyncIOScheduler.

    Returns the scheduler (not yet started) or None if APScheduler is missing.
    """
    if not _HAS_APScheduler:
        LOGGER.warning(
            "APScheduler not installed — scheduled QC disabled. "
            "Run: pip install apscheduler>=3.10"
        )
        return None

    from .qc_worker import run_qc_job_a, run_qc_job_b

    scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")

    # Job A: link verification — daily at 02:00 IST
    scheduler.add_job(
        _run_a,
        CronTrigger(hour=2, minute=0),
        kwargs={"db_path": db_path},
        id="qc_link_check",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    # Job B: content drift — every Sunday at 03:00 IST
    scheduler.add_job(
        _run_b,
        CronTrigger(day_of_week="sun", hour=3, minute=0),
        kwargs={"db_path": db_path},
        id="qc_content_drift",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    LOGGER.info(
        "Scheduler configured — Job A: daily 02:00 IST, Job B: Sunday 03:00 IST"
    )
    return scheduler


async def _run_a(db_path: Path) -> None:
    from .qc_worker import run_qc_job_a
    await run_qc_job_a(db_path)


async def _run_b(db_path: Path) -> None:
    from .qc_worker import run_qc_job_b
    await run_qc_job_b(db_path)


# ── CLI: run scheduler in foreground until Ctrl-C ─────────────────────────────

def main() -> None:
    import argparse
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    parser = argparse.ArgumentParser(description="Run the QC job scheduler.")
    parser.add_argument("--db", type=Path, default=Path("data/insurance.db"))
    args = parser.parse_args()

    scheduler = build_scheduler(args.db)
    if scheduler is None:
        LOGGER.error("Cannot start scheduler — APScheduler not installed.")
        return

    async def _run() -> None:
        scheduler.start()
        LOGGER.info("Scheduler running. Press Ctrl-C to stop.")
        try:
            while True:
                await asyncio.sleep(60)
        except (KeyboardInterrupt, SystemExit):
            scheduler.shutdown()
            LOGGER.info("Scheduler stopped.")

    asyncio.run(_run())


if __name__ == "__main__":
    main()
