# insurance_platform

Tools for crawling, parsing, and organizing IRDAI insurer listings, insurer product catalogs, and policy documents.

## Prerequisites

- Python 3.10+
- `pip` for dependency management

Install dependencies:

```
pip install -r requirements.txt
```

## Usage

Run the IRDAI directory crawler to fetch and organize the data for general, life, and health insurers:

```
python3 -m src.insurer_crawler
```

To execute the full pipeline (insurers → products → documents → normalized schemas → SQLite database):

```
python3 -m src.pipeline
```

Key options:

- `--max-insurers N` limits how many insurers to process (useful for debugging).
- `--max-pages-per-insurer N` controls the crawl breadth per insurer site.
- `--no-download-documents` skips downloading policy PDFs while still cataloging links.

Results are written to the `data/` directory:

- `data/raw/` contains the unmodified tables from each page (`*.json`, `*.csv`).
- `data/*_normalized.*` files contain cleaned data per category.
- `data/insurers.json` and `data/insurers.csv` aggregate all categories, including crawl metadata.
- `data/documents/` stores downloaded brochures and policy wordings (if enabled).
- `data/insurance.db` is an SQLite database populated with insurers, products, documents, and normalized policy sections.

Each normalized insurer record includes a `website_url` field when a URL can be inferred from the source content. Product records are tagged with inferred categories (health, motor, life_term, life_savings) and any extracted documents are parsed and mapped to canonical policy schemas where possible.
