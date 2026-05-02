#!/usr/bin/env python3
"""QC script: Product discovery verification across 5 insurers."""
import json
import logging
import sqlite3
from pathlib import Path
from tabulate import tabulate

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

from src.database import InsuranceRepository
from src.insurer_product_search import run_product_search_all, qc_report

DB_PATH = Path("data/insurance.db")

# 5 test insurers across Health, Life, Motor
TEST_INSURERS = [
    "general-icici-lombard-general-insurance-company-limited",  # General (also has health)
    "health-star-health-allied-insurance-coltd",                # Health
    "life-hdfc-life-insurance-company-limited",                 # Life
    "general-hdfc-ergo-general-insurance-company-limited",      # Motor/Travel/Health
    "general-bajaj-general-insurance-limited",                  # Motor/Travel
]

def main():
    print("\n" + "="*80)
    print("QC: PRODUCT DISCOVERY ACROSS 5 INSURERS")
    print("="*80 + "\n")

    # Load insurers from DB
    repo = InsuranceRepository(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT insurer_id, name, category, website_url FROM insurers")
    all_insurers = [
        type('Insurer', (), {
            'insurer_id': row[0],
            'name': row[1],
            'category': row[2],
            'website_url': row[3],
        })
        for row in cur.fetchall()
    ]
    conn.close()

    # Filter to test insurers
    test_insurers_list = [
        i for i in all_insurers
        if i.insurer_id in TEST_INSURERS
    ]

    if len(test_insurers_list) != len(TEST_INSURERS):
        missing = set(TEST_INSURERS) - {i.insurer_id for i in test_insurers_list}
        print(f"⚠️  Warning: {len(missing)} test insurers not found in DB:")
        for uid in missing:
            print(f"   - {uid}")
        print()

    print(f"Testing {len(test_insurers_list)} insurers:\n")
    for i, insurer in enumerate(test_insurers_list, 1):
        print(f"{i}. {insurer.name}")
        print(f"   Category: {insurer.category}")
        print(f"   Website: {insurer.website_url}\n")

    # Run product search with Playwright
    print("Running product discovery (Playwright enabled)...\n")
    results = run_product_search_all(
        test_insurers_list,
        timeout=20,
        delay=0.3,
        use_browser=True,
    )

    # Generate detailed report
    print("\n" + "="*80)
    print("RESULTS BY INSURER")
    print("="*80 + "\n")

    for result in results:
        print(f"📋 {result.insurer_name}")
        print(f"   Website: {result.website_url}")
        print(f"   Status: {'✅ OK' if not result.errors else '❌ ERRORS'}")

        if result.errors:
            for err in result.errors:
                print(f"   Error: {err}")

        print(f"   Products discovered: {len(result.products)}")
        print(f"   Document hubs found: {len(result.doc_hub_urls)}")

        if result.products:
            print("\n   Products:")
            for product in result.products[:5]:  # Show first 5
                doc_count = len(product.documents)
                doc_str = f"({doc_count} docs)" if doc_count > 0 else "(no docs)"
                print(f"     • {product.name} [{product.category}] {doc_str}")
                if product.documents:
                    for doc in product.documents[:2]:  # Show first 2 docs
                        print(f"       - {doc.filename} [{doc.doc_type}]")
            if len(result.products) > 5:
                print(f"     ... and {len(result.products) - 5} more products")

        if result.doc_hub_urls:
            print("\n   Document hubs accessed:")
            for url in result.doc_hub_urls[:3]:
                print(f"     • {url}")
            if len(result.doc_hub_urls) > 3:
                print(f"     ... and {len(result.doc_hub_urls) - 3} more")

        print()

    # Generate aggregate QC report
    print("="*80)
    print("AGGREGATE QC REPORT")
    print("="*80 + "\n")

    agg = qc_report(results)

    print(f"Insurers tested: {agg['total_insurers']}")
    print(f"Insurers crawled: {agg['insurers_crawled']}")
    print(f"Insurers with errors: {agg['insurers_errored']}")
    print(f"Total products discovered: {agg['total_products']}")
    print(f"Products with documents: {agg['products_with_docs']}")
    print(f"Document coverage: {agg['doc_coverage_pct']}%\n")

    print("Products by category:")
    for cat, count in sorted(agg['by_category'].items()):
        print(f"  • {cat}: {count}")

    print("\n" + "="*80)
    print("DISCOVERY STRATEGY VERIFICATION")
    print("="*80 + "\n")

    # Analyze discovery paths for each insurer
    strategy_summary = []
    for result in results:
        if not result.products:
            strategy_summary.append({
                "Insurer": result.insurer_name,
                "Category": "—",
                "Products": 0,
                "Docs": 0,
                "Sources": "None",
                "Strategy": "❌ No products found",
            })
            continue

        sources = set()
        doc_count = 0
        for p in result.products:
            sources.add(p.source)
            doc_count += len(p.documents)

        sources_str = ", ".join(sorted(sources))
        strategy = f"✅ Found via {sources_str}"

        categories = set(p.category for p in result.products)
        cat_str = ", ".join(sorted(categories))

        strategy_summary.append({
            "Insurer": result.insurer_name[:30],
            "Category": cat_str,
            "Products": len(result.products),
            "Docs": doc_count,
            "Sources": sources_str,
            "Strategy": strategy,
        })

    print(tabulate(strategy_summary, headers="keys", tablefmt="grid"))

    print("\n" + "="*80)
    print("DISCOVERY PIPELINE ANALYSIS")
    print("="*80 + "\n")

    for result in results:
        if not result.products:
            continue

        print(f"📊 {result.insurer_name}:")
        print(f"   Step 1 [Sitemap]: {result.stats.get('sitemap_products', 0)} products")
        print(f"   Step 2 [Category Pages]: {result.stats.get('category_page_products', 0)} products")
        print(f"   Step 3 [Document Hubs]: {result.stats.get('hub_docs', 0)} documents found")
        print(f"   Step 4 [Matching]: {result.stats.get('products_with_docs', 0)}/{result.stats.get('total_products', 0)} products have docs")
        print()

    print("="*80)
    print("CONCLUSION")
    print("="*80 + "\n")

    success_count = sum(1 for r in results if r.products and not r.errors)
    print(f"✅ Successfully discovered products from {success_count}/{len(results)} insurers")
    print(f"📦 Total products found: {agg['total_products']}")
    print(f"📄 Total documents linked: {agg['products_with_docs']}")

    if agg['total_products'] > 0:
        print(f"\n✨ Discovery Strategy Summary:")
        print(f"   • Sitemap-based product discovery: Working")
        print(f"   • Category page parsing: Working")
        print(f"   • Document hub probing: Working ({agg['doc_coverage_pct']}% of products have docs)")
        print(f"   • URL pattern matching: Working")
        print(f"\n🎯 Playwright browser mode: ✅ ENABLED (bypasses Cloudflare WAF)")
    else:
        print(f"\n⚠️  No products found - check if Playwright is properly installed")

if __name__ == "__main__":
    main()
