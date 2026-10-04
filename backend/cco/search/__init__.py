"""Evidence search over a release's company documents and code (T24).

Index per release: `<data_dir>/index/<release_id>.json` (chunk metadata + per-artifact sha256) and `<release_id>.npy`
(float16 unit vectors). `index_release` is idempotent: chunks of artifacts whose sha256 is unchanged are reused,
so only new/changed artifacts are embedded. Embeddings come from mistral-embed (`embed_texts`); tests patch it.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from collections.abc import Callable
from pathlib import Path

import numpy as np
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..contracts.bundle import data_dir
from ..contracts.domain import Requirement
from .chunker import Chunk, chunk_code, chunk_markdown

log = logging.getLogger("cco.search")

MAX_CHUNKS = 3000  # per release; bounds embedding cost (~100 requests at 32/request)
BATCH = 32

Embedder = Callable[[list[str]], list[list[float]]]


def embed_texts(texts: list[str]) -> list[list[float]]:
    """mistral-embed in batches of 32 with pacing and 429 backoff (see cco.legal.embed)."""
    from cco.legal import embed as _e

    return _e.embed_texts(texts, batch=BATCH, pause=1.1)


class EvidenceHit(BaseModel):
    chunk_id: str
    artifact_id: str
    path: str
    start_line: int
    end_line: int
    kind: str  # doc | code
    heading: str | None = None
    snippet: str
    score: float


class SearchHit(BaseModel):
    """Unified hit: `source` is company or legal."""

    source: str
    id: str
    title: str
    snippet: str
    score: float
    kind: str
    # company
    release_id: str | None = None
    artifact_id: str | None = None
    path: str | None = None
    start_line: int | None = None
    end_line: int | None = None
    # legal
    act: str | None = None
    article: str | None = None
    paragraph: str | None = None
    source_url: str | None = None


# ------------------------------------------------------------------ storage


def index_paths(release_id: str, base: Path | None = None) -> tuple[Path, Path]:
    root = (base if base is not None else data_dir()) / "index"
    return root / f"{release_id}.json", root / f"{release_id}.npy"


def _load(release_id: str, base: Path | None) -> tuple[dict, np.ndarray] | None:
    jp, vp = index_paths(release_id, base)
    try:
        meta = json.loads(jp.read_text(encoding="utf-8"))
        vec = np.load(vp)
        if len(meta["chunks"]) != len(vec):
            return None
        return meta, vec
    except (OSError, ValueError, KeyError):
        return None


def _save(release_id: str, base: Path | None, meta: dict, vec: np.ndarray) -> None:
    jp, vp = index_paths(release_id, base)
    jp.parent.mkdir(parents=True, exist_ok=True)
    np.save(vp, vec.astype(np.float16))  # np.save appends nothing when the name ends in .npy
    jp.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")


# ------------------------------------------------------------------ indexing


def chunk_artifact(artifact) -> list[Chunk]:
    if artifact.kind == "code_repo":
        out: list[Chunk] = []
        for f in artifact.files:
            out += chunk_code(f.path, f.content)
        return out
    return chunk_markdown(artifact.path, artifact.text)


def _embed_input(c: dict) -> str:
    head = f"{c['path']}" + (f" — {c['heading']}" if c.get("heading") else "")
    return f"{head}\n{c['text']}"


def _norm(m: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(m, axis=1, keepdims=True)
    return m / np.where(n == 0, 1.0, n)


def index_release(
    session: Session, release_id: str, embed: Embedder | None = None, base: Path | None = None
) -> dict[str, int]:
    """Chunk + embed the release's artifacts. Returns {"chunks": n, "embedded": n_new_vectors}."""
    from ..api import deps

    embed = embed or embed_texts
    artifacts = deps.release_artifacts(session, release_id)
    old = _load(release_id, base)
    old_sha: dict[str, str] = old[0]["artifacts"] if old else {}
    reuse: dict[str, list[int]] = {}
    if old:
        for i, c in enumerate(old[0]["chunks"]):
            reuse.setdefault(c["artifact_id"], []).append(i)

    chunks: list[dict] = []
    vecs: list[np.ndarray | None] = []
    shas: dict[str, str] = {}
    for a in artifacts:
        shas[a.id] = a.sha256
        if old and old_sha.get(a.id) == a.sha256:
            for i in reuse.get(a.id, []):
                chunks.append(old[0]["chunks"][i])
                vecs.append(old[1][i].astype(np.float32))
            continue
        for n, c in enumerate(chunk_artifact(a)):
            if len(chunks) >= MAX_CHUNKS:
                break
            chunks.append(dict(
                id=f"{a.id}:{c.path}:{c.start_line}", artifact_id=a.id, path=c.path, start_line=c.start_line,
                end_line=c.end_line, kind=c.kind, heading=c.heading, text=c.text,
            ))
            vecs.append(None)
    todo = [i for i, v in enumerate(vecs) if v is None]
    if todo:
        got = embed([_embed_input(chunks[i]) for i in todo])
        if len(got) != len(todo):
            raise RuntimeError("embedder returned a wrong number of vectors")
        for i, v in zip(todo, got, strict=True):
            vecs[i] = np.asarray(v, dtype=np.float32)
    if not chunks:
        _save(release_id, base, {"artifacts": shas, "chunks": []}, np.zeros((0, 1024)))
        return {"chunks": 0, "embedded": 0}
    mat = _norm(np.vstack(vecs))  # type: ignore[arg-type]
    _save(release_id, base, {"artifacts": shas, "chunks": chunks}, mat)
    return {"chunks": len(chunks), "embedded": len(todo)}


