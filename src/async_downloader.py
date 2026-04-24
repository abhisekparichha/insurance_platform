"""Async document downloader with per-domain rate limiting and exponential-backoff retry."""
from __future__ import annotations

import asyncio
import hashlib
import logging
from collections import defaultdict
from pathlib import Path
from typing import Dict, Optional
from urllib.parse import urlparse

import aiohttp

LOGGER = logging.getLogger(__name__)

MAX_DOCUMENT_SIZE = 25 * 1024 * 1024  # 25 MB
DEFAULT_TIMEOUT = aiohttp.ClientTimeout(total=30, connect=10)
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
)


class DownloadError(Exception):
    """Raised when a document cannot be downloaded after all retries."""

    def __init__(self, message: str, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class AsyncDocumentDownloader:
    """Downloads documents asynchronously with per-domain concurrency caps and retry."""

    def __init__(
        self,
        max_concurrency_per_domain: int = 3,
        max_retries: int = 3,
        max_document_size: int = MAX_DOCUMENT_SIZE,
        timeout: aiohttp.ClientTimeout = DEFAULT_TIMEOUT,
    ) -> None:
        self._semaphores: Dict[str, asyncio.Semaphore] = defaultdict(
            lambda: asyncio.Semaphore(max_concurrency_per_domain)
        )
        self.max_retries = max_retries
        self.max_document_size = max_document_size
        self.timeout = timeout

    @staticmethod
    def _domain(url: str) -> str:
        return urlparse(url).netloc

    async def download(self, session: aiohttp.ClientSession, url: str) -> bytes:
        """Download *url*, respecting per-domain concurrency and retrying on transient errors.

        Raises DownloadError on permanent failure (4xx) or after all retries exhausted.
        """
        domain = self._domain(url)
        semaphore = self._semaphores[domain]
        last_exc: Optional[Exception] = None

        for attempt in range(1, self.max_retries + 1):
            try:
                async with semaphore:
                    async with session.get(
                        url,
                        timeout=self.timeout,
                        allow_redirects=True,
                        headers={"User-Agent": DEFAULT_USER_AGENT},
                    ) as response:
                        if response.status >= 400:
                            # 4xx is permanent — do not retry
                            raise DownloadError(
                                f"HTTP {response.status} for {url}",
                                status_code=response.status,
                            )
                        declared = int(response.headers.get("Content-Length", 0))
                        if declared and declared > self.max_document_size:
                            raise DownloadError(
                                f"Document too large ({declared} bytes): {url}"
                            )
                        content = await response.read()
                        if len(content) > self.max_document_size:
                            raise DownloadError(
                                f"Document exceeded max size after download: {url}"
                            )
                        return content

            except DownloadError:
                raise  # permanent — propagate immediately
            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                last_exc = exc
                if attempt < self.max_retries:
                    wait = 2 ** attempt  # 2 s, 4 s, 8 s
                    LOGGER.warning(
                        "Attempt %d/%d failed for %s: %s — retrying in %ds",
                        attempt, self.max_retries, url, exc, wait,
                    )
                    await asyncio.sleep(wait)

        raise DownloadError(
            f"All {self.max_retries} attempts failed for {url}: {last_exc}"
        )


def compute_hash(content: bytes) -> str:
    """Return SHA-256 hex digest of *content*."""
    return hashlib.sha256(content).hexdigest()


def detect_extension(url: str) -> str:
    """Best-effort extension detection from URL path."""
    path = Path(url.split("?")[0])
    ext = path.suffix.lower()
    supported = {".pdf", ".doc", ".docx"}
    if ext in supported:
        return ext
    if ".pdf" in url.lower():
        return ".pdf"
    return ext or ".dat"
