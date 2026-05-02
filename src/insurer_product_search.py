"""Product search algorithm using URL-pattern-based discovery.

Based on observed patterns from real insurer sites:
  ICICI Lombard: /category/product-slug/ + /downloads/{cat}/ hub
  HDFC ERGO:     /category-insurance/ pages + /download/{type}/{cat}/ hub

Algorithm:
  1. Fetch sitemap.xml  → extract all product URLs
  2. Parse category pages → extract product slugs from nav/cards
  3. Probe document hubs → /download/policy-wordings/{cat}/ etc.
  4. Match products ↔ documents by URL-path correlation
  5. QC each product: HEAD check, doc count, category validity
"""
from __future__ import annotations

import hashlib
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse
from xml.etree import ElementTree

import requests
from bs4 import BeautifulSoup

from .models import Insurer, Product, ProductDocument
from .utils import slugify

LOGGER = logging.getLogger(__name__)

UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
)

# ─── Category classification ─────────────────────────────────────────────────

CATEGORY_URL_PATTERNS: List[Tuple[str, str]] = [
    ("health", ["health-insurance", "health", "medical", "mediclaim", "medi"]),
    ("motor",  ["motor-insurance", "motor", "car-insurance", "auto", "vehicle",
                "two-wheeler", "bike", "car"]),
    ("travel", ["travel-insurance", "travel"]),
    ("home",   ["home-insurance", "home", "property-insurance", "property"]),
    ("life",   ["life-insurance", "life", "term-insurance", "term",
                "personal-accident", "accident"]),
]

# Document hub URL patterns to probe (ordered by priority)
DOC_HUB_PATTERNS = [
    "/download/policy-wordings/{cat}/",       # HDFC ERGO style
    "/downloads/policy-wordings/{cat}/",
    "/download/policy-wording/{cat}/",
    "/download/brochures/{cat}/",             # Brochure hub
    "/downloads/brochures/{cat}/",
    "/download/brochures/",
    "/downloads/",                            # Generic download hub
    "/download/",
]

CATEGORY_SEGMENTS = {
    "health": ["health", "health-insurance"],
    "motor":  ["motor", "motor-insurance", "auto"],
    "travel": ["travel", "travel-insurance"],
    "home":   ["home", "home-insurance", "property"],
    "life":   ["life", "life-insurance", "personal-accident"],
}

DOCUMENT_TYPE_HINTS = {
    "policy_wording": [
        "policy-wording", "policy_wording", "policywording",
        "policy-document", "policy-schedule", "schedule",
        "terms-conditions", "terms_and_conditions",
    ],
    "brochure": ["brochure", "leaflet", "product-brochure", "sales-brochure"],
    "prospectus": ["prospectus"],
}


# ─── Data structures ──────────────────────────────────────────────────────────

@dataclass
class DiscoveredProduct:
    name: str
    slug: str
    url: str
    category: str
    source: str  # "sitemap" | "category_page" | "nav_link"
    documents: List[DiscoveredDocument] = field(default_factory=list)


@dataclass
class DiscoveredDocument:
    url: str
    doc_type: str
    filename: str
    product_slug: str


@dataclass
class SearchResult:
    insurer_id: str
    insurer_name: str
    website_url: str
    products: List[DiscoveredProduct] = field(default_factory=list)
    doc_hub_urls: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    stats: Dict[str, int] = field(default_factory=dict)


# ─── Core Algorithm ───────────────────────────────────────────────────────────

