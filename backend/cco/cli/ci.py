"""CI surface (SPEC §6.12): `cco audit`, `cco import`, `cco export-baseline`.

`run_audit` is the shared core (also used by the eval harness): fresh SQLite DB, baseline reviews applied,
bundle ingested, pipeline run, result/comment/fix-plan written. Engine failures are never reported as NOT_READY.
"""

from __future__ import annotations

import asyncio
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import typer
from sqlalchemy import select

from cco import pipeline
from cco.api import deps
from cco.contracts import Assessment, FindingView, Readiness, Release, Requirement, Review
from cco.contracts.activity import AgentEvent
from cco.contracts.ci import (
    BASELINE_FORMAT_VERSION,
    BASELINE_PATH,
    COMMENT_MARKER,
    EXIT_ENGINE_ERROR,
    EXIT_NOT_READY,
    Baseline,
    BaselineReview,
    CiResult,
    exit_code_for_gate,
)
from cco.contracts.readiness import AI_LABEL, ChangesSinceVersion, CounselReviewed, GateCounts
from cco.fixplan import render_fix_plan as _render_fix_plan
from cco.db import init_db, make_engine, make_sessionmaker, session_scope
from cco.ingest import BundleError, ingest_bundle
from cco.models import (
    AgentEventRow,
    AssessmentRow,
    FindingRow,
    ReleaseRow,
    ReviewRow,
)
from cco.contracts import CodeRef, Finding

PRODUCT_ID = "wealthpilot"
PROBLEMS = {"potential_violation", "insufficient_evidence"}
GATE_TEXT = {"NOT_READY": ("❌", "NOT READY"), "REVIEW_REQUIRED": ("⚠️", "REVIEW REQUIRED"), "READY": ("✅", "READY")}


@dataclass
class AuditOutcome:
    exit_code: int
    result: CiResult
    out: Path


# ------------------------------------------------------------------ pure rendering


def release_version(version: str, pr: int | None, run_number: int | None) -> str:
    """PR run -> <version>-rc.<run_number>; tag / dispatch run -> <version>."""
    return f"{version}-rc.{run_number}" if pr is not None and run_number is not None else version


def changes_vs_baseline(views: list[FindingView], baseline: Baseline | None) -> ChangesSinceVersion:
    """Same semantics as gate.compute_changes, with the baseline's effective conclusions as 'previous'."""
    if baseline is None or not baseline.conclusions:
        return ChangesSinceVersion()
    ch = ChangesSinceVersion()
    for v in views:
        was = baseline.conclusions.get(v.requirement_id)
        now_bad = v.effective_conclusion in PROBLEMS
        if now_bad and was not in PROBLEMS:
            ch.new.append(v.requirement_id)
        elif was in PROBLEMS and not now_bad:
            ch.resolved.append(v.requirement_id)
        else:
            ch.unchanged.append(v.requirement_id)
    order = {r: i for i, r in enumerate(baseline.conclusions)}
    ch.resolved.sort(key=lambda r: order.get(r, 0))
    return ch


def _location(view: FindingView) -> str:
    for e in view.evidence:
        if isinstance(e, CodeRef):
            return f"{e.path}:{e.start_line}"
    return "missing evidence" if view.conclusion == "insufficient_evidence" else ""


def render_comment(
    readiness: Readiness,
    views: list[FindingView],
    requirements: dict[str, Requirement],
    *,
    sha: str | None,
    baseline_version: str | None = None,
) -> str:
    icon, text = GATE_TEXT[readiness.gate]
    if readiness.gate == "READY" and readiness.gate_label == "Ready (AI)":
        text = "READY (AI)"
    c = readiness.counts
    cr = readiness.counsel_reviewed
    by_req = {v.requirement_id: v for v in views}
    lines = [
        COMMENT_MARKER,
        f"CCOmmit compliance check · {readiness.version} ({(sha or 'no-sha')[:7]}) · {icon} {text} · {AI_LABEL}",
        f"{c.blockers} blockers · {c.missing_evidence} missing evidence · {c.high} high · "
        f"{c.requirements_total} requirements evaluated · counsel-reviewed {cr.reviewed}/{cr.total}",
    ]
    for rid in readiness.blockers:
        req, v = requirements.get(rid), by_req.get(rid)
        alias = (req.alias if req and req.alias else rid)
        title = req.title if req else rid
        loc = _location(v) if v else ""
        lines.append(f"🔴 {alias} {title}      {loc}".rstrip())
    if baseline_version:
        ch = readiness.changes_since_previous
        lines.append(f"Changes since {baseline_version}: {len(ch.resolved)} resolved · {len(ch.new)} new")
    lines.append("→ Fix plan: see artifact ccommit-result/fix-plan.md")
    return "\n".join(lines) + "\n"


