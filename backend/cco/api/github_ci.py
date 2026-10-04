"""GitHub release check: latest `compliance` runs on the product repo, and a re-run of the release PR's check.

GET  /github/checks  → the latest compliance runs (status, conclusion, commit, PR, run URL)
POST /github/rerun   → re-run the latest compliance run of the open release PR on GitHub Actions; returns its URL

Needs GITHUB_TOKEN (repo + workflow scope) in the API environment. Without it both routes answer 503 with a
plain reason. The repo comes from CCO_GITHUB_REPO (default RomanGrebnev/FinTechProto). Nothing runs locally here:
the audit runs on GitHub's runner, exactly like a push to the PR.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["github"])

WORKFLOW = "compliance.yml"


def _repo() -> str:
    return os.environ.get("CCO_GITHUB_REPO", "RomanGrebnev/FinTechProto")


def _gh(path: str, method: str = "GET", body: dict | None = None):
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not token:
        raise HTTPException(503, "GitHub is not connected: set GITHUB_TOKEN for the API")
    req = urllib.request.Request(
        f"https://api.github.com{path}", method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "ccommit"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raise HTTPException(502, f"GitHub answered {e.code}: {e.read().decode(errors='replace')[:200]}") from e
    except urllib.error.URLError as e:
        raise HTTPException(502, f"GitHub unreachable: {e.reason}") from e


def _run_out(r: dict) -> dict:
    prs = r.get("pull_requests") or []
    return {
        "id": r["id"], "url": r["html_url"], "status": r["status"], "conclusion": r.get("conclusion"),
        "event": r["event"], "branch": r.get("head_branch"), "sha": (r.get("head_sha") or "")[:7],
        "attempt": r.get("run_attempt", 1), "created_at": r.get("created_at"), "updated_at": r.get("updated_at"),
        "pr_number": prs[0]["number"] if prs else None,
        "pr_url": f"https://github.com/{_repo()}/pull/{prs[0]['number']}" if prs else None,
    }


@router.get("/github/checks")
def github_checks(limit: int = 5):
    data = _gh(f"/repos/{_repo()}/actions/workflows/{WORKFLOW}/runs?per_page={max(1, min(limit, 20))}")
    return {"repo": _repo(), "runs": [_run_out(r) for r in data.get("workflow_runs", [])]}


@router.post("/github/rerun")
def github_rerun():
    """Re-run the newest pull_request run of the open release PR (its head is the code under review)."""
    repo = _repo()
    open_prs = _gh(f"/repos/{repo}/pulls?state=open&per_page=10") or []
    if not open_prs:
        raise HTTPException(409, "No open release PR on GitHub. Open one (demo_reset + demo_push 1) first.")
    pr = open_prs[0]
    runs = _gh(f"/repos/{repo}/actions/workflows/{WORKFLOW}/runs?event=pull_request&branch={pr['head']['ref']}&per_page=10")
    run = next((r for r in runs.get("workflow_runs", []) if r.get("head_sha") == pr["head"]["sha"]), None)
    if run is None:
        raise HTTPException(409, f"No compliance run yet for PR #{pr['number']} at {pr['head']['sha'][:7]}")
    if run["status"] != "completed":
        return {"started": False, "reason": "already running", "run": _run_out(run), "pr_url": pr["html_url"]}
    _gh(f"/repos/{repo}/actions/runs/{run['id']}/rerun", method="POST", body={})
    time.sleep(1.5)  # let GitHub flip the run to queued so the link opens on the new attempt
    fresh = _gh(f"/repos/{repo}/actions/runs/{run['id']}")
    return {"started": True, "run": _run_out(fresh), "pr_url": pr["html_url"]}
