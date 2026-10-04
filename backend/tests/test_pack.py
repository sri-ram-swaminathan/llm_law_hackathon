import json

import pytest
import yaml

from cco.contracts.domain import RegulatoryProfile
from cco.pack import load_pack, scope

SEVERITY = {"W1": "blocker", "W2": "blocker", "W3": "high", "W4": "high", "W5": "high", "W6": "high",
            "W7": "medium", "W8": "medium", "C1": "high", "C2": "medium"}


@pytest.fixture(scope="module")
def pack():
    return load_pack()


@pytest.fixture(scope="module")
def profile(repo_root):
    raw = yaml.safe_load((repo_root / "data" / "products" / "wealthpilot.yaml").read_text())
    return RegulatoryProfile.model_validate(raw["profile"])


def test_pack_valid(pack):
    assert len(pack.requirements) == 10
    by_alias = {r.alias: r for r in pack.requirements}
    assert {a: r.severity for a, r in by_alias.items()} == SEVERITY
    assert [a for a, r in by_alias.items() if r.mandatory] == ["W3"]
    assert pack.get("W1").id == "FR-CIF-STATUS-01"


def test_pack_matches_fixture_ids(pack, fixtures_dir):
    fx = json.loads((fixtures_dir / "requirements.json").read_text())["requirements"]
    assert [(r["id"], r["alias"], r["derived_from"]) for r in fx] == [
        (r.id, r.alias, r.derived_from) for r in pack.requirements
    ]


def test_citations_known(pack, fixtures_dir):
    prov = json.loads((fixtures_dir / "provisions.json").read_text())
    prov = prov if isinstance(prov, list) else prov["provisions"]
    known = {p["id"] for p in prov}
    refs = {p["id"] for p in pack.provision_refs}
    assert refs <= known
    for r in pack.requirements:
        assert set(r.derived_from) <= known, r.id
        assert set(r.derived_from) <= refs, r.id


def test_scope_wealthpilot(pack, profile):
    res = {r.requirement.alias: r for r in scope(profile, pack)}
    assert len(res) == 10
    for alias in SEVERITY:
        if alias != "C1":
            assert res[alias].applicable, alias
    c1 = res["C1"]
    assert not c1.applicable and c1.reason
    assert all(r.applicability_confidence == 1.0 for r in res.values())


def test_remediation_matches_golden(pack):
    parts = {p.id: p for r in pack.requirements for p in r.remediation.parts}
    assert sorted(parts) == ["A1", "A2", "A3", "A4", "P1", "P2", "P3", "P4", "P5", "P6"]
    kinds = {i: p.kind for i, p in parts.items()}
    assert kinds == {"P1": "code", "P2": "code", "P3": "code", "P4": "code", "P5": "code", "P6": "code",
                     "A1": "organisational", "A2": "document", "A3": "document", "A4": "organisational"}
    assert parts["P2"].depends_on == ["A1"]
    assert all(p.depends_on == [] for i, p in parts.items() if i != "P2")
    assert {i for r in pack.requirements for i in [r.alias] if r.alias in ("C1", "C2")} == {"C1", "C2"}
    assert parts["P1"].boundaries == [
        "backend/app/models.py", "backend/app/schemas.py", "frontend/src/pages/Onboarding.jsx",
        "backend/app/advisor.py", "backend/app/routers/advice.py", "backend/tests/"]
    assert parts["P2"].boundaries == [
        "backend/app/config.py", "backend/app/advisor.py", "frontend/src/components/Disclaimer.jsx"]
    assert parts["P5"].locations == ["backend/app/config.py:4"]
    assert parts["P3"].boundaries[0] == "backend/app/routers/advice.py"
    assert "backend/app/models.py:57-64" in parts["P4"].locations
    assert pack.get("W1").remediation.parts[0].id == "P2"
    assert [p.id for p in pack.get("W1").remediation.parts] == ["P2", "A1", "A3"]