def render_engine_error_comment(version: str, sha: str | None, error: str) -> str:
    return (
        f"{COMMENT_MARKER}\nCCOmmit compliance check · {version} ({(sha or 'no-sha')[:7]}) · ⚪ COULD NOT RUN\n"
        f"CCOmmit could not run: {error}\nThis is not a compliance verdict; re-run the job.\n"
    )


def render_fix_plan(session, assessment_id: str, release: Release) -> str:
    return _render_fix_plan(session, assessment_id)


# ------------------------------------------------------------------ baseline


def load_baseline(path: Path | None) -> Baseline | None:
    if path is None or not path.is_file():
        return None
    return Baseline.model_validate_json(path.read_text("utf-8"))


def _baseline_review_row(b: Baseline, br: BaselineReview) -> ReviewRow:
    rid = f"bl-{b.version or 'initial'}-{br.requirement_id}"
    rev = Review(
        id=rid, finding_id=f"baseline:{b.version or 'initial'}:{br.requirement_id}",
        requirement_id=br.requirement_id, product_id=PRODUCT_ID, reviewer_name=br.reviewer_name,
        decision=br.decision, override_conclusion=br.override_conclusion,  # type: ignore[arg-type]
        comment=br.comment, evidence_fingerprint=br.evidence_fingerprint, created_at=br.created_at,
    )
    return ReviewRow(id=rev.id, finding_id=rev.finding_id, requirement_id=rev.requirement_id,
                     product_id=rev.product_id, created_at=rev.created_at.isoformat(),
                     data=rev.model_dump(mode="json"))


def build_baseline(session, release_version_: str) -> Baseline:
    """Baseline for a stored release: effective conclusions + the counsel reviews that apply to it."""
    row = session.scalars(select(ReleaseRow).where(ReleaseRow.version == release_version_)).first()
    if row is None:
        raise LookupError(f"release {release_version_!r} not found")
    asm = deps.latest_assessment(session, row.id, completed_only=True)
    if asm is None:
        raise LookupError(f"release {release_version_!r} has no completed assessment")
    views = deps.assessment_views(session, asm)
    return baseline_from_views(release_version_, views)


def baseline_from_views(version: str, views: list[FindingView]) -> Baseline:
    reviews = []
    for v in views:
        r = v.applicable_review
        if r is not None and r.revoked_at is None:
            reviews.append(BaselineReview(
                requirement_id=r.requirement_id, decision=r.decision, override_conclusion=r.override_conclusion,
                reviewer_name=r.reviewer_name, comment=r.comment, evidence_fingerprint=r.evidence_fingerprint,
                created_at=r.created_at))
    return Baseline(format_version=BASELINE_FORMAT_VERSION, version=version,
                    conclusions={v.requirement_id: v.effective_conclusion for v in views}, reviews=reviews)


# ------------------------------------------------------------------ audit core


def _engine_error(findings: list[Finding], asm: Assessment) -> str | None:
    if asm.status != "completed":
        return f"assessment {asm.status}"
    # A single failed evaluation is already degraded to `uncertain` and counts in the gate (SPEC §6.12).
    # Only report an engine error when no requirement could be evaluated at all (e.g. Mistral unavailable).
    evaluated = [f for f in findings if f.conclusion != "not_applicable"]
    bad = [f for f in evaluated if any(n.startswith("evaluation error") for n in f.validation_notes)]
    if evaluated and len(bad) == len(evaluated):
        return f"model evaluation failed for all {len(bad)} requirement(s): {bad[0].validation_notes[0][:200]}"
    return None


