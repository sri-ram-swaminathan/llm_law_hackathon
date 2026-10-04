"""Assessment pipeline (SPEC §6.4 steps 1-8): scope, evidence bundle, evaluate, persist, gate."""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from .. import legal
from ..agent import ArtifactDoc, EvidenceBundle, evaluate_requirement, load_provisions
from ..agent.evaluator import DEFAULT_MODEL, make_model
from ..api import deps
from ..contracts import (
    Artifact,
    Assessment,
    CodeRef,
    Confidence,
    DocumentSpanRef,
    Finding,
    MissingRef,
    RegulatoryProfile,
    Release,
    Requirement,
)
from ..contracts.bundle import bundle_root
from ..contracts.fingerprint import evidence_fingerprint
from ..db import init_db, make_engine, make_sessionmaker
from ..models import (
    AssessmentRow,
    FindingRow,
    OrganizationRow,
    ProductRow,
    ReleaseRow,
    RequirementRow,
)
from ..pack import ScopeResult, load_pack, scope
from .events import EventSink

log = logging.getLogger("cco.pipeline")

RUN_CONCURRENCY = 4
MODEL_CONCURRENCY = int(os.environ.get("CCO_MODEL_CONCURRENCY", "4"))

# Tests (and the CLI) can inject a model here; None means "build the Mistral model from the env".
MODEL_OVERRIDE: Any = None


class RunInFlight(Exception):
    def __init__(self, product_id: str, run_id: str) -> None:
        super().__init__(f"an assessment run is already in flight for product {product_id!r} (run {run_id})")
        self.product_id, self.run_id = product_id, run_id


_locks: dict[str, str] = {}  # product_id -> run_id (single uvicorn worker, D3)
_model_sems: dict[int, asyncio.Semaphore] = {}


def _model_sem() -> asyncio.Semaphore:
    """The global model queue (one per event loop)."""
    loop = asyncio.get_running_loop()
    sem = _model_sems.get(id(loop))
    if sem is None:
        _model_sems.clear()
        sem = _model_sems[id(loop)] = asyncio.Semaphore(MODEL_CONCURRENCY)
    return sem


def lock_holder(product_id: str) -> str | None:
    return _locks.get(product_id)


@dataclass
class PreparedRun:
    assessment_id: str
    run_id: str
    release_id: str
    product_id: str


def _j(m) -> dict:
    return m.model_dump(mode="json")


def ensure_base(s: Session) -> None:
    """Make sure the product and the pack's requirements exist (fresh DBs, CLI). Never overwrites."""
    from ..seed import ORG, PRODUCT, PROFILE

    if s.get(OrganizationRow, ORG.id) is None:
        s.add(OrganizationRow(id=ORG.id, data=_j(ORG)))
    if s.get(ProductRow, PRODUCT.id) is None:
        s.add(ProductRow(id=PRODUCT.id, organization_id=ORG.id, data=_j(PRODUCT), profile=_j(PROFILE)))
    pack = load_pack()
    for i, r in enumerate(pack.requirements):
        if s.get(RequirementRow, r.id) is None:
            s.add(RequirementRow(id=r.id, pack_version=pack.pack_version, ord=i, data=_j(r)))
    s.flush()


def _model_name(model: Any) -> str:
    if model is None:
        return os.environ.get("CCO_MODEL_EVAL") or DEFAULT_MODEL
    if isinstance(model, str):
        return model
    return getattr(model, "model_name", str(model))


def prepare_run(sm: sessionmaker[Session], release_id: str, model: Any = None) -> PreparedRun:
    """Step 1 (lock part): validate the release, take the per-product lock, create the queued assessment."""
    with sm() as s:
        ensure_base(s)
        row = s.get(ReleaseRow, release_id)
        if row is None:
            raise LookupError(f"release {release_id!r} not found")
        release = Release.model_validate(row.data)
        holder = _locks.get(release.product_id)
        if holder is not None:
            raise RunInFlight(release.product_id, holder)
        run_id = f"run-{uuid.uuid4().hex[:12]}"
        asm_id = f"asm-{release.version}-{uuid.uuid4().hex[:6]}"
        _locks[release.product_id] = run_id
        try:
            now = datetime.now(timezone.utc)
            asm = Assessment(id=asm_id, release_id=release_id, status="queued", pack_version=load_pack().pack_version,
                             model=_model_name(model if model is not None else MODEL_OVERRIDE), run_id=run_id,
                             started_at=now)
            s.add(AssessmentRow(id=asm_id, release_id=release_id, run_id=run_id, started_at=now.isoformat(), data=_j(asm)))
            s.commit()
        except Exception:
            _locks.pop(release.product_id, None)
            raise
    return PreparedRun(asm_id, run_id, release_id, release.product_id)


# ------------------------------------------------------------------ helpers


def _set_assessment(sm: sessionmaker[Session], asm_id: str, **changes: Any) -> Assessment:
    with sm() as s:
        row = s.get(AssessmentRow, asm_id)
        asm = Assessment.model_validate(row.data).model_copy(update=changes)
        row.data = _j(asm)
        s.commit()
        return asm


