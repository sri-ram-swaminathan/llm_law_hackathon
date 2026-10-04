"""Full legal index: article/paragraph chunks of the four EU acts + CMF manuals + guidance, in data/legal-index/.

Layout: `vectors.npy` (float16, N x 1024, unit-normalised) + `meta.jsonl` (one JSON object per row, same order).
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import Callable
from datetime import datetime
from pathlib import Path

import numpy as np
from pydantic import BaseModel

from cco.contracts.domain import LegalProvision
from cco.legal.cache import REPO_ROOT

MAX_CHUNK = 3500  # chars; the embedder truncates at 6000


def index_dir() -> Path:
    return Path(os.environ.get("CCO_LEGAL_INDEX", REPO_ROOT / "data" / "legal-index"))


class LegalHit(BaseModel):
    id: str
    kind: str  # law | guidance
    act: str
    act_title: str
    article: str
    paragraph: str | None = None
    title: str | None = None
    source_url: str
    jurisdiction: str = ""
    celex: str | None = None
    issuer: str | None = None
    text: str
    score: float = 0.0

    def to_provision(self, retrieved_at: str | None = None, source: str = "cellar") -> LegalProvision:
        return LegalProvision(
            id=self.id, kind=self.kind, source=source, issuer=self.issuer, jurisdiction=self.jurisdiction or "EU",
            act_title=self.act_title, celex=self.celex, article=self.article, paragraph=self.paragraph,
            text=self.text, source_url=self.source_url,
            retrieved_at=datetime.fromisoformat(retrieved_at) if retrieved_at else datetime.fromisoformat("2026-10-04T00:00:00+00:00"),
        )


class LegalIndex:
    def __init__(self, root: Path | str | None = None):
        self.root = Path(root) if root else index_dir()
        self._rows: list[dict] | None = None
        self._mat: np.ndarray | None = None

    def _load(self) -> None:
        if self._rows is not None:
            return
        meta = self.root / "meta.jsonl"
        vec = self.root / "vectors.npy"
        if not (meta.is_file() and vec.is_file()):
            self._rows, self._mat = [], np.zeros((0, 1024), dtype=np.float32)
            return
        self._rows = [json.loads(line) for line in meta.read_text(encoding="utf-8").splitlines() if line.strip()]
        m = np.load(vec).astype(np.float32)
        n = np.linalg.norm(m, axis=1, keepdims=True)
        self._mat = m / np.where(n == 0, 1.0, n)
        assert len(self._rows) == len(self._mat), "legal index meta/vectors out of sync"

    def __len__(self) -> int:
        self._load()
        return len(self._rows)  # type: ignore[arg-type]

    @property
    def rows(self) -> list[dict]:
        self._load()
        return self._rows  # type: ignore[return-value]

    def row(self, id: str) -> dict | None:
        return next((r for r in self.rows if r["id"] == id), None)

    def vector(self, id: str) -> np.ndarray | None:
        self._load()
        for i, r in enumerate(self._rows):  # type: ignore[arg-type]
            if r["id"] == id:
                return self._mat[i]  # type: ignore[index]
        return None

    def _hit(self, r: dict, score: float) -> LegalHit:
        return LegalHit(score=score, **{k: r.get(k) for k in LegalHit.model_fields if k != "score" and k in r})

    def search_vector(self, vec, k: int = 5, kind: str | None = None, exclude: str | None = None) -> list[LegalHit]:
        self._load()
        if not self._rows:
            return []
        q = np.asarray(vec, dtype=np.float32)
        q = q / (np.linalg.norm(q) or 1.0)
        sims = self._mat @ q  # type: ignore[operator]
        out: list[LegalHit] = []
        for i in np.argsort(-sims):
            r = self._rows[i]
            if (kind and r["kind"] != kind) or r["id"] == exclude:
                continue
            out.append(self._hit(r, float(sims[i])))
            if len(out) >= k:
                break
        return out

    def search(self, query: str, k: int = 5, kind: str | None = None, embed: Callable[[str], list[float]] | None = None) -> list[LegalHit]:
        if not len(self):
            return []
        if embed is None:
            from cco.legal import embed as _e

            embed = lambda s: _e.embed_texts([s])[0]  # noqa: E731
        return self.search_vector(embed(query), k, kind)

    def save(self, rows: list[dict], vectors: np.ndarray) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        np.save(self.root / "vectors.npy", vectors.astype(np.float16))
        (self.root / "meta.jsonl").write_text(
            "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8"
        )
        self._rows = self._mat = None


# ------------------------------------------------------------------ chunking of an act


_POINT = re.compile(r"^\((\d+)\)\s")
_PARA = re.compile(r"^(\d+)\.\s")


def _units(paras: dict[str, str]) -> list[tuple[str, str]]:
    """(paragraph label, text) units of an article."""
    if len(paras) > 1:
        return list(paras.items())
    text = next(iter(paras.values()), "")
    units: list[tuple[str, list[str]]] = []
    for line in text.splitlines():
        m = _PARA.match(line)
        if m or not units:
            units.append((m.group(1) if m else "1", [line]))
        else:
            units[-1][1].append(line)
    return [(lab, "\n".join(ls)) for lab, ls in units]


def _split_points(label: str, text: str) -> list[tuple[str, str]]:
    """Split an oversize unit at sequential "(n)" points; sub-points stay with their point."""
    out: list[tuple[str, list[str]]] = []
    last = 0
    for line in text.splitlines():
        m = _POINT.match(line)
        if m and int(m.group(1)) == last + 1:
            last += 1
            out.append((f"{label}({last})", [line]))
        elif out:
            out[-1][1].append(line)
        else:
            out.append((label, [line]))  # lead-in
    if last < 3:
        return []
    return [(lab, "\n".join(ls)) for lab, ls in out]


def _windows(label: str, text: str) -> list[tuple[str, str]]:
    out, cur = [], ""
    for line in text.splitlines():
        while len(line) > MAX_CHUNK:  # pathological single line
            if cur:
                out.append(cur)
                cur = ""
            out.append(line[:MAX_CHUNK])
            line = line[MAX_CHUNK:]
        if cur and len(cur) + len(line) + 1 > MAX_CHUNK:
            out.append(cur)
            cur = ""
        cur = f"{cur}\n{line}" if cur else line
    if cur:
        out.append(cur)
    return [(label, t) for t in out]


def chunk_article(paras: dict[str, str]) -> list[tuple[str | None, str]]:
    """Chunks of one article as (paragraph label or None, text): whole article if it fits, else by paragraph/point."""
    whole = "\n".join(paras.values())
    if len(whole) <= MAX_CHUNK:
        return [(None, whole)]
    pieces: list[tuple[str, str]] = []
    for label, text in _units(paras):
        if len(text) <= MAX_CHUNK:
            pieces.append((label, text))
            continue
        sub = _split_points(label, text)
        pieces.extend(sum((_windows(lab, t) if len(t) > MAX_CHUNK else [(lab, t)] for lab, t in sub), [])) if sub else pieces.extend(_windows(label, text))
    # merge neighbouring small pieces (never points: each definition stays addressable)
    merged: list[tuple[str, str]] = []
    for lab, t in pieces:
        if merged and "(" not in lab and "(" not in merged[-1][0] and len(merged[-1][1]) + len(t) + 1 <= MAX_CHUNK:
            plab, pt = merged[-1]
            first = plab.split("-")[0]
            merged[-1] = (f"{first}-{lab}" if lab != first else first, f"{pt}\n{t}")
        else:
            merged.append((lab, t))
    return [(lab, t) for lab, t in merged if t.strip()]