def run_audit(
    bundle: Path,
    version: str,
    sha: str | None,
    out: Path,
    *,
    baseline: Baseline | None = None,
    pr: int | None = None,
    run_number: int | None = None,
    run_url: str | None = None,
    branch: str | None = None,
    model=None,
    timeout: float | None = 1800,
) -> AuditOutcome:
    out.mkdir(parents=True, exist_ok=True)
    db = out / "cco-ci.db"
    for suffix in ("", "-journal", "-wal", "-shm"):
        Path(str(db) + suffix).unlink(missing_ok=True)
    os.environ["CCO_DATA_DIR"] = str((out / "data").resolve())
    ver = release_version(version, pr, run_number)
    rel_id = f"rel-{ver}"
    release: Release | None = None
    asm: Assessment | None = None
    error: str | None = None
    try:
        engine = make_engine(f"sqlite:///{db}")
        init_db(engine)
        sm = make_sessionmaker(engine)
        with sm() as s:
            pipeline.ensure_base(s)
            if baseline is not None:
                for br in baseline.reviews:
                    s.add(_baseline_review_row(baseline, br))
            release, _ = ingest_bundle(s, Path(bundle), ver, source="ci", git_sha=sha, branch=branch,
                                       pr_number=pr, ci_run_url=run_url)
            s.commit()
        coro = pipeline.run_assessment(rel_id, sm, model=model)
        asm_id = asyncio.run(asyncio.wait_for(coro, timeout) if timeout else coro)
        with sm() as s:
            asm = deps.get_assessment(s, asm_id)
            findings = deps.assessment_findings(s, asm_id)
            error = _engine_error(findings, asm)
            if error is None:
                result = _build_result(s, release, asm, baseline, sha)
                fix_plan = render_fix_plan(s, asm.id, release)
    except Exception as e:  # noqa: BLE001 - bad config, missing key, timeout, unsafe bundle...
        error = f"{type(e).__name__}: {e}" or type(e).__name__
        if isinstance(e, asyncio.TimeoutError):
            error = "timeout"

    if error is not None:
        now = datetime.now(timezone.utc)
        release = release or Release(id=rel_id, product_id=PRODUCT_ID, version=ver, source="ci", git_sha=sha,
                                     branch=branch, pr_number=pr, ci_run_url=run_url, created_at=now)
        asm = asm or Assessment(id=f"asm-{ver}-error", release_id=release.id, status="failed", pack_version="",
                                model="", run_id="run-error", started_at=now, finished_at=now)
        comment = render_engine_error_comment(ver, sha, error)
        result = CiResult(
            status="engine_error", exit_code=EXIT_ENGINE_ERROR, release=release, assessment=asm, findings=[],
            readiness=Readiness(release_id=release.id, assessment_id=asm.id, version=ver, gate="NOT_READY",
                                gate_label="Engine error", labels=[AI_LABEL, "counsel-reviewed 0/0"],
                                counts=GateCounts(), counsel_reviewed=CounselReviewed(reviewed=0, total=0),
                                coverage=[]),
            comment_md=comment, error=error)
        fix_plan = f"# Fix plan: {ver}\n\nCCOmmit could not run ({error}); no plan was produced.\n"

    (out / "result.json").write_text(result.model_dump_json(indent=2) + "\n", "utf-8")
    (out / "comment.md").write_text(result.comment_md or "", "utf-8")
    (out / "fix-plan.md").write_text(fix_plan, "utf-8")
    return AuditOutcome(result.exit_code, result, out)


def _build_result(s, release: Release, asm: Assessment, baseline: Baseline | None, sha: str | None) -> CiResult:
    reqs = deps.load_requirements(s)
    views = deps.assessment_views(s, asm)
    if baseline is not None and baseline.version:
        views = [
            v.model_copy(update={"carried_from_version": baseline.version})
            if v.applicable_review is not None and v.applicable_review.finding_id.startswith("baseline:")
            else v
            for v in views
        ]
    readiness = deps.release_readiness(s, release.id)
    readiness = readiness.model_copy(update={
        "previous_release_id": None, "changes_since_previous": changes_vs_baseline(views, baseline)})
    comment = render_comment(readiness, views, reqs, sha=sha,
                             baseline_version=baseline.version if baseline else None)
    events = [AgentEvent.model_validate(r.data) for r in s.scalars(
        select(AgentEventRow).where(AgentEventRow.run_id == asm.run_id).order_by(AgentEventRow.seq))]
    reviews = [Review.model_validate(r.data) for r in s.scalars(select(ReviewRow))]
    return CiResult(
        exit_code=exit_code_for_gate(readiness.gate), release=deps.get_release(s, release.id), assessment=asm,
        findings=views, reviews=reviews, readiness=readiness, events=events, comment_md=comment)


# ------------------------------------------------------------------ import


