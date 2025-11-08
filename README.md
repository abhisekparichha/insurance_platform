# insurance_platform

Tools for crawling, parsing, and organizing IRDAI insurer listings.

## Prerequisites

- Python 3.10+
- `pip` for dependency management

Install dependencies:

```
pip install -r requirements.txt
```

## Usage

Run the crawler to fetch and organize the data for general, life, and health insurers:

```
python3 -m src.insurer_crawler
```

Results are written to the `data/` directory:

- `data/raw/` contains the unmodified tables from each page (`*.json`, `*.csv`).
- `data/*_normalized.*` files contain cleaned data per category.
- `data/insurers.json` and `data/insurers.csv` aggregate all categories, including crawl metadata.

Each normalized record includes a `website_url` field when a URL can be inferred from the source content.
