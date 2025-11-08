"""Crawler and parser for IRDAI insurer listings.

Fetches the public tables for general, life, and health insurers, parses them
into structured data, and persists both raw and normalized datasets.
"""
from __future__ import annotations

import csv
import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import requests
from bs4 import BeautifulSoup, Tag

LOGGER = logging.getLogger(__name__)
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
)

WHITESPACE_RE = re.compile(r"\s+")
URL_RE = re.compile(r"(https?://[^\s,;]+|www\.[^\s,;]+)", re.IGNORECASE)


@dataclass(frozen=True)
class CategoryConfig:
    """Configuration for crawling a single insurer category table."""

    key: str
    url: str
    table_id: str
    column_mapping: Dict[str, str]
    description: str


CATEGORIES: Sequence[CategoryConfig] = (
    CategoryConfig(
        key="general",
        url="https://irdai.gov.in/list-of-general-insurers",
        table_id="nonlifeinsurers",
        column_mapping={
            "Sr. No.": "serial_no",
            "Insurer": "insurer_name",
            "Registered/Corporate Address": "address",
            "CEO/CMD": "leader_name",
            "Appointed Actuary": "appointed_actuary",
            "Telephone no./Fax no./ Web address of the Insurer": "contacts",
            "Website": "website",
        },
        description="Non-life (general) insurers registered with IRDAI.",
    ),
    CategoryConfig(
        key="life",
        url="https://irdai.gov.in/list-of-life-insurers1",
        table_id="lifeinsurers",
        column_mapping={
            "Sl.No": "serial_no",
            "Name": "insurer_name",
            "Regn. No": "registration_number",
            "Address": "address",
            "Name of the Chairman / MD & CEO": "leader_name",
            "Designation": "leader_designation",
            "Email of Chairman/CEO/MD": "leader_email",
            "Appointed Actuary": "appointed_actuary",
            "Telephone/Fax": "contacts",
            "Email-id of Insurer": "insurer_email",
        },
        description="Life insurers registered with IRDAI.",
    ),
    CategoryConfig(
        key="health",
        url="https://irdai.gov.in/list-of-health-insurers",
        table_id="healthl",
        column_mapping={
            "Sr. No.": "serial_no",
            "Insurer": "insurer_name",
            "Registered/Corporate Address": "address",
            "CEO/CMD": "leader_name",
            "Appointed Actuary": "appointed_actuary",
            "Telephone no./Fax no./ Web address of the Insurer": "contacts",
            "Website": "website",
        },
        description="Standalone health insurers registered with IRDAI.",
    ),
)


def fetch_html(url: str) -> str:
    """Fetch HTML for a given URL."""
    LOGGER.info("Fetching %s", url)
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    response.raise_for_status()
    return response.text


def clean_text(node: Tag) -> str:
    """Extract and normalize text content from a BeautifulSoup tag."""
    text = node.get_text(separator=" ", strip=True)
    return WHITESPACE_RE.sub(" ", text)


def parse_table(html: str, table_id: str) -> Tuple[List[str], List[Dict[str, str]]]:
    """Parse a table and return headers and row dicts keyed by header."""
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", id=table_id)
    if table is None:
        raise ValueError(f"Table with id '{table_id}' not found.")

    thead = table.find("thead")
    if thead is None:
        raise ValueError(f"No thead found for table '{table_id}'.")

    header_cells = thead.find_all("th")
    headers = [clean_text(cell) for cell in header_cells]

    tbody = table.find("tbody")
    if tbody is None:
        raise ValueError(f"No tbody found for table '{table_id}'.")

    rows: List[Dict[str, str]] = []
    for tr in tbody.find_all("tr"):
        cells = tr.find_all("td")
        if not cells:
            continue

        values = [clean_text(cell) for cell in cells]
        if not any(values):
            continue

        row = {
            headers[idx]: values[idx] if idx < len(values) else ""
            for idx in range(len(headers))
        }
        rows.append(row)

    LOGGER.info("Parsed %d rows for table '%s'", len(rows), table_id)
    return headers, rows


def write_json(path: Path, payload) -> None:
    """Write JSON payload with UTF-8 encoding."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, indent=2)


def write_csv(path: Path, headers: Sequence[str], rows: Sequence[Dict[str, str]]) -> None:
    """Write rows to CSV with provided headers."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fp:
        writer = csv.DictWriter(fp, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow({header: row.get(header, "") for header in headers})


def normalize_row(
    raw_row: Dict[str, str], mapping: Dict[str, str]
) -> Dict[str, str]:
    """Normalize a row dict based on a column mapping."""
    normalized: Dict[str, str] = {}
    for source, target in mapping.items():
        value = raw_row.get(source, "").strip()
        if value:
            normalized[target] = value
    return normalized


def extract_primary_url(*text_candidates: str) -> str:
    """Extract the first plausible URL from any of the provided text strings."""
    for text in text_candidates:
        if not text:
            continue
        match = URL_RE.search(text)
        if match:
            url = match.group(0)
            url = url.rstrip(").,;")
            if url.lower().startswith("www."):
                url = f"https://{url}"
            return url
    return ""


def build_normalized_rows(
    category: CategoryConfig, raw_rows: Sequence[Dict[str, str]]
) -> List[Dict[str, str]]:
    """Produce normalized rows enriched with metadata."""
    normalized_rows: List[Dict[str, str]] = []
    for raw_row in raw_rows:
        normalized = normalize_row(raw_row, category.column_mapping)
        normalized["category"] = category.key
        normalized["source_url"] = category.url

        website_text = normalized.get("website")
        contacts_text = normalized.get("contacts")
        normalized["website_url"] = extract_primary_url(website_text, contacts_text)

        normalized_rows.append(normalized)
    return normalized_rows


def persist_category_data(
    base_dir: Path,
    category: CategoryConfig,
    headers: Sequence[str],
    raw_rows: Sequence[Dict[str, str]],
    normalized_rows: Sequence[Dict[str, str]],
) -> None:
    """Persist raw and normalized datasets for a category."""
    raw_dir = base_dir / "raw"
    write_json(raw_dir / f"{category.key}.json", raw_rows)
    write_csv(raw_dir / f"{category.key}.csv", headers, raw_rows)

    normalized_headers = sorted({key for row in normalized_rows for key in row.keys()})
    write_json(base_dir / f"{category.key}_normalized.json", normalized_rows)
    write_csv(
        base_dir / f"{category.key}_normalized.csv", normalized_headers, normalized_rows
    )


def main(output_root: Path | None = None) -> None:
    """Entry point for crawling and organizing insurer data."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    if output_root is None:
        output_root = Path(__file__).resolve().parent.parent / "data"

    LOGGER.info("Output directory: %s", output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    aggregated_rows: List[Dict[str, str]] = []

    for category in CATEGORIES:
        html = fetch_html(category.url)
        headers, raw_rows = parse_table(html, category.table_id)
        normalized_rows = build_normalized_rows(category, raw_rows)
        persist_category_data(output_root, category, headers, raw_rows, normalized_rows)
        aggregated_rows.extend(normalized_rows)

    crawled_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    dataset = {
        "crawled_at": crawled_at,
        "record_count": len(aggregated_rows),
        "categories": [category.key for category in CATEGORIES],
        "records": aggregated_rows,
    }

    write_json(output_root / "insurers.json", dataset)

    aggregated_headers = sorted({key for row in aggregated_rows for key in row.keys()})
    write_csv(output_root / "insurers.csv", aggregated_headers, aggregated_rows)

    LOGGER.info("Crawling complete: %d total records", len(aggregated_rows))


if __name__ == "__main__":
    main()