class InsurerProductSearcher:
    """URL-pattern-based product and document discovery for a single insurer."""

    def __init__(
        self,
        timeout: int = 15,
        delay: float = 0.5,
        dry_run: bool = False,
    ) -> None:
        self.timeout = timeout
        self.delay = delay
        self.dry_run = dry_run  # when True: probe URLs but don't parse HTML
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
        })

    # ── Public entry point ────────────────────────────────────────────────────

    def search(self, insurer: Insurer) -> SearchResult:
        root = insurer.website_url.rstrip("/")
        result = SearchResult(
            insurer_id=insurer.insurer_id,
            insurer_name=insurer.name,
            website_url=root,
        )

        if not root:
            result.errors.append("no_website_url")
            return result

        # Step 1 — sitemap discovery
        sitemap_products = self._discover_via_sitemap(root)
        result.stats["sitemap_products"] = len(sitemap_products)

        # Step 2 — category page discovery (fallback / supplement)
        category_products = self._discover_via_category_pages(root)
        result.stats["category_page_products"] = len(category_products)

        # Merge: prefer sitemap entries, supplement with category page ones
        seen_slugs: Dict[str, DiscoveredProduct] = {}
        for p in sitemap_products + category_products:
            if p.slug not in seen_slugs:
                seen_slugs[p.slug] = p
        all_products = list(seen_slugs.values())

        # Step 3 — document hub discovery
        hub_docs = self._discover_document_hubs(root, all_products)
        result.doc_hub_urls = list({d.url for d in hub_docs})
        result.stats["hub_docs"] = len(hub_docs)

        # Step 4 — attach documents to products
        self._attach_documents(all_products, hub_docs)

        # Step 5 — collect any inline links from product pages
        self._enrich_from_product_pages(root, all_products)

        result.products = all_products
        result.stats["total_products"] = len(all_products)
        result.stats["products_with_docs"] = sum(
            1 for p in all_products if p.documents
        )
        return result

    # ── Step 1: Sitemap ───────────────────────────────────────────────────────

    def _discover_via_sitemap(self, root: str) -> List[DiscoveredProduct]:
        products: List[DiscoveredProduct] = []
        for path in ["/sitemap.xml", "/sitemap_index.xml", "/sitemap/"]:
            url = root + path
            xml = self._get_text(url)
            if not xml:
                continue
            urls = self._parse_sitemap_xml(xml, root, url)
            for loc in urls:
                p = self._url_to_product(loc)
                if p:
                    products.append(p)
            if products:
                LOGGER.info("Sitemap found %d products at %s", len(products), url)
                break
        return products

    def _parse_sitemap_xml(
        self, xml_text: str, root: str, sitemap_url: str
    ) -> List[str]:
        urls: List[str] = []
        try:
            root_el = ElementTree.fromstring(xml_text)
        except ElementTree.ParseError:
            return urls

        ns_match = re.match(r"\{([^}]+)\}", root_el.tag)
        ns = ns_match.group(0) if ns_match else ""

        # Handle sitemap index (recurse one level)
        for loc_el in root_el.findall(f".//{ns}loc"):
            loc = (loc_el.text or "").strip()
            if loc.endswith(".xml"):
                child_xml = self._get_text(loc)
                if child_xml:
                    urls.extend(self._parse_sitemap_xml(child_xml, root, loc))
            else:
                urls.append(loc)
        return urls

    # ── Step 2: Category pages ────────────────────────────────────────────────

    def _discover_via_category_pages(self, root: str) -> List[DiscoveredProduct]:
        products: List[DiscoveredProduct] = []
        for category, segs in CATEGORY_SEGMENTS.items():
            for seg in segs:
                url = f"{root}/{seg}/"
                html = self._get_text(url)
                if not html:
                    url = f"{root}/{seg}"
                    html = self._get_text(url)
                if not html:
                    continue
                products.extend(
                    self._extract_products_from_page(html, url, category, root)
                )
                break  # first segment that responds is enough per category
        return products

    def _extract_products_from_page(
        self, html: str, page_url: str, category: str, root: str
    ) -> List[DiscoveredProduct]:
        soup = BeautifulSoup(html, "lxml")
        products: List[DiscoveredProduct] = []
        seen: set = set()

        for a in soup.find_all("a", href=True):
            href: str = a["href"].strip()
            abs_url = urljoin(page_url, href)
            if not abs_url.startswith(root):
                continue

            p = self._url_to_product(abs_url, hint_category=category)
            if p and p.slug not in seen:
                seen.add(p.slug)
                p.source = "category_page"
                products.append(p)
        return products

    # ── URL → Product ─────────────────────────────────────────────────────────

    def _url_to_product(
        self, url: str, hint_category: Optional[str] = None
    ) -> Optional[DiscoveredProduct]:
        parsed = urlparse(url)
        path = parsed.path.rstrip("/")
        parts = [p for p in path.split("/") if p]

        # Need at least /cat/product format
        if len(parts) < 2:
            return None

        # Try to identify the category segment and product segment
        category: Optional[str] = None
        product_seg_idx: int = -1

        for i, part in enumerate(parts):
            detected = self._detect_category(part)
            if detected:
                category = detected
                if i + 1 < len(parts):
                    product_seg_idx = i + 1
                break

        if not category:
            if hint_category:
                category = hint_category
                product_seg_idx = len(parts) - 1
            else:
                return None

        if product_seg_idx < 0 or product_seg_idx >= len(parts):
            return None

        slug = parts[product_seg_idx]

        # Skip known non-product slugs
        skip = {
            "about", "about-us", "contact", "contact-us", "blog", "news",
            "faq", "faqs", "careers", "login", "register", "claim",
            "claims", "download", "downloads", "sitemap", "terms",
            "privacy", "disclaimer", "help", "support", "investor",
            "media", "press", "corporate", "investor-relations", "gallery",
        }
        if slug in skip or len(slug) < 4:
            return None

        name = " ".join(w.capitalize() for w in slug.split("-"))
        return DiscoveredProduct(
            name=name,
            slug=slug,
            url=url,
            category=category,
            source="sitemap",
        )

    def _detect_category(self, segment: str) -> Optional[str]:
        seg = segment.lower()
        for cat, patterns in CATEGORY_URL_PATTERNS:
            if any(pat in seg for pat in patterns):
                return cat
        return None

    # ── Step 3: Document hubs ─────────────────────────────────────────────────

    def _discover_document_hubs(
        self, root: str, products: List[DiscoveredProduct]
    ) -> List[DiscoveredDocument]:
        docs: List[DiscoveredDocument] = []
        probed: set = set()

        categories = list({p.category for p in products}) or list(CATEGORY_SEGMENTS)

        for cat in categories:
            for cat_seg in CATEGORY_SEGMENTS.get(cat, [cat]):
                for pattern in DOC_HUB_PATTERNS:
                    hub_url = root + pattern.format(cat=cat_seg)
                    if hub_url in probed:
                        continue
                    probed.add(hub_url)

                    html = self._get_text(hub_url)
                    if not html:
                        continue

                    found = self._extract_pdf_links(html, hub_url)
                    if found:
                        LOGGER.info(
                            "Doc hub %s → %d PDFs", hub_url, len(found)
                        )
                        docs.extend(found)
                        break  # found a working hub for this pattern level

        return docs

    def _extract_pdf_links(
        self, html: str, page_url: str
    ) -> List[DiscoveredDocument]:
        soup = BeautifulSoup(html, "lxml")
        docs: List[DiscoveredDocument] = []
        seen: set = set()

        for a in soup.find_all("a", href=True):
            href: str = a["href"].strip()
            if not (href.lower().endswith(".pdf") or "/pdf/" in href.lower()):
                continue
            abs_url = urljoin(page_url, href)
            if abs_url in seen:
                continue
            seen.add(abs_url)

            filename = abs_url.split("/")[-1].lower().replace("%20", "-")
            doc_type = self._classify_document(
                filename, a.get_text(strip=True)
            )
            product_slug = self._slug_from_filename(filename)

            docs.append(
                DiscoveredDocument(
                    url=abs_url,
                    doc_type=doc_type,
                    filename=filename,
                    product_slug=product_slug,
                )
            )
        return docs

    def _classify_document(self, filename: str, anchor_text: str) -> str:
        combined = (filename + " " + anchor_text).lower()
        for doc_type, hints in DOCUMENT_TYPE_HINTS.items():
            if any(h in combined for h in hints):
                return doc_type
        return "policy_wording"  # sensible default for insurance PDFs

    def _slug_from_filename(self, filename: str) -> str:
        name = re.sub(r"\.(pdf|doc|docx)$", "", filename, flags=re.IGNORECASE)
        name = re.sub(r"[_\s]+", "-", name)
        name = re.sub(r"[^a-z0-9\-]", "", name.lower())
        return name.strip("-")

    # ── Step 4: Attach documents to products ─────────────────────────────────

    def _attach_documents(
        self,
        products: List[DiscoveredProduct],
        hub_docs: List[DiscoveredDocument],
    ) -> None:
        for doc in hub_docs:
            best_product = self._best_match_product(doc, products)
            if best_product:
                best_product.documents.append(doc)

    def _best_match_product(
        self, doc: DiscoveredDocument, products: List[DiscoveredProduct]
    ) -> Optional[DiscoveredProduct]:
        # Exact slug match first
        for p in products:
            if p.slug in doc.product_slug or doc.product_slug in p.slug:
                return p
        # Keyword overlap fallback
        doc_words = set(doc.product_slug.split("-"))
        best, best_score = None, 0
        for p in products:
            prod_words = set(p.slug.split("-"))
            score = len(doc_words & prod_words)
            if score > best_score and score >= 2:
                best, best_score = p, score
        return best

    # ── Step 5: Enrich from product pages ─────────────────────────────────────

    def _enrich_from_product_pages(
        self, root: str, products: List[DiscoveredProduct]
    ) -> None:
        for product in products:
            if len(product.documents) >= 2:
                continue  # already well-documented

            html = self._get_text(product.url)
            if not html:
                continue

            inline_docs = self._extract_pdf_links(html, product.url)
            for doc in inline_docs:
                if not any(d.url == doc.url for d in product.documents):
                    doc.product_slug = product.slug
                    product.documents.append(doc)

            time.sleep(self.delay)

    # ── HTTP helpers ──────────────────────────────────────────────────────────

    def _get_text(self, url: str) -> Optional[str]:
        try:
            r = self._session.get(url, timeout=self.timeout, allow_redirects=True)
            ct = r.headers.get("Content-Type", "")
            if r.status_code == 200 and ("html" in ct or url.endswith(".xml")):
                time.sleep(self.delay)
                return r.text
            if r.status_code == 403:
                LOGGER.debug("BOT-BLOCKED (403) %s", url)
            elif r.status_code != 200:
                LOGGER.debug("HTTP %d %s", r.status_code, url)
        except requests.exceptions.ConnectionError:
            LOGGER.debug("UNREACHABLE %s", url)
        except Exception as exc:
            LOGGER.debug("GET %s failed: %s", url, exc)
        return None

    def _probe(self, url: str) -> int:
        """Return HTTP status code for a URL (for dry-run / QC reporting)."""
        try:
            r = self._session.head(url, timeout=self.timeout, allow_redirects=True)
            return r.status_code
        except requests.exceptions.ConnectionError:
            return 0
        except Exception:
            return -1


