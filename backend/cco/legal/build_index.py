"""`python -m cco.legal.build_index`: full-text legal index in data/legal-index/ (CELLAR acts + CMF manuals + guidance)."""

from __future__ import annotations

import argparse
import re
from datetime import UTC, datetime

import numpy as np

from cco.legal.cache import CorpusCache
from cco.legal.cellar import CELLAR_URL, CellarProvider, article_title, split_article
from cco.legal.index import LegalIndex, chunk_article
from cco.legal.seed import AIACT, DELREG, GDPR, MIFID

ACTS = [
    dict(celex="32016R0679", act="GDPR", act_title=GDPR, slug="gdpr"),
    dict(celex="32014L0065", act="MiFID II", act_title=MIFID, slug="mifid2"),
    dict(celex="32017R0565", act="Delegated Regulation 2017/565", act_title=DELREG, slug="delreg565"),
    dict(celex="32024R1689", act="AI Act", act_title=AIACT, slug="aiact"),
]


def _articles(xhtml: bytes) -> list[str]:
    from lxml import html as lhtml

    ids = lhtml.fromstring(xhtml).xpath('//*[starts-with(@id,"art_")]/@id')
    return [i[4:] for i in ids if re.fullmatch(r"art_\w+", i)]


def act_rows(spec: dict, xhtml: bytes, now: str) -> list[dict]:
    rows = []
    for art in _articles(xhtml):
        try:
            paras = split_article(xhtml, art)
        except KeyError:
            continue
        title = article_title(xhtml, art)
        for para, text in chunk_article(paras):
            suffix = re.sub(r"[^0-9A-Za-z]+", "-", para).strip("-") if para else ""
            rows.append(dict(
                id=f"{spec['slug']}-art{art}" + (f"-p{suffix}" if suffix else ""),
                kind="law", source="cellar", jurisdiction="EU", act=spec["act"], act_title=spec["act_title"],
                celex=spec["celex"], article=art, paragraph=para, title=title,
                source_url=CELLAR_URL.format(celex=spec["celex"]), issuer=None, text=text, retrieved_at=now,
            ))
    return rows


def embed_text(r: dict) -> str:
    where = f"Article {r['article']}" + (f" ({r['title']})" if r.get("title") else "")
    para = f" paragraph {r['paragraph']}" if r.get("paragraph") else ""
    return f"{r['act_title']}, {where}{para}\n{r['text']}"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--no-embed", action="store_true", help="chunk only; print counts")
    args = ap.parse_args(argv)
    now = datetime.now(UTC).isoformat()
    provider = CellarProvider()
    rows: list[dict] = []
    for spec in ACTS:
        part = act_rows(spec, provider.fetch(spec["celex"]), now)
        print(f"{spec['act']}: {len(part)} chunks")
        rows += part

    vecs: list[list[float] | None] = [None] * len(rows)
    # manual CMF texts + guidance: reuse the cached provisions and their embeddings
    for p in CorpusCache().all():
        if p.source == "cellar":
            continue
        rows.append(dict(
            id=p.id, kind=p.kind, source=p.source, jurisdiction=p.jurisdiction,
            act=p.issuer or "CMF", act_title=p.act_title, celex=p.celex, article=p.article, paragraph=p.paragraph,
            title=None, source_url=p.source_url, issuer=p.issuer, text=p.text, retrieved_at=p.retrieved_at.isoformat(),
        ))
        vecs.append(p.embedding)
    print(f"total: {len(rows)} chunks ({sum(1 for r in rows if r['kind'] == 'guidance')} guidance)")
    if args.no_embed:
        return 0

    from cco.legal.embed import embed_texts

    todo = [i for i, v in enumerate(vecs) if v is None]
    got = embed_texts([embed_text(rows[i]) for i in todo], batch=32, pause=1.1)
    for i, v in zip(todo, got, strict=True):
        vecs[i] = v
    LegalIndex().save(rows, np.asarray(vecs, dtype=np.float32))
    print("saved", LegalIndex().root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
