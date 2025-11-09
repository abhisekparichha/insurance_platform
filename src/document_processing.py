"""Download and parse product documents, then normalize into canonical schemas."""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional

import requests
from pdfminer.high_level import extract_text as extract_pdf_text

from .models import PolicySectionExtraction, Product, ProductDocument
from .policy_schema import POLICY_SCHEMAS, PolicySchema, PolicySectionDefinition
from .utils import compute_content_hash, clean_text, ensure_url_has_scheme, slugify, strip_hindi

LOGGER = logging.getLogger(__name__)

SUPPORTED_DOCUMENT_EXTENSIONS = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@dataclass
class DocumentProcessorConfig:
    """Configuration for downloading and parsing product documents."""

    base_dir: Path = Path("data") / "documents"
    download_documents: bool = True
    max_document_size: int = 25 * 1024 * 1024  # 25MB
    request_timeout: int = 30


class DocumentProcessor:
    """Download and extract text from product documents."""

    def __init__(
        self,
        config: DocumentProcessorConfig | None = None,
        session: Optional[requests.Session] = None,
    ) -> None:
        self.config = config or DocumentProcessorConfig()
        self.session = session or requests.Session()
        self.config.base_dir.mkdir(parents=True, exist_ok=True)

    def process_document(self, document: ProductDocument) -> ProductDocument:
        """Download and parse a document, enriching metadata."""
        url = ensure_url_has_scheme(document.source_url)
        if not url:
            return document

        extension = self._detect_extension(url)
        local_path = self._build_local_path(document.insurer_id, document.document_id, extension)

        if self.config.download_documents:
            try:
                content = self._download(url)
                if not content:
                    return document
                document.content_hash = compute_content_hash(content)
                local_path.parent.mkdir(parents=True, exist_ok=True)
                local_path.write_bytes(content)
                document.local_path = local_path
                document.extracted_text = self._extract_text(local_path, extension)
            except Exception as exc:  # pylint: disable=broad-except
                LOGGER.warning("Failed to process document %s: %s", url, exc)
        else:
            document.local_path = local_path
            document.extracted_text = ""

        document.metadata["extension"] = extension
        document.metadata["content_type"] = SUPPORTED_DOCUMENT_EXTENSIONS.get(extension, "")
        return document

    def _download(self, url: str) -> bytes:
        response = self.session.get(url, timeout=self.config.request_timeout)
        response.raise_for_status()
        content_length = int(response.headers.get("Content-Length", "0"))
        if content_length and content_length > self.config.max_document_size:
            raise ValueError(f"Document too large: {content_length} bytes")

        content = response.content
        if len(content) > self.config.max_document_size:
            raise ValueError("Document exceeded max size after download")
        return content

    @staticmethod
    def _detect_extension(url: str) -> str:
        path = Path(url)
        ext = path.suffix.lower()
        if ext in SUPPORTED_DOCUMENT_EXTENSIONS:
            return ext
        return ".pdf" if ".pdf" in url else ext or ".dat"

    def _build_local_path(self, insurer_id: str, document_id: str, extension: str) -> Path:
        sanitized = slugify(document_id) or document_id
        return self.config.base_dir / insurer_id / f"{sanitized}{extension}"

    def _extract_text(self, path: Path, extension: str) -> str:
        if not path.exists():
            return ""
        try:
            if extension == ".pdf":
                text = extract_pdf_text(path)
            else:
                text = ""
        except Exception as exc:  # pylint: disable=broad-except
            LOGGER.warning("Failed to extract text from %s: %s", path, exc)
            text = ""
        return strip_hindi(text)


class PolicyNormalizer:
    """Normalize extracted policy text into canonical schema sections."""

    SECTION_HEADING_RE = re.compile(r"^[A-Z][A-Za-z0-9\s/&,-]{3,}$")

    def __init__(self, schemas: Optional[dict[str, PolicySchema]] = None) -> None:
        self.schemas = schemas or dict(POLICY_SCHEMAS)

    def normalize(
        self,
        product: Product,
        document: ProductDocument,
    ) -> List[PolicySectionExtraction]:
        text = document.extracted_text or ""
        if not text:
            return []

        schema = self.schemas.get(product.category)
        if not schema:
            return []

        sections = self._split_sections(text)
        normalized: List[PolicySectionExtraction] = []
        for definition in schema.sections:
            content, confidence = self._match_section(definition, sections)
            extraction = PolicySectionExtraction(
                product_id=product.product_id,
                category=product.category,
                schema_version=schema.version,
                section_name=definition.name,
                content=content,
                confidence=confidence,
                source_document_id=document.document_id,
            )
            normalized.append(extraction)
        return normalized

    def _split_sections(self, text: str) -> List[tuple[str, str]]:
        lines = [clean_text(line) for line in text.splitlines()]
        sections: List[tuple[str, str]] = []
        current_title = "Overview"
        buffer: List[str] = []

        for line in lines:
            if not line:
                continue
            if self._looks_like_heading(line):
                if buffer:
                    sections.append((current_title, "\n".join(buffer).strip()))
                    buffer = []
                current_title = line.rstrip(":").strip()
            else:
                buffer.append(line)

        if buffer:
            sections.append((current_title, "\n".join(buffer).strip()))
        return sections

    def _looks_like_heading(self, line: str) -> bool:
        stripped = line.strip().rstrip(":").strip()
        if not stripped or len(stripped) > 120:
            return False
        words = stripped.split()
        if len(words) > 12:
            return False
        if stripped.isupper():
            return True
        uppercase = sum(1 for ch in stripped if ch.isupper())
        lowercase = sum(1 for ch in stripped if ch.islower())
        if uppercase and lowercase == 0:
            return True
        if uppercase >= lowercase:
            return True
        return bool(self.SECTION_HEADING_RE.match(stripped))

    def _match_section(
        self,
        definition: PolicySectionDefinition,
        sections: Iterable[tuple[str, str]],
    ) -> tuple[str, float]:
        canonical = definition.name.lower()
        aliases = [alias.lower() for alias in definition.aliases]

        for title, content in sections:
            normalized_title = title.lower()
            if normalized_title == canonical:
                return content, 1.0
            if any(alias in normalized_title for alias in aliases):
                return content, 0.8

        return "", 0.0
