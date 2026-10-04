"""Evidence bundle format and per-product evidence config (SPEC §6.6)."""

from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, Field

from .domain import ArtifactKind

BUNDLE_SUBDIR = "bundles"
COMPLIANCE_DIRNAME = "compliance"
CODE_DIRNAME = "code"

# Limits (§6.6)
MAX_COMPRESSED_BYTES = 50 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024
MAX_FILES = 5000
MAX_COMPRESSION_RATIO = 100

EXCLUDED_GLOBS: tuple[str, ...] = (
    ".env*",
    "*.pem",
    "*.key",
    "id_*",
    "node_modules/",
    ".git/",
)


def data_dir() -> Path:
    return Path(os.environ.get("CCO_DATA_DIR", "data/runtime"))


def bundle_root(release_id: str, base: Path | None = None) -> Path:
    """`${CCO_DATA_DIR:-data/runtime}/bundles/<release_id>/` holds code + compliance/."""
    return (base if base is not None else data_dir()) / BUNDLE_SUBDIR / release_id


class Bundle(BaseModel):
    release_id: str
    root_path: str  # bundle_root(release_id)
    compliance_path: str  # <root>/compliance
    code_path: str  # <root> (code is extracted at the root, next to compliance/)
    file_count: int = 0
    total_bytes: int = 0
    sha256: str | None = None

    @classmethod
    def for_release(cls, release_id: str, base: Path | None = None) -> "Bundle":
        root = bundle_root(release_id, base)
        return cls(
            release_id=release_id,
            root_path=str(root),
            compliance_path=str(root / COMPLIANCE_DIRNAME),
            code_path=str(root),
        )


class DocumentSpec(BaseModel):
    kind: ArtifactKind
    path: str  # relative to the bundle root, e.g. compliance/business-plan.md
    required: bool = False


class ProductEvidenceConfig(BaseModel):
    """Lives in CCOmmit's own repo (data/products/<product>.yaml), never in the upload."""

    product_id: str
    name: str
    description: str = ""
    code_globs: list[str]
    exclude_globs: list[str] = Field(default_factory=list)
    documents: list[DocumentSpec]
    profile: dict  # RegulatoryProfile fields (validated by the consumer)
