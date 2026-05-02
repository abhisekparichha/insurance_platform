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

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import urljoin, urlparse
from xml.etree import ElementTree

import requests
from bs4 import BeautifulSoup

from .models import Insurer
from .utils import slugify

try:
    from playwright.sync_api import sync_playwright
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False

LOGGER = logging.getLogger(__name__)

# Chromium executable installed in this environment
_CHROMIUM_EXECUTABLE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
)

# ─── Category classification ─────────────────────────────────────────────────

# Ordered by priority for slug detection
CATEGORY_URL_PATTERNS: List[Tuple[str, List[str]]] = [
    ("health",  ["health-insurance", "health", "medical", "mediclaim", "medi"]),
    ("motor",   ["motor-insurance", "motor", "car-insurance", "two-wheeler",
                 "vehicle", "auto", "car", "bike"]),
    ("travel",  ["travel-insurance", "travel"]),
    ("home",    ["home-insurance", "home", "property-insurance", "property"]),
    ("life",    ["life-insurance", "life", "term-insurance", "term",
                 "personal-accident", "accident", "ulip"]),
    ("cyber",   ["cyber-insurance", "cyber"]),
]

# Category path segments to probe (first entry is tried first)
CATEGORY_SEGMENTS: Dict[str, List[str]] = {
    "health":  ["health-insurance", "health"],
    "motor":   ["motor-insurance", "motor", "car-insurance"],
    "travel":  ["travel-insurance", "travel"],
    "home":    ["home-insurance", "home"],
    "life":    ["life-insurance", "life", "term-insurance"],
    "cyber":   ["cyber-insurance", "cyber"],
}

# Document hub patterns (tried in order; first successful wins per category)
DOC_HUB_PATTERNS = [
    "/download/policy-wordings/{cat}/",     # HDFC ERGO style
    "/downloads/policy-wordings/{cat}/",
    "/download/policy-wording/{cat}/",
    "/downloads/policy-wording/{cat}/",
    "/download/brochures/{cat}/",
    "/downloads/brochures/{cat}/",
    "/download/{cat}/",
    "/downloads/{cat}/",
    "/download/policy-wordings/",           # Generic (no category in URL)
    "/downloads/policy-wordings/",
    "/downloads/",                          # ICICI Lombard style
    "/download/",
    "/documents/",
    "/resources/",
]

DOCUMENT_TYPE_HINTS: Dict[str, List[str]] = {
    "policy_wording": [
        "policy-wording", "policy_wording", "policywording",
        "policy-document", "policy-schedule", "policy-wordings",
        "terms-conditions", "terms_and_conditions", "terms-and-conditions",
        "wording",
    ],
    "brochure": [
        "brochure", "leaflet", "product-brochure", "sales-brochure",
    ],
    "prospectus": ["prospectus"],
    "rider":      ["rider", "addendum", "endorsement"],
}

# Slugs that are definitely not product names
_NON_PRODUCT_SLUGS = frozenset({
    "about", "about-us", "contact", "contact-us", "blog", "news",
    "faq", "faqs", "careers", "login", "register", "claim", "claims",
    "download", "downloads", "sitemap", "terms", "terms-conditions",
    "privacy", "privacy-policy", "disclaimer", "help", "support",
    "investor", "media", "press", "corporate", "investor-relations",
    "gallery", "awards", "testimonials", "network-hospitals",
    "network", "hospital-finder", "cashless", "grievance",
    "renewal", "renew", "pay-premium", "premium-payment",
    "products", "all-products", "all-plans", "compare",
    "tax-benefit", "tax", "calculator", "calculators",
    "agents", "agent", "posp", "partner", "partners",
    "locate-branch", "branch", "branches", "locate",
})


# ─── Data structures ──────────────────────────────────────────────────────────

@dataclass
class DiscoveredProduct:
    name: str
    slug: str
    url: str
    category: str
    source: str   # "sitemap" | "category_page" | "nav_link"
    documents: List["DiscoveredDocument"] = field(default_factory=list)


