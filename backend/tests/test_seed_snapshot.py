"""The committed demo snapshot (demo/snapshot) restores real, validated live runs. No network."""

import json
from pathlib import Path

import pytest

from cco import seed
from cco.api import deps
from cco.contracts import CodeRef
from cco.db import init_db, make_engine, make_sessionmaker
from cco.models import ProductRow

SNAP = Path(__file__).resolve().parents[2] / "demo" / "snapshot"
W1, W2, W8 = "FR-CIF-STATUS-01", "FR-SUITABILITY-01", "AI-TRANSPARENCY-01"


@pytest.fixture
def session(tmp_path, monkeypatch):
    monkeypatch.setenv("CCO_DATA_DIR", str(tmp_path / "data"))
    engine = make_engine(f"sqlite:///{tmp_path}/db.sqlite")
    init_db(engine)
    with make_sessionmaker(engine)() as s:
        yield s


def test_snapshot_seed_gates(session, tmp_path):
    from cco.demo import restore

    manifest = json.loads((SNAP / "MANIFEST.json").read_text())
    out = restore(session, SNAP)
    session.commit()
    assert out == {"releases": ["0.9.0", "1.0.0-rc.12", "1.0.0"], "reviews": 1}

    assert session.get(ProductRow, "wealthpilot").profile["confirmed_at"]
    by_version = {r.version: r for r in deps.list_releases(session)}
    commits = {m["version"]: m["commit"] for m in manifest["releases"]}
    for v, rel in by_version.items():
        assert rel.ci_run_url is None or rel.source == "ci"  # no fabricated CI links
        assert rel.source != "ci" and rel.pr_number is None
        assert rel.git_sha == commits[v] and len(rel.git_sha) == 40
        assert deps.release_artifacts(session, rel.id)  # bundle re-ingested: evidence resolves

    r09 = deps.release_readiness(session, "rel-0.9.0")
    assert r09.gate == "NOT_READY"
    assert {W1, W2} <= set(r09.blockers)
    assert deps.release_readiness(session, "rel-1.0.0").gate == "READY"

    # W8 counsel review exists on 0.9.0 and carries to rc and 1.0.0
    for rid in ("rel-0.9.0", "rel-1.0.0-rc.12", "rel-1.0.0"):
        views = deps.assessment_views(session, deps.latest_assessment(session, rid))
        w8 = next(v for v in views if v.requirement_id == W8)
        assert w8.effective_conclusion == "not_applicable" and w8.applicable_review is not None

    # code evidence on 0.9.0 W1 or W2
    views = deps.assessment_views(session, deps.latest_assessment(session, "rel-0.9.0"))
    code = [e for v in views if v.requirement_id in (W1, W2) for e in v.evidence if isinstance(e, CodeRef)]
    assert code, "snapshot must carry at least one code ref on 0.9.0 W1/W2"


def test_restore_is_repeatable(session):
    from cco.demo import restore

    restore(session, SNAP)
    session.commit()
    assert restore(session, SNAP)["releases"] == ["0.9.0", "1.0.0-rc.12", "1.0.0"]
    session.commit()
    assert len(deps.list_releases(session)) == 3


def test_fixture_seed_has_no_fake_ci_links(session):
    seed.seed(session)
    for rel in deps.list_releases(session):
        assert rel.ci_run_url is None and rel.pr_number is None and rel.source != "ci"