# ─── Batch runner ─────────────────────────────────────────────────────────────

def probe_insurer_urls(insurer: Insurer, timeout: int = 10) -> Dict:
    """
    Dry-run: probe all URL patterns for one insurer with HEAD requests.
    Returns a dict of {url: http_status} for every candidate URL.
    """
    searcher = InsurerProductSearcher(timeout=timeout)
    root = insurer.website_url.rstrip("/")
    probes: Dict[str, int] = {}

    # Sitemap candidates
    for path in ["/sitemap.xml", "/sitemap_index.xml", "/robots.txt"]:
        url = root + path
        probes[url] = searcher._probe(url)

    # Category pages
    for cat, segs in CATEGORY_SEGMENTS.items():
        for seg in segs[:1]:  # just first segment per category
            url = f"{root}/{seg}/"
            probes[url] = searcher._probe(url)

    # Document hub candidates (first 2 category-segments per category)
    for cat, segs in CATEGORY_SEGMENTS.items():
        for seg in segs[:2]:
            for pattern in DOC_HUB_PATTERNS[:4]:
                url = root + pattern.format(cat=seg)
                if url not in probes:
                    probes[url] = searcher._probe(url)

    return {
        "insurer_id": insurer.insurer_id,
        "insurer_name": insurer.name,
        "website": root,
        "probes": probes,
        "accessible": sum(1 for s in probes.values() if s == 200),
        "blocked_403": sum(1 for s in probes.values() if s == 403),
        "not_found_404": sum(1 for s in probes.values() if s == 404),
        "unreachable": sum(1 for s in probes.values() if s in (0, -1)),
    }


