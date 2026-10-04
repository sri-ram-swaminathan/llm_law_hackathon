"""Evidence search: per-release (company docs + code) and unified (company + legal)."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import search as search_mod
from ..db import get_session
from . import deps

router = APIRouter(tags=["search"])


def _guard(fn):
    try:
        return fn()
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001 - embedding service unavailable / key missing
        raise HTTPException(503, f"search unavailable: {e}") from e


@router.get("/releases/{release_id}/search", response_model=list[search_mod.EvidenceHit])
def release_search(
    release_id: str,
    q: str = Query(min_length=1),
    k: int = Query(5, ge=1, le=50),
    kind: Literal["doc", "code"] | None = None,
    s: Session = Depends(get_session),
):
    deps.get_release(s, release_id)
    return _guard(lambda: search_mod.search_evidence(s, release_id, q, k, kind))


@router.get("/search", response_model=list[search_mod.SearchHit])
def unified_search(
    q: str = Query(min_length=1),
    scope: Literal["company", "legal", "all"] = "all",
    release_id: str | None = None,
    k: int = Query(5, ge=1, le=50),
    s: Session = Depends(get_session),
):
    if release_id:
        deps.get_release(s, release_id)
    return _guard(lambda: search_mod.unified_search(s, q, scope, release_id, k))