def index_on_ingest(session: Session, release_id: str, base: Path | None = None) -> None:
    """Best-effort hook for ingest: never raises. Skipped without MISTRAL_API_KEY, under pytest, or with CCO_INDEX_ON_INGEST=0."""
    if os.environ.get("CCO_INDEX_ON_INGEST") == "0" or "PYTEST_CURRENT_TEST" in os.environ:
        return
    if not os.environ.get("MISTRAL_API_KEY"):
        log.warning("MISTRAL_API_KEY not set: release %s not indexed (it is indexed lazily on first search)", release_id)
        return
    try:
        res = index_release(session, release_id, base=base)
        log.info("indexed release %s: %s", release_id, res)
    except Exception as e:  # noqa: BLE001 - indexing must never fail ingest
        log.warning("indexing release %s failed (lazy on first search): %s", release_id, e)


# ------------------------------------------------------------------ search


def _snippet(text: str, n: int = 400) -> str:
    t = text.strip()
    return t if len(t) <= n else t[:n].rstrip() + "…"


def search_evidence(
    session: Session,
    release_id: str,
    query: str,
    k: int = 5,
    kind: str | None = None,
    embed: Embedder | None = None,
    base: Path | None = None,
) -> list[EvidenceHit]:
    """Ranked chunks of the release (cosine). Indexes lazily if the release has no up-to-date index."""
    embed = embed or embed_texts
    try:
        index_release(session, release_id, embed, base)
    except Exception as e:  # noqa: BLE001 - fall back to whatever index exists
        if _load(release_id, base) is None:
            raise
        log.warning("re-index of %s failed, searching the existing index: %s", release_id, e)
    loaded = _load(release_id, base)
    if loaded is None or not loaded[0]["chunks"]:
        return []
    meta, mat = loaded
    q = np.asarray(embed([query])[0], dtype=np.float32)
    q = q / (np.linalg.norm(q) or 1.0)
    sims = _norm(mat.astype(np.float32)) @ q
    out: list[EvidenceHit] = []
    for i in np.argsort(-sims):
        c = meta["chunks"][i]
        if kind and c["kind"] != kind:
            continue
        out.append(EvidenceHit(
            chunk_id=c["id"], artifact_id=c["artifact_id"], path=c["path"], start_line=c["start_line"],
            end_line=c["end_line"], kind=c["kind"], heading=c.get("heading"), snippet=_snippet(c["text"]),
            score=float(sims[i]),
        ))
        if len(out) >= k:
            break
    return out


def retrieve_for_requirement(
    session: Session, release_id: str, requirement: Requirement, k: int = 3, embed: Embedder | None = None,
    base: Path | None = None,
) -> list[EvidenceHit]:
    """Retrieval fallback for the evaluator (not wired; planned behind CCO_RETRIEVAL_FALLBACK=1)."""
    query = f"{requirement.statement}\n{requirement.evidence_needed}".strip()
    return search_evidence(session, release_id, query, k, embed=embed, base=base)


def unified_search(
    session: Session | None,
    q: str,
    scope: str = "all",
    release_id: str | None = None,
    k: int = 5,
    embed: Embedder | None = None,
    base: Path | None = None,
) -> list[SearchHit]:
    """Merge company and legal hits by cosine score. scope: company | legal | all."""
    embed = embed or embed_texts
    qv = embed([q])[0]
    hits: list[SearchHit] = []
    if scope in ("legal", "all"):
        from cco import legal

        for h in legal.search(q, k, embed=lambda _s: qv):
            hits.append(SearchHit(
                source="legal", id=h.id, title=f"{h.act} Art. {h.article}" + (f"({h.paragraph})" if h.paragraph else ""),
                snippet=_snippet(h.text), score=h.score, kind=h.kind, act=h.act, article=h.article,
                paragraph=h.paragraph, source_url=h.source_url,
            ))
    if scope in ("company", "all") and release_id and session is not None:
        for h in search_evidence(session, release_id, q, k, embed=lambda ts: [qv] if ts == [q] else embed(ts), base=base):
            hits.append(SearchHit(
                source="company", id=h.chunk_id, title=f"{h.path}:{h.start_line}-{h.end_line}", snippet=h.snippet,
                score=h.score, kind=h.kind, release_id=release_id, artifact_id=h.artifact_id, path=h.path,
                start_line=h.start_line, end_line=h.end_line,
            ))
    hits.sort(key=lambda h: -h.score)
    return hits[:k] if scope == "all" else hits


__all__ = [
    "EvidenceHit", "SearchHit", "index_release", "index_on_ingest", "search_evidence", "retrieve_for_requirement",
    "unified_search", "embed_texts", "chunk_artifact", "Chunk", "chunk_markdown", "chunk_code",
]
