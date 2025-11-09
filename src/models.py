"""Domain models for insurers, products, and policy documents."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from .utils import clean_text, slugify


@dataclass
class Insurer:
    """Normalized representation of an insurer row from IRDAI."""

    insurer_id: str
    name: str
    category: str
    source_url: str
    website_url: str = ""
    metadata: Dict[str, str] = field(default_factory=dict)
    raw_record: Dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_normalized_row(
        cls, row: Dict[str, str], *, source_url: str
    ) -> "Insurer":
        name = clean_text(row.get("insurer_name", ""))
        category = row.get("category", "")
        insurer_id = slugify(f"{category}-{name}")
        metadata = {key: value for key, value in row.items() if value and key not in {"category"}}
        website = row.get("website_url") or row.get("website") or ""
        return cls(
            insurer_id=insurer_id,
            name=name,
            category=category,
            source_url=source_url,
            website_url=website,
            metadata=metadata,
            raw_record=row,
        )


@dataclass
class ProductDocument:
    """Metadata for product specific documents such as brochures and policy wordings."""

    document_id: str
    insurer_id: str
    document_type: str
    source_url: str
    product_id: Optional[str] = None
    local_path: Optional[Path] = None
    content_hash: Optional[str] = None
    extracted_text: str = ""
    metadata: Dict[str, str] = field(default_factory=dict)


@dataclass
class PolicySectionExtraction:
    """Normalized policy section against a canonical schema."""

    product_id: str
    category: str
    schema_version: str
    section_name: str
    content: str
    confidence: float
    source_document_id: Optional[str] = None


@dataclass
class Product:
    """A single insurance product offered by an insurer."""

    product_id: str
    insurer_id: str
    name: str
    category: str
    product_url: str
    description: str = ""
    discovered_from_url: str = ""
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, str] = field(default_factory=dict)
    documents: List[ProductDocument] = field(default_factory=list)
    policy_sections: List[PolicySectionExtraction] = field(default_factory=list)

    def merge_documents(self, new_documents: Iterable[ProductDocument]) -> None:
        existing_ids = {doc.document_id for doc in self.documents}
        for document in new_documents:
            if document.document_id not in existing_ids:
                self.documents.append(document)
                existing_ids.add(document.document_id)

    def extend_policy_sections(
        self, sections: Iterable[PolicySectionExtraction]
    ) -> None:
        self.policy_sections.extend(sections)


@dataclass
class ProductCrawlResult:
    """Outcome of crawling a single insurer website."""

    insurer: Insurer
    products: List[Product]
    documents: List[ProductDocument]
    stats: Dict[str, int] = field(default_factory=dict)
