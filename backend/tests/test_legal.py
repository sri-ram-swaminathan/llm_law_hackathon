from __future__ import annotations

import json
import re

import httpx
import pytest

from cco.legal import CellarProvider, CorpusCache, get_provision, orias_number_valid, related
from cco.legal.cellar import extract_point, split_article

SAMPLE = """<html><body>
<div class="eli-subdivision" id="art_25">
  <p class="oj-ti-art">Article 25</p>
  <div class="eli-title" id="art_25.tit_1"><p class="oj-sti-art">Assessment of suitability</p></div>
  <div id="025.001"><p class="oj-normal">1.   First paragraph text.</p></div>
  <div id="025.002"><p class="oj-normal">2.   When providing advice the firm shall:</p>
    <table><tbody><tr><td><p>(a)</p></td><td><p>obtain information;</p></td></tr></tbody></table></div>
</div>
<div class="eli-subdivision" id="art_4">
  <div id="004.001"><p class="oj-normal">1.   Definitions:</p>
    <table><tbody><tr><td><p>(3)</p></td><td><p>‘ancillary services’ means X;</p></td></tr></tbody></table>
    <table><tbody><tr><td><p>(4)</p></td><td><p>‘investment advice’ means Y;</p></td></tr></tbody></table>
    <table><tbody><tr><td><p>(5)</p></td><td><p>‘execution’ means Z;</p></td></tr></tbody></table></div>
</div></body></html>"""


def test_cellar_split():
    paras = split_article(SAMPLE, "25")
    assert set(paras) == {"1", "2"}
    assert paras["2"].splitlines() == ["2. When providing advice the firm shall:", "(a) obtain information;"]
    assert extract_point(split_article(SAMPLE, "4")["1"], "4") == "(4) ‘investment advice’ means Y;"
    with pytest.raises(KeyError):
        split_article(SAMPLE, "99")

    transport = httpx.MockTransport(lambda req: httpx.Response(200, content=SAMPLE.encode()))
    p = CellarProvider(httpx.Client(transport=transport)).get_provision("32014L0065", "4", "1(4)", id="x")
    assert p.text.startswith("(4)") and p.source == "cellar" and p.kind == "law"


def _cited_ids(fixtures_dir) -> set[str]:
    ids = {p["id"] for p in json.loads((fixtures_dir / "provisions.json").read_text())["provisions"]}
    for f in fixtures_dir.glob("release-*.json"):
        for m in re.finditer(r'"citations":\s*\[([^\]]*)\]', f.read_text()):
            ids |= set(re.findall(r'"([^"]+)"', m.group(1)))
    return ids


def test_cache_complete(fixtures_dir):
    cache = CorpusCache()
    cited = _cited_ids(fixtures_dir)
    assert cited <= set(cache.ids()), cited - set(cache.ids())
    for p in cache.all():
        assert p.text and p.source_url.startswith("http") and p.retrieved_at
        assert p.embedding and len(p.embedding) == 1024
        if p.kind == "guidance":
            assert p.issuer
        else:
            assert p.issuer is None


def test_offline(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("network used")

    monkeypatch.setattr(httpx.Client, "send", boom)
    monkeypatch.setattr("socket.socket.connect", boom)
    p = get_provision("gdpr-art17")
    assert p and p.celex == "32016R0679" and "erasure" in p.text
    assert get_provision("cmf-l541-1").source == "manual"
    assert get_provision("esma-suitability-2023").kind == "guidance"
    assert get_provision("nope") is None
    rel = related("gdpr-art13", k=3)
    assert len(rel) == 3 and all(r.id != "gdpr-art13" for r in rel)


def test_search_ranks(tmp_path):
    from cco.contracts.domain import LegalProvision

    cache = CorpusCache(tmp_path)
    for pid, vec in {"a": [1.0, 0.0], "b": [0.7, 0.7], "c": [0.0, 1.0], "d": None}.items():
        cache.put(
            LegalProvision(
                id=pid, source="manual", jurisdiction="EU", act_title="t", article="1", text=pid,
                source_url="http://x", retrieved_at="2026-10-04T00:00:00Z", embedding=vec,
            )
        )
    got = cache.search("q", k=3, embed=lambda s: [1.0, 0.1])
    assert [p.id for p in got] == ["a", "b", "c"]
    assert [p.id for p in cache.related("a", k=5)] == ["b", "c"]


def test_orias_format():
    assert orias_number_valid("12345678")
    for bad in ["1234567", "123456789", "1234567a", "1234 5678", "", None, "１２３４５６７８"]:
        assert not orias_number_valid(bad)


@pytest.mark.integration
def test_cellar_live():
    p = CellarProvider().get_provision("32024R1689", "50", "1")
    assert "AI systems" in p.text
