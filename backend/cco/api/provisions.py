"""Provisions. Reads cco.legal (T04 cache) when it exists, else contracts/fixtures/provisions.json."""

from __future__ import annotations

import json
from functools import lru_cache

from fastapi import APIRouter, HTTPException

from .. import config
from ..contracts import LegalProvision, ProvisionsFixture

router = APIRouter(tags=["legal"])

try:  # seam for T04: expose `get_provision(id)` / `related_provisions(id)` from cco.legal
    from .. import legal as _legal  # type: ignore
except ImportError:
    _legal = None


@lru_cache(maxsize=1)
def _fixture() -> dict[str, LegalProvision]:
    raw = json.loads((config.FIXTURES_DIR / "provisions.json").read_text())
    return {p.id: p for p in ProvisionsFixture.model_validate(raw).provisions}


def find_provision(provision_id: str) -> LegalProvision | None:
    if _legal is not None and hasattr(_legal, "get_provision"):
        p = _legal.get_provision(provision_id)
        if p is not None:
            return p
    return _fixture().get(provision_id)


def find_related(provision_id: str) -> list[LegalProvision]:
    if _legal is not None and hasattr(_legal, "related_provisions"):
        return _legal.related_provisions(provision_id)
    base = _fixture().get(provision_id)
    if base is None:
        return []
    return [p for p in _fixture().values() if p.id != base.id and (p.act_title == base.act_title or p.celex == base.celex and p.celex)]


@router.get("/provisions/{provision_id}", response_model=LegalProvision)
def get_provision(provision_id: str):
    p = find_provision(provision_id)
    if p is None:
        raise HTTPException(404, f"provision {provision_id!r} not found")
    return p


@router.get("/provisions/{provision_id}/related", response_model=list[LegalProvision])
def related_provisions(provision_id: str):
    if find_provision(provision_id) is None:
        raise HTTPException(404, f"provision {provision_id!r} not found")
    return find_related(provision_id)
