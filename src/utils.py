"""Utility helpers for crawling, text normalization, and URL handling."""
from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable
from urllib.parse import urljoin, urlparse, urlunparse

WHITESPACE_RE = re.compile(r"\s+")
HINDI_RE = re.compile(r"[\u0900-\u097F]+")
NON_WORD_RE = re.compile(r"[^\w\s-]")
HYPHEN_RE = re.compile(r"[-\s]+")


def normalize_whitespace(value: str) -> str:
    """Collapse repeated whitespace characters into single spaces."""
    return WHITESPACE_RE.sub(" ", value).strip()


def strip_hindi(value: str) -> str:
    """Remove Hindi (Devanagari) characters from text."""
    if not value:
        return value
    return HINDI_RE.sub("", value)


def clean_text(value: str) -> str:
    """Normalize text by trimming whitespace and removing Hindi content."""
    return normalize_whitespace(strip_hindi(value))


def slugify(value: str) -> str:
    """Generate a filesystem and identifier friendly slug."""
    if not value:
        return ""
    value = unicodedata.normalize("NFKD", value)
    value = value.encode("ascii", "ignore").decode("ascii")
    value = NON_WORD_RE.sub("", value).strip().lower()
    return HYPHEN_RE.sub("-", value)


def ensure_url_has_scheme(url: str, default_scheme: str = "https") -> str:
    """Ensure a URL includes an explicit scheme."""
    if not url:
        return url
    parsed = urlparse(url)
    if not parsed.scheme:
        parsed = parsed._replace(scheme=default_scheme)
    if parsed.netloc == "":
        return url
    return urlunparse(parsed)


def is_same_domain(candidate_url: str, root_url: str) -> bool:
    """Check whether the candidate URL belongs to the same domain as root."""
    if not candidate_url or not root_url:
        return False
    candidate = urlparse(candidate_url)
    root = urlparse(root_url)
    return candidate.netloc == root.netloc


def make_absolute_url(url: str, base_url: str) -> str:
    """Resolve a possibly relative URL against a base URL."""
    if not url:
        return ""
    return urljoin(base_url, url)


def iter_unique(values: Iterable[str]) -> Iterable[str]:
    """Yield unique strings preserving order."""
    seen = set()
    for value in values:
        if value and value not in seen:
            seen.add(value)
            yield value


def compute_content_hash(data: bytes) -> str:
    """Compute an SHA256 hash for raw bytes."""
    sha = hashlib.sha256()
    sha.update(data)
    return sha.hexdigest()


@dataclass(frozen=True)
class CrawlStats:
    """Metadata for crawl operations."""

    pages_visited: int = 0
    pages_skipped: int = 0
    documents_fetched: int = 0
    documents_failed: int = 0
