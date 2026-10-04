"""Offline corpus cache: one JSON file per provision in data/corpus-cache/, in-memory cosine search."""

from __future__ import annotations

import json
import os
from collections.abc import Callable
from pathlib import Path

import numpy as np

from cco.contracts.domain import LegalProvision

REPO_ROOT = Path(__file__).resolve().parents[3]


def default_cache_dir() -> Path:
    return Path(os.environ.get("CCO_CORPUS_CACHE", REPO_ROOT / "data" / "corpus-cache"))


class CorpusCache:
    def __init__(self, root: Path | str | None = None):
        self.root = Path(root) if root else default_cache_dir()
        self._items: dict[str, LegalProvision] | None = None

    def _load(self) -> dict[str, LegalProvision]:
        if self._items is None:
            items: dict[str, LegalProvision] = {}
            for f in sorted(self.root.glob("*.json")):
                p = LegalProvision.model_validate_json(f.read_text(encoding="utf-8"))
                items[p.id] = p
            self._items = items
        return self._items

    def put(self, p: LegalProvision) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / f"{p.id}.json").write_text(
            json.dumps(p.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        self._items = None

    def ids(self) -> list[str]:
        return list(self._load())

    def all(self) -> list[LegalProvision]:
        return list(self._load().values())

    def get(self, id: str) -> LegalProvision | None:
        return self._load().get(id)

    def search_vector(self, vec: list[float], k: int = 5, exclude: str | None = None) -> list[tuple[LegalProvision, float]]:
        """Rank cached provisions that have embeddings by cosine similarity (in memory)."""
        cands = [p for p in self._load().values() if p.embedding and p.id != exclude]
        if not cands:
            return []
        m = np.array([p.embedding for p in cands], dtype=np.float64)
        q = np.asarray(vec, dtype=np.float64)
        denom = np.linalg.norm(m, axis=1) * (np.linalg.norm(q) or 1.0)
        sims = (m @ q) / np.where(denom == 0, 1.0, denom)
        order = np.argsort(-sims)[:k]
        return [(cands[i], float(sims[i])) for i in order]

    def search(self, q: str, k: int = 5, embed: Callable[[str], list[float]] | None = None) -> list[LegalProvision]:
        if embed is None:
            from cco.legal.embed import embed_texts

            embed = lambda s: embed_texts([s])[0]  # noqa: E731
        return [p for p, _ in self.search_vector(embed(q), k)]

    def related(self, id: str, k: int = 5) -> list[LegalProvision]:
        p = self.get(id)
        if p is None or not p.embedding:
            return []
        return [r for r, _ in self.search_vector(p.embedding, k, exclude=id)]
