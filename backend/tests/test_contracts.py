"""T01 definition of done: contracts import, fixtures validate, expectations match, schema and config exist."""

import json
from pathlib import Path

import jsonschema
import yaml

from cco.contracts import (
    COMMENT_MARKER,
    EVENT_TYPES,
    EXIT_ENGINE_ERROR,
    EXIT_NOT_READY,
    EXIT_READY,
    AgentEvent,
    Baseline,
    Bundle,
    CiResult,
    FindingCandidate,
    ProductEvidenceConfig,
    Readiness,
    SseEnvelope,
    bundle_root,
    evidence_fingerprint,
)
from cco.contracts import domain
from cco.contracts.api import ProvisionsFixture, ReleaseFixture, RequirementsFixture

FIXTURES = {"0.9.0": "release-0.9.0.json", "rc": "release-1.0.0-rc.json", "1.0.0": "release-1.0.0.json"}


def load_release(fixtures_dir, key) -> ReleaseFixture:
    return ReleaseFixture.model_validate_json((fixtures_dir / FIXTURES[key]).read_text())


def test_models_import():
    for name in ("RegulatoryProfile", "Release", "Artifact", "LegalProvision", "Requirement", "Assessment",
                 "Finding", "EvidenceRef", "Review"):
        assert hasattr(domain, name), name
    assert len(EVENT_TYPES) == 10
    assert {EXIT_READY, EXIT_NOT_READY, EXIT_ENGINE_ERROR} == {0, 1, 2}
    assert COMMENT_MARKER == "<!-- ccommit-check -->"
    for m in (AgentEvent, SseEnvelope, Readiness, FindingCandidate, Bundle, ProductEvidenceConfig, CiResult, Baseline):
        m.model_json_schema()
    # discriminated union round-trips
    c = FindingCandidate.model_validate({
        "requirement_id": "X-01", "conclusion": "insufficient_evidence", "title": "t", "reasoning_summary": "r",
        "evidence": [{"type": "missing", "artifact_kind": "privacy_policy"}],
        "confidence": {"applicability": 1, "evidence": 0.5, "finding": 0.5}})
    assert c.evidence[0].type == "missing"


def test_fixtures_validate(fixtures_dir):
    provs = {p.id: p for p in ProvisionsFixture.model_validate_json((fixtures_dir / "provisions.json").read_text()).provisions}
    reqs = {r.id: r for r in RequirementsFixture.model_validate_json((fixtures_dir / "requirements.json").read_text()).requirements}
    assert len(reqs) == 10 and len(reqs["GDPR-INFO-01"].remediation.parts) == 1
    for p in provs.values():
        assert p.source_url.startswith(("http://publications.europa.eu/resource/celex/", "https://www.legifrance.gouv.fr/", "https://www.esma.europa.eu/"))
    celex = {p.celex for p in provs.values() if p.celex}
    assert {"32016R0679", "32014L0065", "32017R0565", "32024R1689"} <= celex
    assert {"cmf-l541-1", "cmf-l546-1"} <= set(provs) and provs["cmf-l541-1"].source == "manual"
    part_ids = {part.id for r in reqs.values() for part in r.remediation.parts}
    assert part_ids == {"P1", "P2", "P3", "P4", "P5", "P6", "A1", "A2", "A3", "A4"}

    gates = {}
    for key in FIXTURES:
        fx = load_release(fixtures_dir, key)
        gates[key] = fx.readiness.gate
        assert len(fx.findings) == 10
        arts = {a.id: a for a in fx.artifacts}
        paths = {a.id: a.path for a in fx.artifacts}
        for f in fx.findings:
            req = reqs[f.requirement_id]
            assert f.severity == req.severity
            assert set(f.citations) <= set(req.derived_from) and set(f.citations) <= set(provs)
            assert f.evidence_fingerprint == evidence_fingerprint(f.evidence, paths)
            for ref in f.evidence:
                if ref.type == "document_span":
                    a = arts[ref.artifact_id]
                    assert a.text[ref.start:ref.end] == ref.quote
                elif ref.type == "code":
                    code = {c.path: c.content for c in arts[ref.artifact_id].files}[ref.path]
                    assert ref.quote in "\n".join(code.split("\n")[ref.start_line - 1:ref.end_line])
            if f.conclusion in ("potential_violation", "satisfied"):
                assert any(r.type != "missing" for r in f.evidence) and f.citations
            if f.conclusion == "insufficient_evidence":
                assert any(r.type == "missing" for r in f.evidence)
        assert "AI pre-assessment, not legal advice" in fx.readiness.labels
    assert gates == {"0.9.0": "NOT_READY", "rc": "NOT_READY", "1.0.0": "READY"}

    # carry-forward: same W8 fingerprint across releases, review applies in rc and 1.0.0
    w8 = {k: next(f for f in load_release(fixtures_dir, k).findings if f.requirement_id == "AI-TRANSPARENCY-01") for k in FIXTURES}
    assert len({f.evidence_fingerprint for f in w8.values()}) == 1
    assert w8["0.9.0"].applicable_review is None and w8["1.0.0"].carried_from_version == "0.9.0"
    assert load_release(fixtures_dir, "1.0.0").readiness.gate_label == "Ready"
    assert load_release(fixtures_dir, "1.0.0").readiness.labels[1] == "counsel-reviewed 1/10"

    events = json.loads((fixtures_dir / "events-0.9.0.json").read_text())
    evs = [AgentEvent.model_validate(e) for e in events]
    assert 60 <= len(evs) <= 120
    assert [e.seq for e in evs] == list(range(1, len(evs) + 1))
    assert {e.type for e in evs} == set(EVENT_TYPES)
    assert all(a.ts <= b.ts for a, b in zip(evs, evs[1:]))
    assert evs[-1].type == "run_end" and all(len(e.output_preview or "") <= 2048 for e in evs)
    with_model = {e.requirement_id for e in evs if e.type == "model_request"}
    assert {e.requirement_id for e in evs if e.type == "finding"} == with_model | {"FR-NO-EXECUTION-01"}


