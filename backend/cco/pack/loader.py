"""Load and validate a requirement pack YAML against data/packs/schema.json."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import jsonschema
import yaml

from cco.contracts.domain import Requirement

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_PACK_PATH = REPO_ROOT / "data" / "packs" / "fintech-eu-fr.yaml"
SCHEMA_PATH = REPO_ROOT / "data" / "packs" / "schema.json"


@dataclass(frozen=True)
class Pack:
    id: str
    version: str
    title: str
    jurisdictions: list[str]
    provision_refs: list[dict]
    requirements: list[Requirement]

    @property
    def pack_version(self) -> str:
        return f"{self.id}@{self.version}"

    def get(self, key: str) -> Requirement:
        """Look up a requirement by id or alias (W1..W8, C1, C2)."""
        for r in self.requirements:
            if key in (r.id, r.alias):
                return r
        raise KeyError(key)


def load_pack(path: str | Path | None = None) -> Pack:
    p = Path(path) if path else DEFAULT_PACK_PATH
    raw = yaml.safe_load(p.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    jurisdictions = raw.get("jurisdictions", [])
    jsonschema.validate(raw, schema)
    return Pack(
        id=raw["id"],
        version=raw["version"],
        title=raw["title"],
        jurisdictions=jurisdictions,
        provision_refs=raw["provision_refs"],
        requirements=[Requirement.model_validate(r) for r in raw["requirements"]],
    )
