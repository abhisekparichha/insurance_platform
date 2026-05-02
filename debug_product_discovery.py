#!/usr/bin/env python3
"""Debug script to analyze why products aren't being discovered."""
import logging
import sqlite3
from pathlib import Path
from src.insurer_product_search import InsurerProductSearcher
from src.models import Insurer

# Setup detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(levelname)s: %(message)s"
)
logger = logging.getLogger(__name__)

DB_PATH = Path("data/insurance.db")

# Test on one insurer first
TEST_INSURER_ID = "general-hdfc-ergo-general-insurance-company-limited"

def get_insurer_by_id(insurer_id: str) -> Insurer:
    """Load insurer from database."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT insurer_id, name, category, website_url FROM insurers WHERE insurer_id=?", (insurer_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        raise ValueError(f"Insurer not found: {insurer_id}")
    return Insurer(
        insurer_id=row[0],
        name=row[1],
        category=row[2],
        source_url="debug",
        website_url=row[3],
    )

def debug_discovery():
    """Step-by-step debug of product discovery."""
    print("\n" + "="*80)
    print("DEBUGGING PRODUCT DISCOVERY")
    print("="*80 + "\n")

    insurer = get_insurer_by_id(TEST_INSURER_ID)
    print(f"Testing: {insurer.name}")
    print(f"Website: {insurer.website_url}\n")

    searcher = InsurerProductSearcher(timeout=20, delay=0.5, use_browser=True)
    root = insurer.website_url.rstrip("/")

    # Step 1: Test sitemap discovery
    print("="*80)
    print("STEP 1: SITEMAP DISCOVERY")
    print("="*80 + "\n")

    for path in ["/sitemap.xml", "/sitemap_index.xml"]:
        url = root + path
        print(f"Trying: {url}")
        xml = searcher._get_text(url)
        if xml:
            print(f"✅ Found! ({len(xml)} chars)")
            # Try to parse
            try:
                from xml.etree import ElementTree
                root_el = ElementTree.fromstring(xml)
                locs = root_el.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
                print(f"   Contains {len(locs)} URL entries")
                for loc in locs[:5]:
                    print(f"   - {loc.text}")
                if len(locs) > 5:
                    print(f"   ... and {len(locs) - 5} more")
            except Exception as e:
                print(f"   Error parsing: {e}")
        else:
            print(f"❌ Not found")
        print()

    # Step 2: Test category pages
    print("="*80)
    print("STEP 2: CATEGORY PAGES")
    print("="*80 + "\n")

    test_paths = [
        "/health-insurance/",
        "/health-insurance",
        "/motor-insurance/",
        "/motor-insurance",
        "/travel-insurance/",
        "/travel-insurance",
    ]

    for path in test_paths:
        url = root + path
        print(f"Trying: {url}")
        html = searcher._get_text(url)
        if html:
            print(f"✅ Found! ({len(html)} chars)")
            # Find all links
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "lxml")
            links = [a.get("href") for a in soup.find_all("a", href=True)]
            print(f"   Contains {len(links)} links")
            # Show some internal links
            internal_links = [l for l in links if l.startswith("/") or l.startswith("http")][:10]
            for link in internal_links[:5]:
                print(f"   - {link}")
        else:
            print(f"❌ Not found (HTTP not 200)")
        print()

    # Step 3: Test document hubs
    print("="*80)
    print("STEP 3: DOCUMENT HUB DISCOVERY")
    print("="*80 + "\n")

    from src.insurer_product_search import DOC_HUB_PATTERNS, CATEGORY_SEGMENTS

    for category, segments in CATEGORY_SEGMENTS.items():
        for segment in segments[:1]:
            for pattern in DOC_HUB_PATTERNS[:3]:
                hub_url = root + pattern.format(cat=segment)
                print(f"Trying: {hub_url}")
                html = searcher._get_text(hub_url)
                if html:
                    print(f"✅ Found! ({len(html)} chars)")
                    # Look for PDFs
                    from bs4 import BeautifulSoup
                    soup = BeautifulSoup(html, "lxml")
                    pdfs = [a.get("href") for a in soup.find_all("a", href=True)
                            if a.get("href", "").lower().endswith(".pdf")]
                    print(f"   Contains {len(pdfs)} PDF links")
                    for pdf in pdfs[:3]:
                        print(f"   - {pdf}")
                else:
                    print(f"❌ Not found (HTTP not 200)")
                print()
                if html:
                    break  # Found one, stop trying other patterns for this category

if __name__ == "__main__":
    debug_discovery()
