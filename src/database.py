"""SQLite persistence layer for insurer, product, and policy data."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Iterator, Optional

from .models import (
    Insurer,
    PolicySectionExtraction,
    Product,
    ProductDocument,
)
from .utils import clean_text


class InsuranceRepository:
    """Repository abstraction over an SQLite database."""

    def __init__(self, db_path: Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON;")

    def close(self) -> None:
        self.conn.close()

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Cursor]:
        cursor = self.conn.cursor()
        try:
            yield cursor
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise
        finally:
            cursor.close()

    def initialize(self) -> None:
        """Create database tables if they do not exist."""
        statements = [
            """
            CREATE TABLE IF NOT EXISTS insurers (
                insurer_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                source_url TEXT NOT NULL,
                website_url TEXT,
                metadata_json TEXT,
                raw_json TEXT,
                updated_at TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS products (
                product_id TEXT PRIMARY KEY,
                insurer_id TEXT NOT NULL,
                name TEXT NOT NULL,
                category TEXT,
                product_url TEXT,
                description TEXT,
                discovered_from_url TEXT,
                tags_json TEXT,
                metadata_json TEXT,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (insurer_id) REFERENCES insurers(insurer_id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS product_documents (
                document_id TEXT PRIMARY KEY,
                product_id TEXT,
                insurer_id TEXT NOT NULL,
                document_type TEXT NOT NULL,
                source_url TEXT NOT NULL,
                local_path TEXT,
                content_hash TEXT,
                extracted_text TEXT,
                metadata_json TEXT,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
                FOREIGN KEY (insurer_id) REFERENCES insurers(insurer_id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS policy_sections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id TEXT NOT NULL,
                category TEXT NOT NULL,
                schema_version TEXT NOT NULL,
                section_name TEXT NOT NULL,
                section_body TEXT,
                confidence REAL,
                source_document_id TEXT,
                UNIQUE (product_id, section_name),
                FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
                FOREIGN KEY (source_document_id) REFERENCES product_documents(document_id) ON DELETE SET NULL
            )
            """,
        ]
        with self.transaction() as cursor:
            for statement in statements:
                cursor.execute(statement)

    def upsert_insurers(self, insurers: Iterable[Insurer]) -> None:
        """Insert or update insurer records."""
        rows = [
            {
                "insurer_id": insurer.insurer_id,
                "name": clean_text(insurer.name),
                "category": insurer.category,
                "source_url": insurer.source_url,
                "website_url": insurer.website_url,
                "metadata_json": self._dump_json(insurer.metadata),
                "raw_json": self._dump_json(insurer.raw_record),
                "updated_at": self._timestamp(),
            }
            for insurer in insurers
        ]
        if not rows:
            return
        with self.transaction() as cursor:
            cursor.executemany(
                """
                INSERT INTO insurers (
                    insurer_id, name, category, source_url, website_url,
                    metadata_json, raw_json, updated_at
                )
                VALUES (
                    :insurer_id, :name, :category, :source_url, :website_url,
                    :metadata_json, :raw_json, :updated_at
                )
                ON CONFLICT(insurer_id) DO UPDATE SET
                    name=excluded.name,
                    category=excluded.category,
                    website_url=excluded.website_url,
                    metadata_json=excluded.metadata_json,
                    raw_json=excluded.raw_json,
                    updated_at=excluded.updated_at
                """,
                rows,
            )

    def upsert_products(self, products: Iterable[Product]) -> None:
        """Insert or update product records."""
        rows = [
            {
                "product_id": product.product_id,
                "insurer_id": product.insurer_id,
                "name": clean_text(product.name),
                "category": product.category,
                "product_url": product.product_url,
                "description": clean_text(product.description),
                "discovered_from_url": product.discovered_from_url,
                "tags_json": self._dump_json(product.tags),
                "metadata_json": self._dump_json(product.metadata),
                "updated_at": self._timestamp(),
            }
            for product in products
        ]
        if not rows:
            return
        with self.transaction() as cursor:
            cursor.executemany(
                """
                INSERT INTO products (
                    product_id, insurer_id, name, category, product_url,
                    description, discovered_from_url, tags_json, metadata_json, updated_at
                )
                VALUES (
                    :product_id, :insurer_id, :name, :category, :product_url,
                    :description, :discovered_from_url, :tags_json, :metadata_json, :updated_at
                )
                ON CONFLICT(product_id) DO UPDATE SET
                    name=excluded.name,
                    category=excluded.category,
                    product_url=excluded.product_url,
                    description=excluded.description,
                    discovered_from_url=excluded.discovered_from_url,
                    tags_json=excluded.tags_json,
                    metadata_json=excluded.metadata_json,
                    updated_at=excluded.updated_at
                """,
                rows,
            )

    def upsert_documents(self, documents: Iterable[ProductDocument]) -> None:
        """Insert or update product document metadata."""
        rows = [
            {
                "document_id": document.document_id,
                "product_id": document.product_id,
                "insurer_id": document.insurer_id,
                "document_type": document.document_type,
                "source_url": document.source_url,
                "local_path": str(document.local_path) if document.local_path else None,
                "content_hash": document.content_hash,
                "extracted_text": document.extracted_text,
                "metadata_json": self._dump_json(document.metadata),
                "updated_at": self._timestamp(),
            }
            for document in documents
        ]
        if not rows:
            return
        with self.transaction() as cursor:
            cursor.executemany(
                """
                INSERT INTO product_documents (
                    document_id, product_id, insurer_id, document_type, source_url,
                    local_path, content_hash, extracted_text, metadata_json, updated_at
                )
                VALUES (
                    :document_id, :product_id, :insurer_id, :document_type, :source_url,
                    :local_path, :content_hash, :extracted_text, :metadata_json, :updated_at
                )
                ON CONFLICT(document_id) DO UPDATE SET
                    product_id=excluded.product_id,
                    document_type=excluded.document_type,
                    source_url=excluded.source_url,
                    local_path=excluded.local_path,
                    content_hash=excluded.content_hash,
                    extracted_text=excluded.extracted_text,
                    metadata_json=excluded.metadata_json,
                    updated_at=excluded.updated_at
                """,
                rows,
            )

    def upsert_policy_sections(
        self, sections: Iterable[PolicySectionExtraction]
    ) -> None:
        """Insert or update normalized policy sections."""
        rows = [
            {
                "product_id": section.product_id,
                "category": section.category,
                "schema_version": section.schema_version,
                "section_name": section.section_name,
                "section_body": section.content,
                "confidence": section.confidence,
                "source_document_id": section.source_document_id,
            }
            for section in sections
        ]
        if not rows:
            return
        with self.transaction() as cursor:
            cursor.executemany(
                """
                INSERT INTO policy_sections (
                    product_id, category, schema_version, section_name,
                    section_body, confidence, source_document_id
                )
                VALUES (
                    :product_id, :category, :schema_version, :section_name,
                    :section_body, :confidence, :source_document_id
                )
                ON CONFLICT(product_id, section_name) DO UPDATE SET
                    section_body=excluded.section_body,
                    confidence=excluded.confidence,
                    schema_version=excluded.schema_version,
                    source_document_id=excluded.source_document_id
                """,
                rows,
            )

    @staticmethod
    def _timestamp() -> str:
        return datetime.now(timezone.utc).isoformat(timespec="seconds")

    @staticmethod
    def _dump_json(payload: Optional[object]) -> Optional[str]:
        if payload is None:
            return None
        if isinstance(payload, (str, bytes)):
            return str(payload)
        return json.dumps(payload, ensure_ascii=False, sort_keys=True)