@dataclass
class DiscoveredDocument:
    url: str
    doc_type: str
    filename: str
    product_slug: str   # best-guess product slug from filename


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
        timeout: int = 20,
        delay: float = 0.5,
        use_browser: bool = False,
        chromium_executable: Optional[str] = None,
    ) -> None:
        self.timeout = timeout
        self.delay = delay
        self.use_browser = use_browser and HAS_PLAYWRIGHT
        self._chromium = chromium_executable or _CHROMIUM_EXECUTABLE
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-IN,en-US;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
        })

    # ── Public entry point ────────────────────────────────────────────────────

    def search(self, insurer: Insurer) -> SearchResult:
        """Run the full 5-step product discovery pipeline for one insurer."""
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

        # Step 2 — category page discovery (supplements / fallback for sitemap)
        category_products = self._discover_via_category_pages(root)
        result.stats["category_page_products"] = len(category_products)

        # Merge: prefer sitemap, add new ones from category pages
        seen_slugs: Dict[str, DiscoveredProduct] = {
            p.slug: p for p in sitemap_products
        }
        for p in category_products:
            if p.slug not in seen_slugs:
                seen_slugs[p.slug] = p
        all_products = list(seen_slugs.values())

        # Step 3 — document hub discovery
        hub_docs = self._discover_document_hubs(root, all_products)
        result.doc_hub_urls = sorted({d.url for d in hub_docs})
        result.stats["hub_docs"] = len(hub_docs)

        # Step 4 — attach documents to products
        self._attach_documents(all_products, hub_docs)

        # Step 5 — enrich under-documented products from their own pages
        if all_products:
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
        for path in ("/sitemap.xml", "/sitemap_index.xml", "/sitemap/"):
            xml = self._get_text(root + path)
            if not xml:
                continue
            locs = self._parse_sitemap_xml(xml, root)
            for loc in locs:
                p = self._url_to_product(loc)
                if p:
                    products.append(p)
            if products:
                LOGGER.info("Sitemap at %s → %d products", root + path, len(products))
                break
        return products

    def _parse_sitemap_xml(self, xml_text: str, root: str) -> List[str]:
        urls: List[str] = []
        try:
            root_el = ElementTree.fromstring(xml_text)
        except ElementTree.ParseError:
            return urls

        ns_match = re.match(r"\{([^}]+)\}", root_el.tag)
        ns = ns_match.group(0) if ns_match else ""

        for loc_el in root_el.findall(f".//{ns}loc"):
            loc = (loc_el.text or "").strip()
            if not loc:
                continue
            if loc.endswith(".xml"):
                # Sitemap index — recurse one level
                child_xml = self._get_text(loc)
                if child_xml:
                    urls.extend(self._parse_sitemap_xml(child_xml, root))
            else:
                urls.append(loc)
        return urls

    # ── Step 2: Category pages ────────────────────────────────────────────────

    def _discover_via_category_pages(self, root: str) -> List[DiscoveredProduct]:
        products: List[DiscoveredProduct] = []
        for category, segs in CATEGORY_SEGMENTS.items():
            for seg in segs:
                html = self._get_text_variants(root, f"/{seg}")
                if not html:
                    continue
                found = self._extract_products_from_page(html, f"{root}/{seg}", category, root)
                products.extend(found)
                if found:
                    LOGGER.info("Category page /%s → %d products", seg, len(found))
                break  # first responsive segment wins
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

        if len(parts) < 2:
            return None

        # Find the first category segment in the path
        category: Optional[str] = None
        product_idx: int = -1
        for i, part in enumerate(parts):
            detected = self._detect_category(part)
            if detected:
                category = detected
                if i + 1 < len(parts):
                    product_idx = i + 1
                break

        if not category:
            if hint_category and len(parts) >= 1:
                category = hint_category
                product_idx = len(parts) - 1
            else:
                return None

        if product_idx < 0 or product_idx >= len(parts):
            return None

        slug = parts[product_idx]
        if slug in _NON_PRODUCT_SLUGS or len(slug) < 4:
            return None
        # Skip numeric-only segments and very generic ones
        if re.fullmatch(r"[\d\-]+", slug):
            return None

        name = " ".join(w.capitalize() for w in slug.replace("-", " ").split())
        return DiscoveredProduct(
            name=name, slug=slug, url=url, category=category, source="sitemap",
        )

    def _detect_category(self, segment: str) -> Optional[str]:
        seg = segment.lower()
        for cat, patterns in CATEGORY_URL_PATTERNS:
            if any(pat in seg or seg in pat for pat in patterns):
                return cat
        return None

    # ── Step 3: Document hubs ─────────────────────────────────────────────────

    def _discover_document_hubs(
        self, root: str, products: List[DiscoveredProduct]
    ) -> List[DiscoveredDocument]:
        docs: List[DiscoveredDocument] = []
        probed: set = set()

        # Build category list; if no products found yet, try all categories
        categories = list({p.category for p in products}) or list(CATEGORY_SEGMENTS)

        # First try category-specific patterns
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
                        LOGGER.info("Doc hub %s → %d PDFs", hub_url, len(found))
                        docs.extend(found)
                        break  # found a working pattern for this category/segment

        # Always probe the generic hubs regardless of category
        for generic in ("/downloads/", "/download/", "/documents/", "/resources/"):
            hub_url = root + generic
            if hub_url in probed:
                continue
            probed.add(hub_url)
            html = self._get_text(hub_url)
            if html:
                found = self._extract_pdf_links(html, hub_url)
                if found:
                    LOGGER.info("Generic hub %s → %d PDFs", hub_url, len(found))
                    docs.extend(found)

        # Deduplicate by URL
        seen_urls: set = set()
        unique: List[DiscoveredDocument] = []
        for d in docs:
            if d.url not in seen_urls:
                seen_urls.add(d.url)
                unique.append(d)
        return unique

    def _extract_pdf_links(
        self, html: str, page_url: str
    ) -> List[DiscoveredDocument]:
        soup = BeautifulSoup(html, "lxml")
        docs: List[DiscoveredDocument] = []
        seen: set = set()

        for a in soup.find_all("a", href=True):
            href: str = a["href"].strip()
            abs_url = urljoin(page_url, href)
            lower = abs_url.lower()
            # Accept PDFs and also doc/docx
            if not (lower.endswith(".pdf") or lower.endswith(".doc") or lower.endswith(".docx")):
                if "/pdf/" not in lower:
                    continue
            if abs_url in seen:
                continue
            seen.add(abs_url)

            filename = abs_url.split("?")[0].split("/")[-1].lower().replace("%20", "-")
            anchor_text = a.get_text(strip=True)
            doc_type = self._classify_document(filename, anchor_text)
            product_slug = self._slug_from_filename(filename)

            docs.append(DiscoveredDocument(
                url=abs_url,
                doc_type=doc_type,
                filename=filename,
                product_slug=product_slug,
            ))
        return docs

    def _classify_document(self, filename: str, anchor_text: str = "") -> str:
        combined = (filename + " " + anchor_text).lower()
        for doc_type, hints in DOCUMENT_TYPE_HINTS.items():
            if any(h in combined for h in hints):
                return doc_type
        return "policy_wording"  # Default: insurance PDFs are usually policy wordings

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
            best = self._best_match_product(doc, products)
            if best:
                best.documents.append(doc)

    def _best_match_product(
        self, doc: DiscoveredDocument, products: List[DiscoveredProduct]
    ) -> Optional[DiscoveredProduct]:
        if not products:
            return None

        # Exact slug containment match first
        for p in products:
            if p.slug in doc.product_slug or doc.product_slug in p.slug:
                return p

        # Keyword overlap (≥2 shared tokens)
        doc_words = set(doc.product_slug.split("-")) - {"policy", "wording", "brochure", "pdf", "doc"}
        best, best_score = None, 0
        for p in products:
            prod_words = set(p.slug.split("-"))
            score = len(doc_words & prod_words)
            if score > best_score and score >= 2:
                best, best_score = p, score

        # If only one product, assign all unmatched docs to it
        if best is None and len(products) == 1:
            return products[0]

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
            existing_urls = {d.url for d in product.documents}
            for doc in inline_docs:
                if doc.url not in existing_urls:
                    doc.product_slug = product.slug
                    product.documents.append(doc)
                    existing_urls.add(doc.url)

            time.sleep(self.delay)

    # ── HTTP / Browser helpers ────────────────────────────────────────────────

    def _get_text_variants(self, root: str, path: str) -> Optional[str]:
        """Try a path with and without trailing slash."""
        for variant in (path.rstrip("/") + "/", path.rstrip("/")):
            html = self._get_text(root + variant)
            if html:
                return html
        return None

    def _get_text(self, url: str) -> Optional[str]:
        """Fetch URL content, trying Playwright first if enabled."""
        if self.use_browser and not url.endswith((".pdf", ".doc", ".docx")):
            html = self._get_text_with_browser(url)
            if html:
                return html
            LOGGER.debug("Playwright failed, falling back to requests: %s", url)

        return self._get_text_with_requests(url)

    def _get_text_with_requests(self, url: str) -> Optional[str]:
        try:
            r = self._session.get(url, timeout=self.timeout, allow_redirects=True)
            ct = r.headers.get("Content-Type", "")
            if r.status_code == 200 and ("html" in ct or "xml" in ct or url.endswith(".xml")):
                time.sleep(self.delay)
                return r.text
            if r.status_code == 403:
                LOGGER.debug("BOT-BLOCKED 403: %s", url)
            elif r.status_code not in (200, 404, 301, 302):
                LOGGER.debug("HTTP %d: %s", r.status_code, url)
        except requests.exceptions.ConnectionError:
            LOGGER.debug("UNREACHABLE: %s", url)
        except Exception as exc:
            LOGGER.debug("GET failed %s: %s", url, exc)
        return None

    def _get_text_with_browser(self, url: str) -> Optional[str]:
        """Fetch page with Playwright Chromium to bypass bot protection."""
        if not HAS_PLAYWRIGHT:
            return None
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(
                    headless=True,
                    executable_path=self._chromium,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-accelerated-2d-canvas",
                        "--no-first-run",
                        "--no-zygote",
                        "--disable-gpu",
                    ],
                )
                ctx = browser.new_context(
                    user_agent=UA,
                    viewport={"width": 1280, "height": 800},
                    locale="en-IN",
                    ignore_https_errors=True,
                    extra_http_headers={
                        "Accept-Language": "en-IN,en-US;q=0.9,en;q=0.8",
                    },
                )
                page = ctx.new_page()
                try:
                    resp = page.goto(url, timeout=self.timeout * 1000, wait_until="domcontentloaded")
                    if resp and resp.status == 200:
                        time.sleep(self.delay)
                        return page.content()
                    LOGGER.debug("Browser got HTTP %s for %s", resp.status if resp else "?", url)
                except Exception as exc:
                    LOGGER.debug("Browser navigation failed %s: %s", url, exc)
                finally:
                    ctx.close()
                    browser.close()
        except Exception as exc:
            LOGGER.debug("Browser launch failed: %s", exc)
        return None

    def _probe(self, url: str) -> int:
        """Return HTTP status code for a URL (HEAD-only, for QC dry runs)."""
        try:
            r = self._session.head(url, timeout=self.timeout, allow_redirects=True)
            return r.status_code
        except requests.exceptions.ConnectionError:
            return 0
        except Exception:
            return -1


