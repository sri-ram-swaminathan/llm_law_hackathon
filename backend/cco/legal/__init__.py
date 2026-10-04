"""Legal knowledge layer (SPEC 6.5): offline corpus cache, CELLAR provider, embeddings search."""

from __future__ import annotations

from functools import lru_cache

from cco.contracts.domain import LegalProvision
from cco.legal.cache import CorpusCache
from cco.legal.cellar import CellarProvider
from cco.legal.orias import orias_number_valid

__all__ = ["CellarProvider", "CorpusCache", "get_provision", "related", "orias_number_valid"]


@lru_cache(maxsize=1)
def _cache() -> CorpusCache:
    return CorpusCache()


def get_provision(id: str) -> LegalProvision | None:
    """Serve a provision from the committed cache (no network)."""
    return _cache().get(id)


def related(id: str, k: int = 5) -> list[LegalProvision]:
    """Provisions most similar to `id` by stored embeddings (cosine, in memory)."""
    return _cache().related(id, k)
