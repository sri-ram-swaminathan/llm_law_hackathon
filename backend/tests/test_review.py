import pytest
from fastapi.testclient import TestClient

from cco.main import create_app
from cco.seed import seed

H = {"Authorization": "Bearer test-deploy-token"}


@pytest.fixture()
def client():
    app = create_app("sqlite://")
    with TestClient(app) as c:
        with app.state.sessionmaker() as s:
            seed(s)
            s.commit()
        yield c


def _finding(c, rel, req):
    fs = c.get(f"/api/assessments/{rel}/findings", headers=H).json()
    return next(f for f in fs if f["requirement_id"] == req)


def _review(c, fid, **kw):
    body = {"reviewer_name": "Claire", "decision": "confirm", **kw}
    r = c.post(f"/api/findings/{fid}/reviews", headers=H, json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_carry_forward(client):
    # W1 evidence changes between rc and 1.0.0 (fingerprint differs): no carry. W2 (GDPR-INFO-01) same in rc and 1.0.0: carries.
    f_rc = _finding(client, "asm-rc", "GDPR-INFO-01")
    rev = _review(client, f_rc["id"], decision="override", override_conclusion="uncertain")
    f_rel = _finding(client, "asm-1.0.0", "GDPR-INFO-01")
    assert f_rel["evidence_fingerprint"] == f_rc["evidence_fingerprint"]
    assert f_rel["applicable_review"]["id"] == rev["id"]
    assert f_rel["carried_from_version"] == "1.0.0-rc.12"
    assert f_rel["effective_conclusion"] == "uncertain"
    # changed fingerprint does not carry
    w1_rc = _finding(client, "asm-rc", "FR-CIF-STATUS-01")
    _review(client, w1_rc["id"], decision="override", override_conclusion="satisfied")
    w1_rel = _finding(client, "asm-1.0.0", "FR-CIF-STATUS-01")
    assert w1_rel["evidence_fingerprint"] != w1_rc["evidence_fingerprint"]
    assert w1_rel["applicable_review"] is None
    # revoke restores the AI conclusion everywhere (REVIEW_REQUIRED for uncertain)
    client.post(f"/api/reviews/{rev['id']}/revoke", headers=H)
    f_rel = _finding(client, "asm-1.0.0", "GDPR-INFO-01")
    assert f_rel["applicable_review"] is None and f_rel["effective_conclusion"] == "satisfied"


def test_w8_review_carries_and_revoke_requires_review(client):
    w8 = _finding(client, "asm-1.0.0", "AI-TRANSPARENCY-01")
    assert w8["effective_conclusion"] == "not_applicable" and w8["carried_from_version"] == "0.9.0"
    assert client.get("/api/releases/rel-1.0.0/readiness", headers=H).json()["gate"] == "READY"
    rid = w8["applicable_review"]["id"]
    client.post(f"/api/reviews/{rid}/revoke", headers=H)
    r = client.get("/api/releases/rel-1.0.0/readiness", headers=H).json()
    assert r["gate"] == "REVIEW_REQUIRED" and r["gate_label"] == "Review required"
    assert r["counts"]["uncertain_unreviewed"] == 1


def test_latest_review_wins(client):
    f = _finding(client, "asm-rc", "GDPR-INFO-01")
    _review(client, f["id"], decision="override", override_conclusion="uncertain")
    _review(client, f["id"], decision="override", override_conclusion="not_applicable")
    assert _finding(client, "asm-rc", "GDPR-INFO-01")["effective_conclusion"] == "not_applicable"