def test_expected_matches_fixtures(repo_root, fixtures_dir):
    exp = yaml.safe_load((repo_root / "demo/wealthpilot/expected.yaml").read_text())
    aliases = [r["alias"] for r in exp["requirements"]]
    assert aliases == ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "C1", "C2"]
    for key in FIXTURES:
        fx = load_release(fixtures_dir, key)
        by_req = {f.requirement_id: f for f in fx.findings}
        assert exp["releases"][key]["gate"] == fx.readiness.gate
        for r in exp["requirements"]:
            assert set(r["conclusion"]) == set(FIXTURES) == set(r["effective_conclusion"])
            f = by_req[r["id"]]
            assert (f.conclusion, f.effective_conclusion) == (r["conclusion"][key], r["effective_conclusion"][key]), (key, r["alias"])
    # SPEC 6.9 table, effective conclusions at v0.9.0 / rc / 1.0.0
    table = {r["alias"]: [r["effective_conclusion"][k] for k in ("0.9.0", "rc", "1.0.0")] for r in exp["requirements"]}
    assert table["W1"] == ["potential_violation", "potential_violation", "satisfied"]
    assert table["W2"] == ["potential_violation", "potential_violation", "satisfied"]
    assert table["W3"] == ["insufficient_evidence", "satisfied", "satisfied"]
    assert table["W8"] == ["uncertain", "not_applicable", "not_applicable"]
    assert table["C1"] == ["not_applicable"] * 3 and table["C2"] == ["satisfied"] * 3
    assert exp["releases"]["rc"]["changes_since_previous"]["resolved"].__len__() == 5


def test_pack_schema_and_product_config(repo_root, fixtures_dir):
    schema = json.loads((repo_root / "data/packs/schema.json").read_text())
    jsonschema.Draft202012Validator.check_schema(schema)
    reqs = json.loads((fixtures_dir / "requirements.json").read_text())["requirements"]
    prov = json.loads((fixtures_dir / "provisions.json").read_text())["provisions"]
    pack = {
        "id": "fintech-eu-fr", "version": "0.1.0", "title": "EU + France fintech", "jurisdictions": ["EU", "FR"],
        "provision_refs": [{k: v for k, v in p.items() if v is not None and k in ("id", "kind", "source", "issuer", "jurisdiction", "celex", "legi_id", "article", "paragraph")} for p in prov],
        "requirements": [{k: v for k, v in r.items()} for r in reqs],
    }
    jsonschema.validate(pack, schema)
    cfg = yaml.safe_load((repo_root / "data/products/wealthpilot.yaml").read_text())
    c = ProductEvidenceConfig.model_validate(cfg)
    assert c.product_id == "wealthpilot" and any(d.path == "compliance/business-plan.md" for d in c.documents)
    from cco.contracts.domain import RegulatoryProfile
    assert RegulatoryProfile.model_validate(c.profile).jurisdictions == ["EU", "FR"]


def test_openapi_exports(repo_root):
    from cco.contracts.stub_app import app
    spec = app.openapi()
    for name in ("AgentEvent", "SseEnvelope", "FindingCandidate", "Readiness", "FindingView", "ReviewCreate"):
        assert name in spec["components"]["schemas"], name
    assert "/api/releases/{release_id}/readiness" in spec["paths"] and "/api/runs/{run_id}/events" in spec["paths"]
    committed = repo_root / "contracts/openapi.json"
    assert committed.exists() and json.loads(committed.read_text()) == json.loads(json.dumps(spec))
    assert (repo_root / "frontend/src/api/types.ts").exists()
    assert (repo_root / "scripts/gen_types.sh").exists()


def test_bundle_paths(tmp_path, monkeypatch):
    monkeypatch.delenv("CCO_DATA_DIR", raising=False)
    assert bundle_root("rel-1") == Path("data/runtime/bundles/rel-1")
    monkeypatch.setenv("CCO_DATA_DIR", str(tmp_path))
    b = Bundle.for_release("rel-1")
    assert b.root_path == str(tmp_path / "bundles" / "rel-1")
    assert b.compliance_path == str(tmp_path / "bundles" / "rel-1" / "compliance")