def run_product_search_all(
    insurers: List[Insurer],
    timeout: int = 15,
    delay: float = 0.5,
    max_insurers: Optional[int] = None,
) -> List[SearchResult]:
    """Run product search on every insurer and return results."""
    searcher = InsurerProductSearcher(timeout=timeout, delay=delay)
    results: List[SearchResult] = []

    subset = insurers[:max_insurers] if max_insurers else insurers
    total = len(subset)

    for i, insurer in enumerate(subset, 1):
        LOGGER.info(
            "[%d/%d] Searching %s (%s)",
            i, total, insurer.name, insurer.website_url,
        )
        try:
            result = searcher.search(insurer)
        except Exception as exc:
            LOGGER.warning("Search failed for %s: %s", insurer.name, exc)
            result = SearchResult(
                insurer_id=insurer.insurer_id,
                insurer_name=insurer.name,
                website_url=insurer.website_url,
                errors=[str(exc)],
            )
        results.append(result)

    return results


# ─── QC Reporter ──────────────────────────────────────────────────────────────

def qc_report(results: List[SearchResult]) -> Dict:
    """Aggregate QC metrics across all search results."""
    total_insurers = len(results)
    crawled = [r for r in results if not r.errors]
    no_url = [r for r in results if "no_website_url" in r.errors]
    errored = [r for r in results if r.errors and "no_website_url" not in r.errors]

    all_products = [p for r in results for p in r.products]
    products_with_docs = [p for p in all_products if p.documents]

    by_category: Dict[str, int] = {}
    for p in all_products:
        by_category[p.category] = by_category.get(p.category, 0) + 1

    return {
        "total_insurers": total_insurers,
        "insurers_crawled": len(crawled),
        "insurers_no_url": len(no_url),
        "insurers_errored": len(errored),
        "total_products": len(all_products),
        "products_with_docs": len(products_with_docs),
        "doc_coverage_pct": (
            round(len(products_with_docs) / max(len(all_products), 1) * 100, 1)
        ),
        "by_category": by_category,
        "per_insurer": [
            {
                "insurer": r.insurer_name,
                "products": len(r.products),
                "docs": sum(len(p.documents) for p in r.products),
                "categories": list({p.category for p in r.products}),
                "errors": r.errors,
            }
            for r in results
        ],
    }