def import_result_bytes(session, data: bytes):
    """Load a CiResult (json or artifact zip) into the DB as a release with source=ci (same as POST /releases/import)."""
    from fastapi import HTTPException

    from cco.api.releases_write import _parse_result

    try:
        res = _parse_result(data)
    except HTTPException as e:
        raise ValueError(str(e.detail)) from e
    if res.status != "ok":
        raise ValueError("result has status engine_error; nothing to import")
    rel, asm = res.release, res.assessment
    if session.get(ReleaseRow, rel.id) is not None:
        raise ValueError(f"release {rel.version} already exists")
    if session.get(AssessmentRow, asm.id) is not None:
        raise ValueError(f"assessment {asm.id} already exists")
    pipeline.ensure_base(session)
    j = lambda m: m.model_dump(mode="json")  # noqa: E731
    session.add(ReleaseRow(id=rel.id, product_id=rel.product_id, version=rel.version,
                           created_at=rel.created_at.isoformat() if rel.created_at else "", data=j(rel)))
    session.add(AssessmentRow(id=asm.id, release_id=rel.id, run_id=asm.run_id,
                              started_at=asm.started_at.isoformat() if asm.started_at else "", data=j(asm)))
    session.flush()
    for i, v in enumerate(res.findings):
        f = Finding.model_validate(v.model_dump(include=set(Finding.model_fields)))
        session.add(FindingRow(id=f.id, assessment_id=f.assessment_id, requirement_id=f.requirement_id,
                               ord=i, data=j(f)))
    session.flush()
    for r in res.reviews:
        if session.get(ReviewRow, r.id) is None:
            session.add(ReviewRow(id=r.id, finding_id=r.finding_id, requirement_id=r.requirement_id,
                                  product_id=r.product_id, created_at=r.created_at.isoformat(), data=j(r)))
    for ev in res.events:
        session.add(AgentEventRow(run_id=ev.run_id, seq=ev.seq, data=j(ev)))
    session.flush()
    return rel


# ------------------------------------------------------------------ typer commands


def audit(
    bundle: Path = typer.Option(..., help="Bundle directory or zip (git archive of the product)"),
    version: str = typer.Option(..., help="Product version, e.g. 1.0.0"),
    sha: str = typer.Option(..., help="Commit sha"),
    baseline: Path = typer.Option(None, help=f"Baseline file ({BASELINE_PATH}); optional"),
    pr: int = typer.Option(None, help="PR number (PR runs are named <version>-rc.<run-number>)"),
    run_number: int = typer.Option(None, help="CI run number"),
    run_url: str = typer.Option(None, help="CI run URL"),
    branch: str = typer.Option(None, help="Branch name"),
    out: Path = typer.Option(Path("out"), help="Output directory"),
    timeout: float = typer.Option(1800, help="Run timeout in seconds"),
) -> None:
    """Run an assessment headless; exit 1 NOT_READY, 0 READY/REVIEW_REQUIRED, 2 engine error."""
    outcome = run_audit(bundle, version, sha, out, baseline=load_baseline(baseline), pr=pr,
                        run_number=run_number, run_url=run_url, branch=branch, timeout=timeout)
    r = outcome.result
    typer.echo(f"{r.release.version}: {r.readiness.gate if r.status == 'ok' else 'ENGINE ERROR'} "
               f"(exit {outcome.exit_code}); wrote {out}/result.json, comment.md, fix-plan.md")
    raise typer.Exit(outcome.exit_code)


def import_cmd(path: Path = typer.Argument(..., help="result.json or the ccommit-result artifact zip")) -> None:
    """Load a CI result into the configured database as a release with source=ci."""
    try:
        with session_scope() as s:
            rel = import_result_bytes(s, path.read_bytes())
    except (ValueError, OSError) as e:
        typer.echo(f"import failed: {e}", err=True)
        raise typer.Exit(EXIT_NOT_READY) from e
    typer.echo(f"imported release {rel.version} (source={rel.source})")


def export_baseline(
    version: str = typer.Argument(..., help="Release version to export"),
    out: Path = typer.Option(None, help=f"Write here (e.g. {BASELINE_PATH}); default stdout"),
) -> None:
    """Write the baseline (effective conclusions + counsel reviews) of a release from the configured database."""
    try:
        with session_scope() as s:
            b = build_baseline(s, version)
    except LookupError as e:
        typer.echo(str(e), err=True)
        raise typer.Exit(EXIT_NOT_READY) from e
    text = b.model_dump_json(indent=2) + "\n"
    if out is None:
        sys.stdout.write(text)
    else:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, "utf-8")
        typer.echo(f"wrote {out}")


__all__ = ["audit", "import_cmd", "export_baseline", "run_audit", "render_comment"]
