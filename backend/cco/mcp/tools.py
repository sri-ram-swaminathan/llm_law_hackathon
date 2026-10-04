"""The four MCP tools. Pure functions over a Session; server.py wires them to the SDK and the recorder."""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..api import deps
from ..api.provisions import find_provision
from ..fixplan.render import render_fix_plan_for_version, resolve_release


def _assessment(s: Session, version: str | None):
    rel = resolve_release(s, version)
    a = deps.latest_assessment(s, rel.id, completed_only=True)
    if a is None:
        raise ValueError(f"release {rel.version!r} has no completed assessment")
    return rel, a


def get_release_readiness(s: Session, version: str | None = None) -> dict:
    rel, _ = _assessment(s, version)
    return deps.release_readiness(s, rel.id).model_dump(mode="json")


def list_findings(s: Session, version: str | None = None, severity: str | None = None, conclusion: str | None = None) -> list[dict]:
    _, a = _assessment(s, version)
    out = []
    for v in deps.assessment_views(s, a):
        if severity and v.severity != severity:
            continue
        if conclusion and conclusion not in (v.conclusion, v.effective_conclusion):
            continue
        out.append({
            "id": v.id, "requirement_id": v.requirement_id, "title": v.title, "severity": v.severity,
            "conclusion": v.conclusion, "effective_conclusion": v.effective_conclusion,
            "carried_from_version": v.carried_from_version,
        })
    return out


def get_finding(s: Session, id: str) -> dict:
    from ..models import FindingRow

    row = s.get(FindingRow, id)
    if row is None:
        raise ValueError(f"finding {id!r} not found")
    a = deps.get_assessment(s, row.assessment_id)
    view = next(v for v in deps.assessment_views(s, a) if v.id == id)
    reqs = deps.load_requirements(s)
    d = view.model_dump(mode="json")
    d["requirement"] = reqs[view.requirement_id].model_dump(mode="json") if view.requirement_id in reqs else None
    d["provisions"] = [p.model_dump(mode="json", exclude={"embedding"}) for p in (find_provision(c) for c in view.citations) if p]
    return d


def get_remediation_plan(s: Session, version: str | None = None) -> str:
    return render_fix_plan_for_version(s, version)
