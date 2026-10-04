"""Requirement pack: loader and scoper (SPEC 6.5, 6.9).

Public API:
    load_pack(path=None) -> Pack            validated against data/packs/schema.json
    scope(profile, pack=None) -> list[ScopeResult]   (Requirement, applicable, reason, applicability_confidence)
"""

from .loader import DEFAULT_PACK_PATH, SCHEMA_PATH, Pack, load_pack
from .scoper import ScopeResult, evaluate_applies_when, scope

__all__ = [
    "DEFAULT_PACK_PATH", "SCHEMA_PATH", "Pack", "load_pack",
    "ScopeResult", "evaluate_applies_when", "scope",
]
