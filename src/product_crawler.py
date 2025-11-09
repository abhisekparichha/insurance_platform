"""Website crawler to discover insurer products and documents."""
from __future__ import annotations

import logging
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Deque, Dict, Iterable, List, Optional, Set
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup, Tag

from .document_processing import DocumentProcessor, DocumentProcessorConfig, PolicyNormalizer
from .models import Insurer, Product, ProductCrawlResult, ProductDocument
from .utils import (
    clean_text,
    ensure_url_has_scheme,
    is_same_domain,
    iter_unique,
    make_absolute_url,
    slugify,
)

LOGGER = logging.getLogger(__name__)

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
)

SKIP_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".zip",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".mp4",
    ".mp3",
    ".avi",
    ".mov",
}


@dataclass
class ProductCrawlerConfig:
    """Settings for crawling insurer websites."""

    max_pages_per_insurer: int = 120
    max_depth: int = 3
    request_timeout: int = 20
    user_agent: str = DEFAULT_USER_AGENT
    respect_robots_txt: bool = False  # Placeholder for future expansion
    download_documents: bool = True


@dataclass
class CrawlTask:
    url: str
    depth: int


class InsurerProductCrawler:
    """Crawl insurer websites to extract product metadata and documents."""

    PRODUCT_KEYWORDS = ("plan", "policy", "insurance", "cover", "product")
    DOCUMENT_KEYWORDS = {
        "policy_wording": ("policy wording", "policy wordings", "policy document", "policy schedule"),
        "brochure": ("brochure", "leaflet"),
        "prospectus": ("prospectus", "sales brochure"),
    }
    CATEGORY_KEYWORDS = {
        "health": ("health", "medi", "mediclaim", "hospital"),
        "motor": ("motor", "car", "bike", "vehicle", "auto"),
        "life_term": ("term", "term plan", "life cover"),
        "life_savings": ("traditional", "savings", "endowment", "money back", "investment"),
    }
    REQUIRED_DOCUMENT_TYPES = {"brochure", "policy_wording", "prospectus"}
    DOWNLOAD_URL_HINTS = (
        "download",
        "downloads",
        "product-brochure",
        "productbrochure",
        "policy-wording",
        "policy_wording",
        "policywording",
        "policy-document",
    )
    DOWNLOAD_TEXT_HINTS = (
        "download",
        "downloads",
        "brochure",
        "product brochure",
        "policy wording",
        "policy wordings",
        "policy document",
        "policy schedule",
    )

    def __init__(
        self,
        config: Optional[ProductCrawlerConfig] = None,
        document_processor: Optional[DocumentProcessor] = None,
        policy_normalizer: Optional[PolicyNormalizer] = None,
        session: Optional[requests.Session] = None,
    ) -> None:
        self.config = config or ProductCrawlerConfig()
        processor_config = DocumentProcessorConfig(download_documents=self.config.download_documents)
        self.document_processor = document_processor or DocumentProcessor(processor_config)
        self.policy_normalizer = policy_normalizer or PolicyNormalizer()
        self.session = session or requests.Session()
        self.session.headers.update({"User-Agent": self.config.user_agent})

    def crawl_insurer(self, insurer: Insurer) -> ProductCrawlResult:
        """Entry point for crawling a single insurer."""
        root_url = ensure_url_has_scheme(insurer.website_url)
        if not root_url:
            LOGGER.info("Skipping insurer %s: no website URL", insurer.name)
            return ProductCrawlResult(insurer=insurer, products=[], documents=[], stats={})

        queue: Deque[CrawlTask] = deque([CrawlTask(root_url, 0)])
        visited: Set[str] = set()
        products: Dict[str, Product] = {}
        documents: Dict[str, ProductDocument] = {}
        stats = {"pages_visited": 0, "pages_skipped": 0, "documents_found": 0}

        while queue and stats["pages_visited"] < self.config.max_pages_per_insurer:
            task = queue.popleft()
            url = task.url

            if url in visited:
                continue
            visited.add(url)

            if task.depth > self.config.max_depth:
                stats["pages_skipped"] += 1
                continue

            html = self._fetch_html(url)
            if html is None:
                stats["pages_skipped"] += 1
                continue

            stats["pages_visited"] += 1

            soup = BeautifulSoup(html, "html.parser")
            text = clean_text(soup.get_text(" ", strip=True))

            page_products = self._extract_products(insurer, url, soup, text)
            for product in page_products:
                existing = products.get(product.product_id)
                if existing:
                    existing.metadata.update(product.metadata)
                    existing.tags = list(iter_unique(existing.tags + product.tags))
                    existing.description = existing.description or product.description
                else:
                    products[product.product_id] = product

            page_documents = self._extract_documents(insurer, url, soup)
            stats["documents_found"] += len(page_documents)

            self._associate_documents(insurer, page_products, page_documents, products, documents)

            for link in self._extract_links(soup, url, root_url):
                if link not in visited:
                    queue.append(CrawlTask(link, task.depth + 1))

        return ProductCrawlResult(
            insurer=insurer,
            products=list(products.values()),
            documents=list(documents.values()),
            stats=stats,
        )

    def _fetch_html(self, url: str) -> Optional[str]:
        try:
            response = self.session.get(url, timeout=self.config.request_timeout)
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "")
            if "text/html" not in content_type:
                return None
            return response.text
        except Exception as exc:  # pylint: disable=broad-except
            LOGGER.debug("Failed to fetch %s: %s", url, exc)
            return None

    def _extract_links(self, soup: BeautifulSoup, page_url: str, root_url: str) -> Iterable[str]:
        for anchor in soup.find_all("a", href=True):
            href = anchor["href"].strip()
            if href.startswith(("mailto:", "tel:", "javascript:")):
                continue
            absolute = make_absolute_url(href, page_url)
            parsed = urlparse(absolute)
            if any(parsed.path.lower().endswith(ext) for ext in SKIP_EXTENSIONS):
                continue
            if is_same_domain(absolute, root_url):
                yield absolute

    def _extract_products(
        self,
        insurer: Insurer,
        page_url: str,
        soup: BeautifulSoup,
        page_text: str,
    ) -> List[Product]:
        products: List[Product] = []
        for heading in soup.find_all(["h1", "h2", "h3", "h4"]):
            title = clean_text(heading.get_text(" ", strip=True))
            if not self._is_potential_product_name(title):
                continue

            product_id = slugify(f"{insurer.insurer_id}-{title}")
            product_url = self._resolve_heading_url(heading, page_url)
            description = self._collect_description(heading)
            category = self._classify_category(title, page_text)
            tags = self._extract_tags(title)

            product = Product(
                product_id=product_id,
                insurer_id=insurer.insurer_id,
                name=title,
                category=category,
                product_url=product_url,
                description=description,
                discovered_from_url=page_url,
                tags=tags,
                metadata={
                    "heading_level": heading.name,
                    "page_url": page_url,
                },
            )
            products.append(product)

        return products

    def _extract_documents(
        self, insurer: Insurer, page_url: str, soup: BeautifulSoup
    ) -> List[ProductDocument]:
        documents: List[ProductDocument] = []
        for anchor, absolute, anchor_text in self._iter_document_links(soup, page_url):
            document_type = self._infer_document_type(anchor_text, absolute)
            if document_type not in self.REQUIRED_DOCUMENT_TYPES:
                continue
            if not self._looks_like_download_link(anchor, anchor_text, absolute):
                continue

            doc_id = slugify(f"{insurer.insurer_id}-{Path(absolute).stem}-{document_type}")
            document = ProductDocument(
                document_id=doc_id,
                insurer_id=insurer.insurer_id,
                document_type=document_type,
                source_url=absolute,
                metadata={
                    "anchor_text": anchor_text,
                    "page_url": page_url,
                    "discovery_method": "download_section",
                },
            )
            documents.append(document)
        return documents

    def _iter_document_links(
        self, soup: BeautifulSoup, page_url: str
    ) -> Iterable[tuple[Tag, str, str]]:
        for anchor in soup.find_all("a", href=True):
            href = anchor["href"].strip()
            if not href:
                continue
            absolute = make_absolute_url(href, page_url)
            if not absolute:
                continue
            lower_url = absolute.lower()
            if not lower_url.endswith((".pdf", ".doc", ".docx")):
                continue
            anchor_text = clean_text(anchor.get_text(" ", strip=True))
            yield anchor, absolute, anchor_text

    def _looks_like_download_link(self, anchor: Tag, anchor_text: str, absolute_url: str) -> bool:
        text = (anchor_text or "").lower()
        url = absolute_url.lower()
        if any(keyword in url for keyword in self.DOWNLOAD_URL_HINTS):
            return True
        if any(keyword in text for keyword in self.DOWNLOAD_TEXT_HINTS):
            return True
        for attr in ("title", "aria-label", "data-title", "data-label"):
            value = anchor.get(attr)
            if isinstance(value, str) and any(keyword in value.lower() for keyword in self.DOWNLOAD_TEXT_HINTS):
                return True
        for attr in ("class", "id"):
            value = anchor.get(attr)
            if isinstance(value, list):
                value = " ".join(value)
            if isinstance(value, str) and any(keyword in value.lower() for keyword in self.DOWNLOAD_TEXT_HINTS):
                return True
        parent = anchor.parent
        depth = 0
        while parent is not None and depth < 3:
            for attr in ("class", "id", "data-section", "data-testid"):
                value = parent.get(attr)
                if isinstance(value, list):
                    value = " ".join(value)
                if isinstance(value, str) and any(
                    keyword in value.lower() for keyword in self.DOWNLOAD_TEXT_HINTS
                ):
                    return True
            parent = parent.parent
            depth += 1
        return False

    def _associate_documents(
        self,
        insurer: Insurer,
        page_products: List[Product],
        page_documents: List[ProductDocument],
        all_products: Dict[str, Product],
        all_documents: Dict[str, ProductDocument],
    ) -> None:
        processed_products = {product.product_id: product for product in page_products}
        if not processed_products:
            processed_products = {
                pid: all_products[pid]
                for pid in all_products
            }

        for document in page_documents:
            processed = self.document_processor.process_document(document)
            matched_product = self._match_document_to_product(processed, processed_products.values())

            if matched_product:
                processed.product_id = matched_product.product_id
                matched_product.merge_documents([processed])
                if processed.document_type == "policy_wording" and processed.extracted_text:
                    sections = self.policy_normalizer.normalize(matched_product, processed)
                    matched_product.extend_policy_sections(sections)

            existing = all_documents.get(processed.document_id)
            if existing:
                existing.metadata.update(processed.metadata)
                existing.local_path = existing.local_path or processed.local_path
                existing.extracted_text = existing.extracted_text or processed.extracted_text
            else:
                all_documents[processed.document_id] = processed

    def _match_document_to_product(
        self,
        document: ProductDocument,
        products: Iterable[Product],
    ) -> Optional[Product]:
        product_list = list(products)
        if not product_list:
            return None

        anchor_text = document.metadata.get("anchor_text", "").lower()
        if anchor_text:
            for product in product_list:
                if product.name.lower() in anchor_text:
                    return product

        if len(product_list) == 1:
            return product_list[0]
        return None

    def _is_potential_product_name(self, value: str) -> bool:
        lowercase = value.lower()
        return any(keyword in lowercase for keyword in self.PRODUCT_KEYWORDS) and len(value) > 5

    def _infer_document_type(self, anchor_text: str, href: str = "") -> str:
        text = (anchor_text or "").lower()
        for doc_type, keywords in self.DOCUMENT_KEYWORDS.items():
            if any(keyword in text for keyword in keywords):
                return doc_type

        if href:
            href_lower = href.lower()
            normalized_url = href_lower.replace("-", " ").replace("_", " ")
            for doc_type, keywords in self.DOCUMENT_KEYWORDS.items():
                for keyword in keywords:
                    normalized_keyword = keyword.lower()
                    if normalized_keyword in normalized_url or normalized_keyword.replace(" ", "") in href_lower:
                        return doc_type

        return "other"

    def _collect_description(self, heading: Tag) -> str:
        description_parts: List[str] = []
        for sibling in heading.next_siblings:
            if isinstance(sibling, Tag):
                if sibling.name in {"h1", "h2", "h3", "h4"}:
                    break
                text = clean_text(sibling.get_text(" ", strip=True))
                if text:
                    description_parts.append(text)
            else:
                text = clean_text(str(sibling))
                if text:
                    description_parts.append(text)
            if len(" ".join(description_parts)) > 400:
                break
        return " ".join(description_parts)[:800]

    def _extract_tags(self, title: str) -> List[str]:
        tags = []
        lowercase = title.lower()
        for category, keywords in self.CATEGORY_KEYWORDS.items():
            if any(keyword in lowercase for keyword in keywords):
                tags.append(category)
        return tags

    def _classify_category(self, title: str, page_text: str) -> str:
        combined = f"{title} {page_text}".lower()
        for category, keywords in self.CATEGORY_KEYWORDS.items():
            if any(keyword in combined for keyword in keywords):
                return category
        return "other"

    def _resolve_heading_url(self, heading: Tag, page_url: str) -> str:
        anchor = heading.find("a")
        href = ""
        if anchor and anchor.has_attr("href"):
            href = anchor["href"].strip()
        if href:
            return make_absolute_url(href, page_url)
        return page_url