def dedupe_evidence(evidence: list) -> list:
    seen: set[tuple] = set()
    out = []
    for e in evidence:
        if isinstance(e, MissingRef):
            key: tuple = ("missing", e.artifact_kind)
        elif isinstance(e, CodeRef):
            key = ("code", e.path, e.quote)
        else:
            key = ("doc", e.artifact_id, e.quote)
        if key not in seen:
            seen.add(key)
            out.append(e)
    return out


def _uncertain_finding(req: Requirement, notes: list[str]) -> dict:
    return dict(
        conclusion="uncertain",
        title="Automated evaluation could not be completed reliably",
        reasoning_summary=("The evaluator did not produce a validated finding. Review this requirement manually. "
                           + " ".join(notes))[:1200],
        evidence=[], citations=[], confidence=Confidence(applicability=0.0, evidence=0.0, finding=0.0),
    )


def check_integrity(cand_fields: dict, req: Requirement, arts: dict[str, Artifact]) -> list[str]:
    """Final guard so a persisted finding never carries a dangling reference (AC3/AC5)."""
    errs: list[str] = []
    for e in cand_fields["evidence"]:
        if isinstance(e, DocumentSpanRef):
            a = arts.get(e.artifact_id)
            if a is None or e.quote not in a.text:
                errs.append(f"evidence artifact/quote unresolved: {e.artifact_id}")
        elif isinstance(e, CodeRef):
            a = arts.get(e.artifact_id)
            f = next((f for f in a.files if f.path == e.path), None) if a else None
            if f is None or e.quote not in f.content:
                errs.append(f"code evidence unresolved: {e.path}")
    errs += [f"citation {c} not in derived_from" for c in cand_fields["citations"] if c not in req.derived_from]
    errs += [f"citation {c} has no cached provision" for c in cand_fields["citations"] if legal.get_provision(c) is None
             and c not in _fixture_provisions()]
    if cand_fields["conclusion"] in ("potential_violation", "satisfied"):
        if not [e for e in cand_fields["evidence"] if not isinstance(e, MissingRef)]:
            errs.append("no resolvable evidence for a decisive conclusion")
    return errs


_fixture_cache: dict | None = None


def _fixture_provisions() -> dict:
    global _fixture_cache
    if _fixture_cache is None:
        try:
            _fixture_cache = load_provisions()
        except OSError:
            _fixture_cache = {}
    return _fixture_cache


def _provisions_for(req: Requirement) -> dict:
    out = {}
    for pid in req.derived_from:
        p = legal.get_provision(pid) or _fixture_provisions().get(pid)
        if p is not None:
            out[pid] = p
    return out


def _make_finding(asm_id: str, req: Requirement, f: dict, paths: dict[str, str], ord_: int, *,
                  attempts: int = 1, notes: list[str] | None = None) -> Finding:
    ev = dedupe_evidence(list(f["evidence"]))
    return Finding(
        id=f"fnd-{asm_id}-{(req.alias or req.id).lower()}", assessment_id=asm_id, requirement_id=req.id,
        conclusion=f["conclusion"], severity=req.severity,  # never from the model
        title=f["title"], reasoning_summary=f["reasoning_summary"], evidence=ev, citations=list(f["citations"]),
        confidence=f["confidence"], attempts=attempts, validation_notes=notes or [],
        evidence_fingerprint=evidence_fingerprint(ev, paths),
    )


def _persist(sm: sessionmaker[Session], finding: Finding, ord_: int) -> None:
    with sm() as s:
        s.add(FindingRow(id=finding.id, assessment_id=finding.assessment_id, requirement_id=finding.requirement_id,
                         ord=ord_, data=_j(finding)))
        s.commit()


# ------------------------------------------------------------------ the run


