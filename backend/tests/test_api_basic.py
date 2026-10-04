import pytest
from fastapi.testclient import TestClient

from cco.main import create_app
from cco.redact import redact
from cco.seed import seed

H = {"Authorization": "Bearer test-deploy-token"}


@pytest.fixture()
def client():
    app = create_app("sqlite://")
    with TestClient(app) as c:
        with app.state.sessionmaker() as s:
            seed(s)
            s.commit()
        c.app_state = app.state
        yield c


def test_startup():
    app = create_app("sqlite://")
    with TestClient(app) as c:
        assert c.get("/healthz").json() == {"status": "ok"}
        assert c.get("/mcp/").status_code in (404, 405, 307)  # stub mounted, not an error page of /api


def test_seed_idempotent(client):
    with client.app_state.sessionmaker() as s:
        again = seed(s)
        s.commit()
    assert again["releases"] == 3
    rels = client.get("/api/releases", headers=H).json()
    assert [r["release"]["version"] for r in rels] == ["1.0.0", "1.0.0-rc.12", "0.9.0"]
    f = client.get(f"/api/assessments/{rels[2]['latest_assessment']['id']}/findings", headers=H).json()
    assert len(f) == 10
    with client.app_state.sessionmaker() as s:
        from sqlalchemy import func, select

        from cco.models import AgentEventRow, ReviewRow

        assert s.scalar(select(func.count()).select_from(ReviewRow)) == 1
        assert s.scalar(select(func.count()).select_from(AgentEventRow)) == 118


def test_auth(client):
    assert client.get("/api/releases").status_code == 401
    assert client.get("/api/releases", headers={"Authorization": "Bearer nope"}).status_code == 401
    assert client.get("/api/releases", headers=H).status_code == 200
    assert client.get("/healthz").status_code == 200


def test_read_endpoints(client):
    p = client.get("/api/product", headers=H).json()
    assert p["product"]["id"] == "wealthpilot"
    prof = p["profile"]
    prof["stage"] = "launched"
    put = client.put("/api/product/profile", json=prof, headers=H)
    assert put.status_code == 200 and put.json()["confirmed_at"]
    assert client.get("/api/product", headers=H).json()["profile"]["stage"] == "launched"

    rel = client.get("/api/releases/rel-0.9.0", headers=H).json()
    assert rel["release"]["version"] == "0.9.0" and len(rel["artifacts"]) == 4
    assert client.get("/api/releases/nope", headers=H).status_code == 404

    r = client.get("/api/releases/rel-0.9.0/readiness", headers=H).json()
    assert r["gate"] == "NOT_READY" and r["counsel_reviewed"] == {"reviewed": 1, "total": 10}  # W8 counsel review
    r = client.get("/api/releases/rel-1.0.0/readiness", headers=H).json()
    assert (r["gate"], r["gate_label"]) == ("READY", "Ready")

    fs = client.get("/api/assessments/asm-1.0.0/findings", headers=H).json()
    w8 = next(f for f in fs if f["requirement_id"] == "AI-TRANSPARENCY-01")
    assert w8["carried_from_version"] == "0.9.0" and w8["effective_conclusion"] == "not_applicable"
    d = client.get("/api/findings/f-0.9.0-W1", headers=H).json()
    assert d["requirement"]["alias"] == "W1" and d["provisions"]
    assert client.get("/api/artifacts/art-0.9.0-business-plan", headers=H).json()["kind"] == "business_plan"
    pid = d["provisions"][0]["id"]
    assert client.get(f"/api/provisions/{pid}", headers=H).status_code == 200
    assert client.get("/api/provisions/zzz", headers=H).status_code == 404


def test_reviews(client):
    fid = "f-0.9.0-W1"
    bad = client.post(f"/api/findings/{fid}/reviews", headers=H, json={"reviewer_name": "C", "decision": "override"})
    assert bad.status_code == 422
    ok = client.post(
        f"/api/findings/{fid}/reviews", headers=H,
        json={"reviewer_name": "Claire", "decision": "override", "override_conclusion": "satisfied", "comment": "x"},
    )
    assert ok.status_code == 201
    rev = ok.json()
    f = client.get(f"/api/findings/{fid}", headers=H).json()["finding"]
    assert f["conclusion"] == "potential_violation"  # AI value immutable
    assert f["effective_conclusion"] == "satisfied" and f["applicable_review"]["id"] == rev["id"]
    assert client.get("/api/releases/rel-0.9.0/readiness", headers=H).json()["counsel_reviewed"]["reviewed"] == 2
    rv = client.post(f"/api/reviews/{rev['id']}/revoke", headers=H).json()
    assert rv["revoked_at"]
    f = client.get(f"/api/findings/{fid}", headers=H).json()["finding"]
    assert f["effective_conclusion"] == "potential_violation" and f["applicable_review"] is None
    assert client.post("/api/findings/nope/reviews", headers=H, json={"reviewer_name": "C", "decision": "confirm"}).status_code == 404


def test_cors(client):
    for origin in ("http://localhost:20001", "http://127.0.0.1:20001"):
        r = client.options("/api/releases", headers={"Origin": origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization"})
        assert r.headers["access-control-allow-origin"] == origin
    r = client.options("/api/releases", headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in r.headers


def test_redact():
    assert "sk-" not in redact("key sk-abcdefghijklmnopqrstuvwx1234")
    assert "wJalr" not in redact('AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"')
    assert "hunter22" not in redact("password: hunter22x".replace("x", ""))
    assert "pw" not in redact("postgresql://user:pw123456@host/db")
    assert "ghp_" not in redact("token ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2")
    assert redact("Disclaimer: this is not financial advice.") == "Disclaimer: this is not financial advice."
    assert redact("def calculate_portfolio_rebalance_weights(user_profile):") == "def calculate_portfolio_rebalance_weights(user_profile):"
