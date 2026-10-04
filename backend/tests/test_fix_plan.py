import re
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from cco.main import create_app
from cco.pack import load_pack
from cco.seed import seed

H = {"Authorization": "Bearer test-deploy-token"}
GOLDEN = Path(__file__).resolve().parents[2] / "demo/wealthpilot/v0.9.0/remediation-plan.md"
FINTECH = Path("/Users/rgrebnev/Documents/projects/FinTechProto")


@pytest.fixture()
def client():
    app = create_app("sqlite://")
    with TestClient(app) as c:
        with app.state.sessionmaker() as s:
            seed(s)
            s.commit()
        yield c


def plan(c, with_reviews: bool = True) -> str:
    if not with_reviews:  # the seed carries the counsel review on W8 (closes A4); drop it to match the golden
        from cco.models import ReviewRow

        with c.app.state.sessionmaker() as s:
            s.query(ReviewRow).delete()
            s.commit()
    rels = c.get("/api/releases", headers=H).json()
    asm = next(r for r in rels if r["release"]["version"] == "0.9.0")["latest_assessment"]["id"]
    r = c.get(f"/api/assessments/{asm}/fix-plan.md", headers=H)
    assert r.status_code == 200
    return r.text


def sections(md: str):
    """[(requirement id, locations, boundaries, depends)] of code items, in order."""
    out = []
    for blk in re.split(r"^## \d+\. ", md, flags=re.M)[1:]:
        rid = re.match(r"([A-Z0-9-]+)", blk).group(1)
        locs = [re.match(r"`([^`]+)`", x).group(1) for x in re.findall(r"^- (`[^\n]*)", blk.split("**Required change**")[0], flags=re.M)]
        b = blk.split("**Boundaries:**")[1].split("\n")[0]
        deps = re.findall(r"appendix A\d|\bA\d\b", blk.split("**Problem:**")[0].split("**Depends on:**")[1]) if "**Depends on:**" in blk else []
        out.append((rid, locs, re.findall(r"`([^`]+)`", b), deps))
    return out


def test_matches_golden_structure(client):
    got, gold = plan(client, with_reviews=False), GOLDEN.read_text()
    g, e = sections(got), sections(gold)
    assert [x[0] for x in g] == [x[0] for x in e]  # ids, order
    assert [x[1] for x in g] == [x[1] for x in e]  # locations (golden has a description after the anchor)
    assert [bool(x[3]) for x in g] == [bool(x[3]) for x in e]  # depends_on A1 on the CIF item
    # appendix: ids, requirements, in order
    rows = lambda md: re.findall(r"^\| (A\d) \| ([A-Z0-9-]+)", md, flags=re.M)
    assert rows(got) == rows(gold) == [("A1", "FR-CIF-STATUS-01"), ("A2", "GDPR-INFO-01"), ("A3", "FR-CIF-STATUS-01"), ("A4", "AI-TRANSPARENCY-01")]
    assert "**NOT READY**" in got and "AI pre-assessment, not legal advice" in got
    # boundaries come from the pack template: compare to golden for items that list files in backticks
    pack = {r.id: r for r in load_pack().requirements}
    for rid, _, bnd, _ in g:
        parts = [p for p in pack[rid].remediation.parts if p.kind == "code"]
        assert bnd == [f"{b}" for b in parts[0].boundaries]


def test_deterministic(client):
    assert plan(client).encode() == plan(client).encode()


def test_locations_exist_at_v090():
    if not (FINTECH / ".git").exists():
        pytest.skip("FinTechProto not available")
    n = 0
    for r in load_pack().requirements:
        for p in r.remediation.parts:
            for loc in p.locations:
                if p.kind != "code":
                    continue
                path, _, rng = loc.partition(":")
                out = subprocess.run(["git", "-C", str(FINTECH), "show", f"v0.9.0:{path}"], capture_output=True, text=True)
                assert out.returncode == 0, loc
                if rng:
                    last = int(rng.split("-")[-1])
                    assert last <= len(out.stdout.splitlines()), loc
                n += 1
    assert n >= 15


def test_counsel_review_closes_item(client):
    # seeded W8 counsel review (not_applicable) removes appendix item A4 from the plan
    assert "| A4 |" not in plan(client)
