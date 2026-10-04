import hashlib
import io
import re
import zipfile

import numpy as np
import pytest
from fastapi.testclient import TestClient

import cco.search as S
from cco import legal
from cco.contracts import Requirement
from cco.ingest import ingest_bundle
from cco.legal.index import LegalIndex, chunk_article
from cco.main import create_app
from cco.search.chunker import chunk_code, chunk_markdown

H = {"Authorization": "Bearer test-deploy-token"}


def fake_embed(texts):
    """Deterministic bag-of-words hashing into 1024 dims (no network)."""
    out = []
    for t in texts:
        v = np.zeros(1024)
        for w in re.findall(r"[a-z]{3,}", t.lower()):
            v[int(hashlib.md5(w.encode()).hexdigest(), 16) % 1024] += 1
        out.append(v.tolist())
    return out


GUIDE = """# Product guide

Intro text.

## Data retention

User data is deleted after 30 days. Deletion requests are processed by the privacy team.

## Pricing

Plans cost money per month.
"""
CODE = "import os\n\n\ndef helper():\n    return 1\n\n\nclass Store:\n    def get(self):\n        return 2\n"


@pytest.fixture(autouse=True)
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("CCO_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(S, "embed_texts", fake_embed)
    return tmp_path


def zipped(files):
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as z:
        for k, v in files.items():
            z.writestr(k, v)
    return b.getvalue()


FILES = {"docs/PRODUCT_GUIDE.md": GUIDE, "compliance/terms.md": "# Terms\n\nBinding terms of use.\n", "backend/app.py": CODE}


def make_release(s):
    rel, arts = ingest_bundle(s, zipped(FILES), "0.9.0")
    return rel.id


def test_chunking():
    ch = chunk_markdown("g.md", GUIDE)
    assert [c.heading for c in ch] == ["Product guide", "Data retention", "Pricing"]
    ret = ch[1]
    assert (ret.start_line, ret.end_line, ret.kind) == (5, 8, "doc") and "30 days" in ret.text
    long = "# H\n" + "\n".join(f"line number {i} " + "x" * 80 for i in range(40))
    parts = chunk_markdown("l.md", long)
    assert len(parts) > 2 and all(len(c.text) <= 1300 for c in parts)
    assert parts[1].start_line <= parts[0].end_line  # overlap
    code = chunk_code("a.py", CODE)
    assert all(c.kind == "code" for c in code) and code[0].start_line == 1 and code[-1].end_line == 10
    big = "\n".join(f"def f{i}():\n    return {i}\n" + "#" * 200 for i in range(40))
    cc = chunk_code("b.py", big)
    assert len(cc) > 1 and cc[0].path == "b.py"
    win = chunk_code("x.txt", "\n".join(str(i) for i in range(130)))
    assert [(c.start_line, c.end_line) for c in win][:2] == [(1, 60), (56, 115)]


def test_index_idempotent(data_dir):
    from cco.db import session_scope

    calls = []

    def emb(texts):
        calls.append(len(texts))
        return fake_embed(texts)

    with session_scope("sqlite://") as s:
        rid = make_release(s)
        r1 = S.index_release(s, rid, emb)
        assert r1["chunks"] >= 4 and r1["embedded"] == r1["chunks"]
        r2 = S.index_release(s, rid, emb)
        assert r2["embedded"] == 0 and len(calls) == 1
        jp, vp = S.index_paths(rid)
        assert jp.is_file() and np.load(vp).dtype == np.float16


def test_search_ranks():
    from cco.db import session_scope

    with session_scope("sqlite://") as s:
        rid = make_release(s)
        hits = S.search_evidence(s, rid, "data retention deletion of user data", k=3)
        assert hits[0].path == "docs/PRODUCT_GUIDE.md" and hits[0].heading == "Data retention"
        assert hits[0].start_line == 5 and hits[0].score >= hits[1].score
        assert all(h.kind == "code" for h in S.search_evidence(s, rid, "class Store get", k=3, kind="code"))
        req = Requirement.model_construct(statement="user data deleted after retention period", evidence_needed="deletion")
        assert S.retrieve_for_requirement(s, rid, req, k=1)[0].heading == "Data retention"


def test_endpoint():
    app = create_app("sqlite://")
    with TestClient(app) as c:
        with app.state.sessionmaker() as s:
            rid = make_release(s)
            s.commit()
            direct = S.search_evidence(s, rid, "data retention", k=2)
        r = c.get(f"/api/releases/{rid}/search", params={"q": "data retention", "k": 2}, headers=H)
        assert r.status_code == 200 and [h["chunk_id"] for h in r.json()] == [h.chunk_id for h in direct]
        assert c.get("/api/releases/nope/search", params={"q": "x"}, headers=H).status_code == 404
        assert c.get(f"/api/releases/{rid}/search", params={"q": "x"}).status_code == 401


def test_legal_index_loads():
    idx = LegalIndex()
    rows = idx.rows
    assert len(rows) >= 400
    acts = {r["act"] for r in rows}
    assert {"GDPR", "MiFID II", "Delegated Regulation 2017/565", "AI Act"} <= acts
    assert all(r["source_url"].startswith("http") and r["kind"] in ("law", "guidance") for r in rows)
    assert idx._mat.shape == (len(rows), 1024)
    ids = {r["id"] for r in rows}
    assert "mifid2-art4-p1-4" in ids and "gdpr-art17" in ids
    # query = a stored vector: finds itself first, with act/article/source_url/kind on the hit
    h = legal.search("x", 3, embed=lambda _s: idx.vector("gdpr-art17").tolist())[0]
    assert (h.id, h.act, h.article, h.kind) == ("gdpr-art17", "GDPR", "17", "law") and h.source_url
    assert all(r.id != "gdpr-art17" for r in legal.related_provisions("gdpr-art17", 3))
    assert legal.get_provision("gdpr-art5") is not None
    assert [x.kind for x in legal.search("x", 2, kind="guidance", embed=lambda _s: idx.vector("gdpr-art17").tolist())] == ["guidance"] * 2


def test_chunk_article_splits_points():
    paras = {"1": "1. Definitions:\n" + "\n".join(f"({i}) ‘term{i}’ means " + "y" * 120 for i in range(1, 41))}
    labels = [p for p, _ in chunk_article(paras)]
    assert "1(4)" in labels and len(labels) == 41
    assert chunk_article({"1": "short"}) == [(None, "short")]


def test_unified_search():
    from cco.db import session_scope

    idx = LegalIndex()
    vec = idx.vector("gdpr-art17")
    with session_scope("sqlite://") as s:
        rid = make_release(s)
        # legal-only vector query, company has no overlap -> legal first
        hits = S.unified_search(s, "erasure", "all", rid, 6, embed=lambda ts: [vec.tolist() if len(ts) == 1 else v for v in fake_embed(ts)])
        assert {h.source for h in hits} <= {"company", "legal"} and hits[0].source == "legal"
        assert hits == sorted(hits, key=lambda h: -h.score)
        only = S.unified_search(s, "data retention", "company", rid, 3, embed=fake_embed)
        assert only and all(h.source == "company" for h in only)
    app = create_app("sqlite://")
    with TestClient(app) as c:
        r = c.get("/api/search", params={"q": "erasure", "scope": "legal", "k": 3}, headers=H)
        assert r.status_code == 503 or all(h["source"] == "legal" for h in r.json())
