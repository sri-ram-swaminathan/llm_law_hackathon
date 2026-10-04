"""`python -m cco.legal.ingest`: fill data/corpus-cache/ (CELLAR + manual FR + guidance) with embeddings."""

from __future__ import annotations

import argparse
import re
from datetime import UTC, datetime
from pathlib import Path

from cco.contracts.domain import LegalProvision
from cco.legal.cache import REPO_ROOT, CorpusCache
from cco.legal.cellar import CellarProvider
from cco.legal.seed import CELLAR_SEED, GUIDANCE, MANUAL_FR

LEGIFRANCE_DIR = REPO_ROOT / "data" / "sources" / "legifrance"


def parse_manual(path: Path) -> tuple[dict[str, str], str]:
    """Parse a `---` front-matter + body markdown file (flat `key: value`, trailing `# comments` dropped)."""
    raw = path.read_text(encoding="utf-8")
    _, fm, body = raw.split("---", 2)
    meta: dict[str, str] = {}
    for line in fm.strip().splitlines():
        k, _, v = line.partition(":")
        meta[k.strip()] = re.sub(r"\s+#.*$", "", v).strip()
    return meta, body.strip()


def manual_provision(pid: str, spec: dict) -> LegalProvision:
    meta, body = parse_manual(LEGIFRANCE_DIR / spec["file"])
    return LegalProvision(
        id=pid,
        kind="law",
        source="manual",
        jurisdiction=meta["jurisdiction"],
        act_title=meta["act_title"],
        legi_id=meta.get("legi_text_id"),
        article=meta["article"],
        paragraph=spec.get("paragraph"),
        text=body,
        source_url=meta["source_url"],
        retrieved_at=datetime.fromisoformat(meta["retrieved_at"]).replace(tzinfo=UTC),
    )


def build_all(provider: CellarProvider | None = None) -> list[LegalProvision]:
    provider = provider or CellarProvider()
    out: list[LegalProvision] = []
    for s in CELLAR_SEED:
        p = provider.get_provision(
            s["fetch"], s["article"], s["paragraph"], id=s["id"], act_title=s["act_title"], celex_field=s["celex"]
        )
        out.append(p)
        print(f"cellar {s['id']}: {len(p.text)} chars")
    for pid, spec in MANUAL_FR.items():
        out.append(manual_provision(pid, spec))
    now = datetime.now(UTC)
    for g in GUIDANCE:
        out.append(LegalProvision(kind="guidance", source="manual", retrieved_at=now, **g))
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--no-embed", action="store_true", help="skip mistral-embed (keeps existing embeddings)")
    args = ap.parse_args(argv)
    cache = CorpusCache()
    old = {p.id: p for p in cache.all()}
    provs = build_all()
    if not args.no_embed:
        from cco.legal.embed import embed_texts

        vecs = embed_texts([f"{p.act_title} {p.article} {p.text}" for p in provs])
        for p, v in zip(provs, vecs, strict=True):
            p.embedding = v
    else:
        for p in provs:
            if p.id in old:
                p.embedding = old[p.id].embedding
    for p in provs:
        cache.put(p)
    print(f"cached {len(provs)} provisions -> {cache.root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
