"""Reprocess existing insurers/products/documents without crawling or downloads."""
from __future__ import annotations

import argparse
import copy
import csv
import json
import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence

from .database import InsuranceRepository
from .document_processing import (
    DocumentProcessor,
    DocumentProcessorConfig,
    PolicyNormalizer,
    SUPPORTED_DOCUMENT_EXTENSIONS,
)
from .models import Product, ProductDocument
from .utils import compute_content_hash, slugify

LOGGER = logging.getLogger(__name__)


@dataclass
class ReprocessConfig:
    data_dir: Path
    db_path: Path
    documents_dir: Path
    insurer_filters: Sequence[str]
    max_documents: Optional[int]
    only_missing_text: bool
    skip_policy_sections: bool


def parse_args(argv: Optional[Sequence[str]] = None) -> ReprocessConfig:
    parser = argparse.ArgumentParser(
        description=(
            "Refresh parsed text, document metadata, and policy sections using existing "
            "database rows and local files. No crawling or downloads are performed."
        )
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("data"),
        help="Directory containing normalized CSV/JSON artifacts (default: %(default)s).",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=Path("data") / "insurance.db",
        help="Path to insurance SQLite database (default: %(default)s).",
    )
    parser.add_argument(
        "--documents-dir",
        type=Path,
        default=Path("data") / "documents",
        help="Directory with downloaded policy documents (default: %(default)s).",
    )
    parser.add_argument(
        "--insurer",
        action="append",
        default=[],
        help="Limit processing to specific insurer IDs or name substrings (case insensitive).",
    )
    parser.add_argument(
        "--max-documents",
        type=int,
        default=None,
        help="Process at most N documents (useful for debugging).",
    )
    parser.add_argument(
        "--only-missing-text",
        action="store_true",
        help="Only reprocess documents that do not already have extracted text.",
    )
    parser.add_argument(
        "--skip-policy-sections",
        action="store_true",
        help="Skip regeneration of normalized policy sections.",
    )
    args = parser.parse_args(argv)
    return ReprocessConfig(
        data_dir=args.data_dir,
        db_path=args.db,
        documents_dir=args.documents_dir,
        insurer_filters=args.insurer,
        max_documents=args.max_documents,
        only_missing_text=args.only_missing_text,
        skip_policy_sections=args.skip_policy_sections,
    )


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    config = parse_args()

    repository = InsuranceRepository(config.db_path)
    repository.initialize()

    try:
        stats = reprocess_assets(repository, config)
    finally:
        repository.close()

    LOGGER.info(
        "Reprocess complete: parsed=%d, missing=%d, unsupported=%d, policy_sections=%d",
        stats.get("documents_processed", 0),
        stats.get("documents_missing", 0),
        stats.get("documents_skipped", 0),
        stats.get("sections_written", 0),
    )


