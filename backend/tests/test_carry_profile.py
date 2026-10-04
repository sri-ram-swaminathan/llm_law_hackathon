import pytest
from fastapi.testclient import TestClient

from cco import gate
from cco.api import deps
from cco.cli.ci import _baseline_review_row, baseline_from_views
from cco.main import create_app
from cco.models import ProductRow
from cco.seed import seed

H = {"Authorization": "Bearer test-deploy-token"}


@pytest.fixture()
def app_client():
    app = create_app("sqlite://")
    with TestClient(app) as c:
        with app.state.sessionmaker() as s:
            seed(s)
            s.commit()
        yield app, c


def _finding(c, rel, req):
    fs = c.get(f"/api/assessments/{rel}/findings", headers=H).json()
    return next(f for f in fs if f["requirement_id"] == req)


def _na(c, fid):
    r = c.post(f"/api/findings/{fid}/reviews", headers=H, json={"reviewer_name": "Claire", "decision": "not_applicable"})
    assert r.status_code == 201, r.text
    return r.json()


def test_profile_hash_stored(app_client):
    app, c = app_client
    rev = _na(c, _finding(c, "asm-rc", "GDPR-INFO-01")["id"])
    with app.state.sessionmaker() as s:
        assert rev["evidence_fingerprint"] == "profile:" + gate.profile_hash(deps.get_product(s)[1])
    f = _finding(c, "asm-rc", "FR-CIF-STATUS-01")
    r = c.post(f"/api/findings/{f['id']}/reviews", headers=H, json={"reviewer_name": "C", "decision": "confirm"}).json()
    assert r["evidence_fingerprint"] == f["evidence_fingerprint"]


def test_not_applicable_carries_across_runs(app_client):
    app, c = app_client
    f_rc = _finding(c, "asm-rc", "FR-CIF-STATUS-01")
    assert _finding(c, "asm-1.0.0", "FR-CIF-STATUS-01")["evidence_fingerprint"] != f_rc["evidence_fingerprint"]
    rev = _na(c, f_rc["id"])
    f_rel = _finding(c, "asm-1.0.0", "FR-CIF-STATUS-01")
    assert f_rel["applicable_review"]["id"] == rev["id"]
    assert f_rel["carried_from_version"] == "1.0.0-rc.12"
    assert f_rel["effective_conclusion"] == "not_applicable"


def test_profile_change_breaks_carry(app_client):
    app, c = app_client
    _na(c, _finding(c, "asm-rc", "FR-CIF-STATUS-01")["id"])
    with app.state.sessionmaker() as s:
        row = s.get(ProductRow, deps.get_product(s)[0].id)
        row.profile = {**row.profile, "ai_uses": [*row.profile["ai_uses"], "new-use"]}
        s.commit()
    assert _finding(c, "asm-1.0.0", "FR-CIF-STATUS-01")["applicable_review"] is None


def test_baseline_carry(app_client):
    app, c = app_client
    _na(c, _finding(c, "asm-rc", "FR-CIF-STATUS-01")["id"])
    with app.state.sessionmaker() as s:
        views = deps.assessment_views(s, deps.latest_assessment(s, "rel-1.0.0", completed_only=True))
        bl = baseline_from_views("1.0.0", views)
        bl = type(bl).model_validate_json(bl.model_dump_json())
    br = next(b for b in bl.reviews if b.requirement_id == "FR-CIF-STATUS-01")
    assert br.evidence_fingerprint.startswith("profile:")
    app2 = create_app("sqlite://")
    with TestClient(app2):
        with app2.state.sessionmaker() as s:
            seed(s)
            s.add(_baseline_review_row(bl, br))
            s.commit()
            v = next(v for v in deps.assessment_views(s, deps.latest_assessment(s, "rel-1.0.0", completed_only=True))
                     if v.requirement_id == "FR-CIF-STATUS-01")
            assert v.effective_conclusion == "not_applicable"