# ─── Batch runner ─────────────────────────────────────────────────────────────

def run_product_search_all(
    insurers: List[Insurer],
    timeout: int = 20,
    delay: float = 0.5,
    max_insurers: Optional[int] = None,
    use_browser: bool = True,
) -> List[SearchResult]:
    """Run product search on every insurer and return results."""
    if use_browser and not HAS_PLAYWRIGHT:
        LOGGER.warning("Playwright not installed; falling back to requests")
        use_browser = False

    searcher = InsurerProductSearcher(timeout=timeout, delay=delay, use_browser=use_browser)
    subset = insurers[:max_insurers] if max_insurers else insurers

    results: List[SearchResult] = []
    for i, insurer in enumerate(subset, 1):
        LOGGER.info(
            "[%d/%d] %s  %s  [browser=%s]",
            i, len(subset), insurer.name, insurer.website_url, use_browser,
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


# ─── QC helpers ───────────────────────────────────────────────────────────────

def probe_insurer_urls(insurer: Insurer, timeout: int = 10) -> Dict:
    """
    Dry-run: HEAD-probe all candidate URLs for one insurer.
    Returns {url: http_status} for every candidate.
    """
    searcher = InsurerProductSearcher(timeout=timeout)
    root = insurer.website_url.rstrip("/")
    probes: Dict[str, int] = {}

    for path in ("/sitemap.xml", "/sitemap_index.xml", "/robots.txt"):
        probes[root + path] = searcher._probe(root + path)

    for cat, segs in CATEGORY_SEGMENTS.items():
        for seg in segs[:1]:
            for variant in (f"/{seg}/", f"/{seg}"):
                url = root + variant
                if url not in probes:
                    probes[url] = searcher._probe(url)

    for cat, segs in CATEGORY_SEGMENTS.items():
        for seg in segs[:1]:
            for pattern in DOC_HUB_PATTERNS[:6]:
                url = root + pattern.format(cat=seg)
                if url not in probes:
                    probes[url] = searcher._probe(url)

    return {
        "insurer_id": insurer.insurer_id,
        "insurer_name": insurer.name,
        "website": root,
        "probes": probes,
        "accessible":     sum(1 for s in probes.values() if s == 200),
        "blocked_403":    sum(1 for s in probes.values() if s == 403),
        "not_found_404":  sum(1 for s in probes.values() if s == 404),
        "unreachable":    sum(1 for s in probes.values() if s in (0, -1)),
    }


def qc_report(results: List[SearchResult]) -> Dict:
    """Aggregate QC metrics across all search results."""
    crawled      = [r for r in results if not r.errors]
    no_url       = [r for r in results if "no_website_url" in r.errors]
    errored      = [r for r in results if r.errors and "no_website_url" not in r.errors]
    all_products = [p for r in results for p in r.products]
    with_docs    = [p for p in all_products if p.documents]

    by_category: Dict[str, int] = {}
    for p in all_products:
        by_category[p.category] = by_category.get(p.category, 0) + 1

    return {
        "total_insurers":     len(results),
        "insurers_crawled":   len(crawled),
        "insurers_no_url":    len(no_url),
        "insurers_errored":   len(errored),
        "total_products":     len(all_products),
        "products_with_docs": len(with_docs),
        "doc_coverage_pct":   round(len(with_docs) / max(len(all_products), 1) * 100, 1),
        "by_category":        by_category,
        "per_insurer": [
            {
                "insurer":    r.insurer_name,
                "products":   len(r.products),
                "docs":       sum(len(p.documents) for p in r.products),
                "categories": sorted({p.category for p in r.products}),
                "errors":     r.errors,
                "stats":      r.stats,
            }
            for r in results
        ],
    }
