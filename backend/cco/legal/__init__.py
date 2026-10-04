"""Legal knowledge layer (SPEC 6.5): offline corpus cache, CELLAR provider, embeddings search."""

from __future__ import annotations

from functools import lru_cache

from cco.contracts.domain import LegalProvision
from cco.legal.cache import CorpusCache
from cco.legal.cellar import CellarProvider
from cco.legal.index import LegalHit, LegalIndex
from cco.legal.orias import orias_number_valid

__all__ = [
    "CellarProvider", "CorpusCache", "LegalHit", "LegalIndex", "get_provision", "related", "related_provisions",
    "orias_number_valid", "search",
]


@lru_cache(maxsize=1)
def _cache() -> CorpusCache:
    return CorpusCache()


@lru_cache(maxsize=1)
def _index() -> LegalIndex:
    return LegalIndex()


def get_provision(id: str) -> LegalProvision | None:
    """Serve a provision from the committed cache, else from the full legal index (no network)."""
    p = _cache().get(id)
    if p is not None:
        return p
    r = _index().row(id)
    return LegalHit(**{k: r.get(k) for k in LegalHit.model_fields if k in r}).to_provision(r.get("retrieved_at"), r.get("source", "cellar")) if r else None


def search(query: str, k: int = 5, kind: str | None = None, embed=None) -> list[LegalHit]:
    """Semantic search over the full legal index (cosine, in memory). kind: law | guidance."""
    return _index().search(query, k, kind, embed)


def related(id: str, k: int = 5) -> list[LegalProvision]:
    """Provisions most similar to `id` by stored embeddings (full index, cosine, in memory)."""
    idx = _index()
    vec = idx.vector(id)
    if vec is None:
        p = _cache().get(id)
        if p is None or not p.embedding:
            return []
        vec = p.embedding
    out = []
    for h in idx.search_vector(vec, k + 3, exclude=id):
        r = idx.row(h.id) or {}
        out.append(h.to_provision(r.get("retrieved_at"), r.get("source", "cellar")))
    return out[:k] or _cache().related(id, k)


related_provisions = related
