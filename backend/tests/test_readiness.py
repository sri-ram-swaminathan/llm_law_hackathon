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


def _ch(c, rel):
    return c.get(f"/api/releases/{rel}/readiness", headers=H).json()["changes_since_previous"]


def test_changes_rc_vs_090(client):
    ch = _ch(client, "rel-1.0.0-rc.12")
    assert sorted(ch["resolved"]) == sorted(
        ["GDPR-INFO-01", "FR-SUITABILITY-UPDATE-01", "GDPR-ERASURE-01", "GDPR-SECURITY-01", "FR-SUITABILITY-REPORT-01"]
    )
    assert ch["new"] == []
    assert "AI-TRANSPARENCY-01" in ch["unchanged"]  # uncertain -> not_applicable by review is unchanged


def test_changes_100_vs_rc(client):
    ch = _ch(client, "rel-1.0.0")
    assert sorted(ch["resolved"]) == ["FR-CIF-STATUS-01", "FR-SUITABILITY-01"]
    assert ch["new"] == []


def test_first_release_has_no_changes(client):
    assert _ch(client, "rel-0.9.0") == {"resolved": [], "new": [], "unchanged": []}


def test_labels(client):
    r = client.get("/api/releases/rel-1.0.0/readiness", headers=H).json()
    assert r["gate"] == "READY" and r["gate_label"] == "Ready"  # W8 counsel review present
    assert "counsel-reviewed 1/10" in r["labels"]
    # revoke the only review: no counsel input -> "Ready (AI)" requires READY; here uncertain blocks instead
    rc = client.get("/api/releases/rel-0.9.0/readiness", headers=H).json()
    assert rc["gate_label"] == "Not ready" and "counsel-reviewed 1/10" in rc["labels"]