def reprocess_assets(repository: InsuranceRepository, config: ReprocessConfig) -> Dict[str, int]:
    documents_dir = config.documents_dir
    data_dir = config.data_dir
    documents_dir.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)

    insurer_lookup = load_insurer_names(repository)
    allowed_insurer_ids = resolve_insurer_filters(insurer_lookup, config.insurer_filters)
    if allowed_insurer_ids:
        LOGGER.info("Limiting processing to %d insurer(s)", len(allowed_insurer_ids))

    products = load_products(repository, allowed_insurer_ids)
    if not products:
        LOGGER.warning("No products matched the supplied filters.")

    documents = load_documents(
        repository,
        allowed_insurer_ids=allowed_insurer_ids,
        only_missing_text=config.only_missing_text,
    )
    if config.max_documents is not None:
        documents = documents[: config.max_documents]

    LOGGER.info(
        "Loaded %d documents for %d products across %d insurers",
        len(documents),
        len({doc.product_id for doc in documents if doc.product_id}),
        len({doc.insurer_id for doc in documents}),
    )

    processor = DocumentProcessor(
        DocumentProcessorConfig(base_dir=documents_dir, download_documents=False)
    )
    normalizer = PolicyNormalizer()

    mappings: List[dict] = []
    pending_downloads: List[dict] = []
    stats: Dict[str, int] = defaultdict(int)

    for document in documents:
        insurer_name = insurer_lookup.get(document.insurer_id, "")
        local_path = resolve_local_path(document, documents_dir)
        if not local_path or not local_path.exists():
            stats["documents_missing"] += 1
            pending_downloads.append(
                build_pending_record(document, insurer_name, products.get(document.product_id or ""))
            )
            continue

        extension = local_path.suffix.lower()
        if extension not in SUPPORTED_DOCUMENT_EXTENSIONS:
            LOGGER.debug(
                "Skipping %s (%s) due to unsupported extension %s",
                document.document_id,
                document.insurer_id,
                extension or "<unknown>",
            )
            stats["documents_skipped"] += 1
            continue

        document.local_path = local_path
        document.metadata.setdefault("extension", extension)
        document.metadata.setdefault("content_type", SUPPORTED_DOCUMENT_EXTENSIONS[extension])

        content = local_path.read_bytes()
        document.content_hash = compute_content_hash(content)
        document.extracted_text = processor._extract_text(local_path, extension)  # pylint: disable=protected-access

        repository.upsert_documents([document])
        stats["documents_processed"] += 1

        product = products.get(document.product_id or "")
        if product and not config.skip_policy_sections:
            sections = normalizer.normalize(product, document)
            if sections:
                repository.upsert_policy_sections(sections)
                stats["sections_written"] += len(sections)

        mappings.append(build_mapping_record(document, product, insurer_name))

    persist_document_mappings(mappings, data_dir)
    persist_download_queue(pending_downloads, data_dir)

    return stats


def load_insurer_names(repository: InsuranceRepository) -> Dict[str, str]:
    rows = repository.conn.execute("SELECT insurer_id, name FROM insurers").fetchall()
    return {row["insurer_id"]: row["name"] for row in rows}


def resolve_insurer_filters(
    insurer_lookup: Dict[str, str],
    filters: Sequence[str],
) -> List[str]:
    if not filters:
        return []
    resolved: set[str] = set()
    for raw_filter in filters:
        needle = raw_filter.strip().lower()
        if not needle:
            continue
        for insurer_id, name in insurer_lookup.items():
            if (
                insurer_id.lower() == needle
                or needle in insurer_id.lower()
                or needle in name.lower()
            ):
                resolved.add(insurer_id)
    if not resolved:
        LOGGER.warning(
            "No insurer IDs matched the provided filters: %s",
            ", ".join(filters),
        )
    return sorted(resolved)


def load_products(
    repository: InsuranceRepository,
    allowed_insurer_ids: Sequence[str],
) -> Dict[str, Product]:
    query = "SELECT * FROM products"
    params: List[str] = []
    if allowed_insurer_ids:
        placeholders = ",".join("?" for _ in allowed_insurer_ids)
        query += f" WHERE insurer_id IN ({placeholders})"
        params.extend(allowed_insurer_ids)

    rows = repository.conn.execute(query, params).fetchall()
    products: Dict[str, Product] = {}
    for row in rows:
        product = Product(
            product_id=row["product_id"],
            insurer_id=row["insurer_id"],
            name=row["name"],
            category=row["category"] or "",
            product_url=row["product_url"] or "",
            description=row["description"] or "",
            discovered_from_url=row["discovered_from_url"] or "",
            tags=_loads_json(row["tags_json"], default=[]),
            metadata=_loads_json(row["metadata_json"], default={}),
        )
        products[product.product_id] = product
    return products