async def execute_run(sm: sessionmaker[Session], prep: PreparedRun, model: Any = None) -> str:
    """Steps 1-8 for a prepared run. Always releases the lock; never raises (failure => status failed)."""
    sink = EventSink(sm, prep.run_id)
    asm_id = prep.assessment_id
    try:
        _set_assessment(sm, asm_id, status="running")
        sink.emit("step", f"Run started for release {prep.release_id}")
        with sm() as s:
            release = deps.get_release(s, prep.release_id)
            _, profile = deps.get_product(s)
            artifacts = deps.release_artifacts(s, prep.release_id)
        paths = {a.id: a.path for a in artifacts}
        arts = {a.id: a for a in artifacts}
        sink.emit("step", f"Loaded profile and {len(artifacts)} artifacts")

        results = scope(profile, load_pack())
        sink.emit("scope", f"{sum(r.applicable for r in results)} of {len(results)} requirements apply")
        model = model if model is not None else MODEL_OVERRIDE
        if model is None and any(r.applicable for r in results):
            model = make_model()
        elif isinstance(model, str):
            model = make_model(model)
        if model is not None:
            _set_assessment(sm, asm_id, model=_model_name(model))

        code_art = next((a for a in artifacts if a.kind == "code_repo"), None)
        docs = [ArtifactDoc(a.id, a.kind, a.path, a.text) for a in artifacts if a.kind != "code_repo" and a.text.strip()]
        root = bundle_root(prep.release_id)
        run_sem = asyncio.Semaphore(RUN_CONCURRENCY)

        async def one(i: int, sr: ScopeResult) -> Finding:
            req = sr.requirement
            if not sr.applicable:
                sink.emit("scope", f"{req.id}: not applicable. {sr.reason}", requirement_id=req.id)
                fd = dict(conclusion="not_applicable", title=f"{req.title}: not applicable",
                          reasoning_summary=sr.reason[:1200], evidence=[], citations=[],
                          confidence=Confidence(applicability=sr.applicability_confidence, evidence=1.0, finding=1.0))
                finding = _make_finding(asm_id, req, fd, paths, i)
            else:
                async with run_sem:
                    finding = await _evaluate(sm, sink, req, sr, docs, code_art, root, model, arts, paths, asm_id, i)
            _persist(sm, finding, i)
            if not sr.applicable:
                sink.emit("finding", f"{req.id}: not_applicable", requirement_id=req.id)
            return finding

        findings = await asyncio.gather(*(one(i, sr) for i, sr in enumerate(results)))

        asm = _set_assessment(sm, asm_id, status="completed", finished_at=datetime.now(timezone.utc))
        with sm() as s:
            readiness = deps.release_readiness(s, prep.release_id)
        sink.emit("gate", f"Gate {readiness.gate}: {readiness.gate_label}",
                  output_preview=readiness.model_dump_json())
        sink.emit("run_end", f"Run completed: {len(findings)} findings, gate {readiness.gate}")
        return asm.id
    except Exception as e:  # noqa: BLE001
        log.exception("assessment %s failed", asm_id)
        try:
            _set_assessment(sm, asm_id, status="failed", finished_at=datetime.now(timezone.utc))
            sink.emit("run_end", "Run failed", error=f"{type(e).__name__}: {e}"[:1000])
        except Exception:  # noqa: BLE001
            log.exception("could not record failure of %s", asm_id)
        return asm_id
    finally:
        if _locks.get(prep.product_id) == prep.run_id:
            _locks.pop(prep.product_id, None)


async def _evaluate(sm, sink: EventSink, req: Requirement, sr: ScopeResult, docs, code_art, root: Path, model,
                    arts: dict[str, Artifact], paths: dict[str, str], asm_id: str, ord_: int) -> Finding:
    sink.emit("step", f"Evidence bundle for {req.id}: hints {req.evidence_hints.artifact_kinds}",
              requirement_id=req.id)
    provs = _provisions_for(req)
    for pid in req.derived_from:  # step 3 events: legal basis resolved from the cache
        sink.emit("tool_call", f"get_provision({pid})", requirement_id=req.id, tool="get_provision")
        sink.emit("tool_result", f"{pid}: {'cached' if pid in provs else 'unavailable'}", requirement_id=req.id,
                  tool="get_provision")
    bundle = EvidenceBundle(root=root, artifacts=docs, code_artifact_id=code_art.id if code_art else "code",
                            provisions=provs)
    notes: list[str] = []
    attempts = 1
    try:
        async with _model_sem():
            res = await evaluate_requirement(req, bundle, model=model, on_event=sink, run_id=sink.run_id,
                                             run_kind="assessment", seq=sink.seq)
        c = res.candidate
        fd = dict(conclusion=c.conclusion, title=c.title, reasoning_summary=c.reasoning_summary,
                  evidence=list(c.evidence), citations=list(c.citations), confidence=c.confidence)
        notes, attempts = list(res.validation_notes), res.attempts
        errs = check_integrity(fd, req, arts)
        if errs:
            notes += errs
            fd = _uncertain_finding(req, errs)
    except Exception as e:  # noqa: BLE001 - e.g. 429 exhausted, network: degrade to uncertain, keep the run going
        log.warning("evaluation of %s failed: %s", req.id, e)
        notes = [f"evaluation error: {type(e).__name__}: {str(e)[:300]}"]
        fd = _uncertain_finding(req, notes)
        sink.emit("finding", f"{req.id}: uncertain", requirement_id=req.id, error=notes[0])
    return _make_finding(asm_id, req, fd, paths, ord_, attempts=attempts, notes=notes)


async def run_assessment(release_id: str, sm: sessionmaker[Session], *, model: Any = None) -> str:
    """Prepare (lock; RunInFlight if busy) and execute. Returns the assessment id."""
    prep = prepare_run(sm, release_id, model)
    return await execute_run(sm, prep, model)


def run_assessment_sync(session_url: str, release_id: str, *, model: Any = None) -> str:
    """CLI helper (T16): run to completion against a database URL. Returns the assessment id."""
    engine = make_engine(session_url)
    init_db(engine)
    return asyncio.run(run_assessment(release_id, make_sessionmaker(engine), model=model))
