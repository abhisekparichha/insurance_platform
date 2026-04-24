"""SQLite persistence layer for insurer, product, and policy data."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Iterable, Iterator, List, Optional

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
        self.conn.execute("PRAGMA journal_mode = WAL;")

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

    # ── Schema setup ───────────────────────────────────────────────────────────

    def initialize(self) -> None:
        """Create tables and migrate existing schema."""
        statements = [
            """
            CREATE TABLE IF NOT EXISTS insurers (
                insurer_id   TEXT PRIMARY KEY,
                name         TEXT NOT NULL,
                category     TEXT NOT NULL,
                source_url   TEXT NOT NULL,
                website_url  TEXT,
                metadata_json TEXT,
                raw_json     TEXT,
                updated_at   TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS products (
                product_id          TEXT PRIMARY KEY,
                insurer_id          TEXT NOT NULL,
                name                TEXT NOT NULL,
                category            TEXT,
                product_url         TEXT,
                description         TEXT,
                discovered_from_url TEXT,
                tags_json           TEXT,
                metadata_json       TEXT,
                status              TEXT NOT NULL DEFAULT 'active',
                qc_status           TEXT NOT NULL DEFAULT 'unverified',
                qc_checked_at       TEXT,
                uin                 TEXT,
                updated_at          TEXT NOT NULL,
                FOREIGN KEY (insurer_id) REFERENCES insurers(insurer_id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS product_documents (
                document_id      TEXT PRIMARY KEY,
                product_id       TEXT,
                insurer_id       TEXT NOT NULL,
                document_type    TEXT NOT NULL,
                source_url       TEXT NOT NULL,
                local_path       TEXT,
                content_hash     TEXT,
                extracted_text   TEXT,
                metadata_json    TEXT,
                fetch_status     TEXT NOT NULL DEFAULT 'pending',
                fetch_attempts   INTEGER NOT NULL DEFAULT 0,
                last_fetched_at  TEXT,
                updated_at       TEXT NOT NULL,
                FOREIGN KEY (product_id)  REFERENCES products(product_id)  ON DELETE CASCADE,
                FOREIGN KEY (insurer_id)  REFERENCES insurers(insurer_id)  ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS policy_sections (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id          TEXT NOT NULL,
                category            TEXT NOT NULL,
                schema_version      TEXT NOT NULL,
                section_name        TEXT NOT NULL,
                section_body        TEXT,
                confidence          REAL,
                source_document_id  TEXT,
                UNIQUE (product_id, section_name),
                FOREIGN KEY (product_id)         REFERENCES products(product_id)          ON DELETE CASCADE,
                FOREIGN KEY (source_document_id) REFERENCES product_documents(document_id) ON DELETE SET NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS qc_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_id   TEXT NOT NULL,
                check_type  TEXT NOT NULL,
                result      TEXT NOT NULL,
                detail      TEXT,
                checked_at  TEXT NOT NULL
            )
            """,
        ]
        with self.transaction() as cursor:
            for statement in statements:
                cursor.execute(statement)
        self._migrate()

    def _migrate(self) -> None:
        """Add new columns to existing tables without dropping data."""
        migrations = [
            ("products",          "status",         "TEXT NOT NULL DEFAULT 'active'"),
            ("products",          "qc_status",      "TEXT NOT NULL DEFAULT 'unverified'"),
            ("products",          "qc_checked_at",  "TEXT"),
            ("products",          "uin",            "TEXT"),
            ("product_documents", "fetch_status",   "TEXT NOT NULL DEFAULT 'pending'"),
            ("product_documents", "fetch_attempts", "INTEGER NOT NULL DEFAULT 0"),
            ("product_documents", "last_fetched_at","TEXT"),
        ]
        for table, column, definition in migrations:
            try:
                with self.transaction() as cursor:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
            except sqlite3.OperationalError:
                pass  # column already exists

    # ── Write operations ───────────────────────────────────────────────────────

    def upsert_insurers(self, insurers: Iterable[Insurer]) -> None:
        rows = [
            {
                "insurer_id":   insurer.insurer_id,
                "name":         clean_text(insurer.name),
                "category":     insurer.category,
                "source_url":   insurer.source_url,
                "website_url":  insurer.website_url,
                "metadata_json":self._dump_json(insurer.metadata),
                "raw_json":     self._dump_json(insurer.raw_record),
                "updated_at":   self._timestamp(),
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
                    name=excluded.name, category=excluded.category,
                    website_url=excluded.website_url,
                    metadata_json=excluded.metadata_json,
                    raw_json=excluded.raw_json,
                    updated_at=excluded.updated_at
                """,
                rows,
            )

    def upsert_products(self, products: Iterable[Product]) -> None:
        rows = [
            {
                "product_id":          product.product_id,
                "insurer_id":          product.insurer_id,
                "name":                clean_text(product.name),
                "category":            product.category,
                "product_url":         product.product_url,
                "description":         clean_text(product.description),
                "discovered_from_url": product.discovered_from_url,
                "tags_json":           self._dump_json(product.tags),
                "metadata_json":       self._dump_json(product.metadata),
                "updated_at":          self._timestamp(),
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
                    name=excluded.name, category=excluded.category,
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
        rows = [
            {
                "document_id":   document.document_id,
                "product_id":    document.product_id,
                "insurer_id":    document.insurer_id,
                "document_type": document.document_type,
                "source_url":    document.source_url,
                "local_path":    str(document.local_path) if document.local_path else None,
                "content_hash":  document.content_hash,
                "extracted_text":document.extracted_text,
                "metadata_json": self._dump_json(document.metadata),
                "updated_at":    self._timestamp(),
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

    def upsert_policy_sections(self, sections: Iterable[PolicySectionExtraction]) -> None:
        rows = [
            {
                "product_id":         section.product_id,
                "category":           section.category,
                "schema_version":     section.schema_version,
                "section_name":       section.section_name,
                "section_body":       section.content,
                "confidence":         section.confidence,
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

    def update_product_status(self, product_id: str, status: str) -> None:
        with self.transaction() as cursor:
            cursor.execute(
                "UPDATE products SET status=?, updated_at=? WHERE product_id=?",
                (status, self._timestamp(), product_id),
            )

    def update_qc_status(self, product_id: str, qc_status: str, detail: str = "") -> None:
        now = self._timestamp()
        with self.transaction() as cursor:
            cursor.execute(
                "UPDATE products SET qc_status=?, qc_checked_at=?, updated_at=? WHERE product_id=?",
                (qc_status, now, now, product_id),
            )
        self.log_qc_check(product_id, "link_check", qc_status, detail)

    def update_document_fetch_status(
        self, document_id: str, status: str, attempts: int
    ) -> None:
        now = self._timestamp()
        with self.transaction() as cursor:
            cursor.execute(
                """
                UPDATE product_documents
                SET fetch_status=?, fetch_attempts=?, last_fetched_at=?, updated_at=?
                WHERE document_id=?
                """,
                (status, attempts, now, now, document_id),
            )

    def update_document_content_hash(self, document_id: str, content_hash: str) -> None:
        with self.transaction() as cursor:
            cursor.execute(
                "UPDATE product_documents SET content_hash=?, updated_at=? WHERE document_id=?",
                (content_hash, self._timestamp(), document_id),
            )

    def log_qc_check(
        self, entity_id: str, check_type: str, result: str, detail: str = ""
    ) -> None:
        with self.transaction() as cursor:
            cursor.execute(
                "INSERT INTO qc_log (entity_id, check_type, result, detail, checked_at) VALUES (?,?,?,?,?)",
                (entity_id, check_type, result, detail, self._timestamp()),
            )

    # ── Read operations ────────────────────────────────────────────────────────

    def get_products_for_api(
        self,
        status: str = "active",
        category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[dict]:
        """Return product rows suitable for the API, optionally filtered."""
        conditions = ["p.status = ?"]
        params: List[Any] = [status]

        if category:
            conditions.append("p.category = ?")
            params.append(category)

        if search:
            conditions.append(
                "(LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(i.name) LIKE ?)"
            )
            term = f"%{search.lower()}%"
            params.extend([term, term, term])

        where = " AND ".join(conditions)
        rows = self.conn.execute(
            f"""
            SELECT p.*, i.name AS insurer_name, i.website_url AS insurer_website
            FROM products p
            JOIN insurers i ON p.insurer_id = i.insurer_id
            WHERE {where}
            ORDER BY p.updated_at DESC
            """,
            params,
        ).fetchall()
        return [dict(r) for r in rows]

    def get_product_by_id(self, product_id: str) -> Optional[dict]:
        row = self.conn.execute(
            """
            SELECT p.*, i.name AS insurer_name, i.website_url AS insurer_website
            FROM products p
            JOIN insurers i ON p.insurer_id = i.insurer_id
            WHERE p.product_id = ?
            """,
            (product_id,),
        ).fetchone()
        return dict(row) if row else None

    def get_documents_for_product(self, product_id: str) -> List[dict]:
        rows = self.conn.execute(
            "SELECT * FROM product_documents WHERE product_id = ?",
            (product_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_products_for_qc(self, days_since_last_check: int = 1) -> List[dict]:
        """Return active products whose QC check is overdue."""
        cutoff = (
            datetime.now(timezone.utc) - timedelta(days=days_since_last_check)
        ).isoformat(timespec="seconds")
        rows = self.conn.execute(
            """
            SELECT * FROM products
            WHERE status = 'active'
              AND (qc_checked_at IS NULL OR qc_checked_at < ?)
            ORDER BY qc_checked_at ASC
            LIMIT 500
            """,
            (cutoff,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_documents_for_drift_check(self, days_since_last_check: int = 7) -> List[dict]:
        """Return documents whose content-drift check is overdue."""
        cutoff = (
            datetime.now(timezone.utc) - timedelta(days=days_since_last_check)
        ).isoformat(timespec="seconds")
        rows = self.conn.execute(
            """
            SELECT d.*, p.status AS product_status
            FROM product_documents d
            LEFT JOIN products p ON d.product_id = p.product_id
            WHERE d.fetch_status = 'success'
              AND (d.last_fetched_at IS NULL OR d.last_fetched_at < ?)
            ORDER BY d.last_fetched_at ASC
            LIMIT 200
            """,
            (cutoff,),
        ).fetchall()
        return [dict(r) for r in rows]

    def count_active_products(self) -> int:
        row = self.conn.execute(
            "SELECT COUNT(*) AS n FROM products WHERE status = 'active'"
        ).fetchone()
        return row["n"] if row else 0

    # ── Helpers ────────────────────────────────────────────────────────────────

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