def load_documents(
    repository: InsuranceRepository,
    allowed_insurer_ids: Sequence[str],
    only_missing_text: bool,
) -> List[ProductDocument]:
    query = "SELECT * FROM product_documents"
    params: List[str] = []
    filters: List[str] = []
    if allowed_insurer_ids:
        placeholders = ",".join("?" for _ in allowed_insurer_ids)
        filters.append(f"insurer_id IN ({placeholders})")
        params.extend(allowed_insurer_ids)
    if only_missing_text:
        filters.append("(extracted_text IS NULL OR extracted_text = '')")

    if filters:
        query += " WHERE " + " AND ".join(filters)

    query += " ORDER BY updated_at DESC"

    rows = repository.conn.execute(query, params).fetchall()
    documents: List[ProductDocument] = []
    for row in rows:
        document = ProductDocument(
            document_id=row["document_id"],
            insurer_id=row["insurer_id"],
            document_type=row["document_type"],
            source_url=row["source_url"],
            product_id=row["product_id"],
            local_path=Path(row["local_path"]) if row["local_path"] else None,
            content_hash=row["content_hash"],
            extracted_text=row["extracted_text"] or "",
            metadata=_loads_json(row["metadata_json"], default={}),
        )
        documents.append(document)
    return documents


def resolve_local_path(document: ProductDocument, documents_dir: Path) -> Optional[Path]:
    if document.local_path:
        path = Path(document.local_path)
        if path.exists():
            return path
    extension = document.metadata.get("extension")
    if not extension:
        extension = Path(document.source_url).suffix.lower() or ".pdf"
    if not extension.startswith("."):
        extension = f".{extension}"
    fallback_name = slugify(document.document_id) or document.document_id
    candidate = documents_dir / document.insurer_id / f"{fallback_name}{extension.lower()}"
    return candidate


def build_mapping_record(
    document: ProductDocument,
    product: Optional[Product],
    insurer_name: str,
) -> dict:
    return {
        "insurer_id": document.insurer_id,
        "insurer_name": insurer_name,
        "product_id": document.product_id or "",
        "product_name": product.name if product else "",
        "document_id": document.document_id,
        "document_type": document.document_type,
        "source_url": document.source_url,
        "local_path": str(document.local_path) if document.local_path else "",
        "anchor_text": document.metadata.get("anchor_text", ""),
        "discovered_from_url": document.metadata.get("page_url", ""),
        "discovery_method": document.metadata.get("discovery_method", ""),
    }


def build_pending_record(
    document: ProductDocument,
    insurer_name: str,
    product: Optional[Product],
) -> dict:
    return {
        "insurer_id": document.insurer_id,
        "insurer_name": insurer_name,
        "document_id": document.document_id,
        "document_type": document.document_type,
        "product_id": document.product_id or "",
        "product_name": product.name if product else "",
        "source_url": document.source_url,
        "page_url": document.metadata.get("page_url", ""),
        "anchor_text": document.metadata.get("anchor_text", ""),
        "discovery_method": document.metadata.get("discovery_method", ""),
        "extension": document.metadata.get("extension", ""),
    }


def persist_document_mappings(mappings: Iterable[dict], data_dir: Path) -> None:
    mappings = list(mappings)
    if not mappings:
        LOGGER.info("No document mappings to persist.")
        return
    json_path = data_dir / "product_document_mappings.json"
    csv_path = data_dir / "product_document_mappings.csv"
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "record_count": len(mappings),
        "records": mappings,
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    headers = sorted({key for mapping in mappings for key in mapping.keys()})
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers)
        writer.writeheader()
        for mapping in mappings:
            writer.writerow(mapping)
    LOGGER.info("Persisted %d document mapping rows to %s and %s", len(mappings), json_path, csv_path)


def persist_download_queue(queue: Iterable[dict], data_dir: Path) -> None:
    queue = list(queue)
    output_path = data_dir / "document_download_queue.json"
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "document_count": len(queue),
        "documents": queue,
    }
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    LOGGER.info("Recorded %d pending download entries to %s", len(queue), output_path)


def _loads_json(value: Optional[str], default):
    if value in (None, ""):
        return copy.deepcopy(default)
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return copy.deepcopy(default)


if __name__ == "__main__":
    main()
