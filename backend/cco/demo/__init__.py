"""Demo snapshot: restore validated live runs (demo/snapshot) and start a live 0.9.0 run.

The snapshot is produced by scripts/demo_snapshot.sh (`cco audit` on the three Wealthpilot bundles, accepted only
when it matches demo/wealthpilot/expected.yaml with evidence on every blocker/high finding). Restoring re-ingests
each release's bundle (artifacts + bundle files, so evidence resolves in the UI) and then persists the snapshot's
assessment, findings and activity events onto it. Provenance is the real FinTechProto ref/commit from MANIFEST.json;
nothing is presented as a CI run.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, sessionmaker

from .. import config, gate, pipeline
from ..contracts import Finding, Release, Review
from ..contracts.ci import BaselineReview, CiResult
from ..ingest import ingest_bundle
from ..models import (
    AgentEventRow,
    ArtifactRow,
    AssessmentRow,
    FindingRow,
    ProductRow,
    ReleaseRow,
    ReviewRow,
)
from ..seed import PRODUCT, PROFILE



def demo_dir() -> Path:
    """Root of the demo bundles + snapshot; CCO_DEMO_DIR lets Docker mount it (default <repo>/demo)."""
    return Path(os.environ.get("CCO_DEMO_DIR") or config.REPO_ROOT / "demo")


def default_snapshot_dir() -> Path:
    return demo_dir() / "snapshot"


SNAPSHOT_DIR = config.REPO_ROOT / "demo" / "snapshot"  # repo default (CLI); runtime code uses snapshot_dir()
REPO = "RomanGrebnev/FinTechProto"
W8 = "AI-TRANSPARENCY-01"
# ReleaseSource is seed|ui|ci: a restored snapshot is "seed" (never "ci": there is no real CI run behind it).
RESTORED_SOURCE = "seed"
W8_REVIEWER = "Claire Dubois (counsel)"
W8_COMMENT = ("Not applicable: Wealthpilot shows its recommendations as a report, not a chatbot or synthetic "
              "media. AI Act Art. 50 transparency duties do not apply to this product as profiled.")


def _j(m) -> dict:
    return m.model_dump(mode="json")


def load_manifest(snapshot_dir: Path | None = None) -> dict | None:
    p = (snapshot_dir or default_snapshot_dir()) / "MANIFEST.json"
    return json.loads(p.read_text("utf-8")) if p.is_file() else None


def w8_baseline_review() -> BaselineReview:
    """The counsel decision on W8 (profile-scoped, as POST /findings/{id}/review stores not_applicable)."""
    fp = gate.PROFILE_FP_PREFIX + gate.profile_hash(PROFILE)
    return BaselineReview(requirement_id=W8, decision="not_applicable", reviewer_name=W8_REVIEWER,
                          comment=W8_COMMENT, evidence_fingerprint=fp, created_at=datetime.now(timezone.utc))


def wipe(s: Session) -> None:
    """Remove every release and what hangs off it (bundle files on disk are kept: ingest overwrites them)."""
    for row in (ReviewRow, AgentEventRow, FindingRow, AssessmentRow, ArtifactRow, ReleaseRow):
        s.execute(delete(row))
    s.flush()


def _confirm_profile(s: Session) -> None:
    pipeline.ensure_base(s)
    row = s.get(ProductRow, PRODUCT.id)
    row.profile = _j(PROFILE.model_copy(update={"confirmed_at": datetime.now(timezone.utc)}))
    s.flush()


def ingest_release(s: Session, rel: dict, *, source: str) -> Release:
    """Ingest a manifest release's bundle with its real provenance (FinTechProto ref + commit)."""
    bundle = demo_dir() / Path(rel["bundle"]).relative_to("demo")  # manifest paths are repo-relative
    release, _ = ingest_bundle(s, bundle, rel["version"], source=source,
                               git_sha=rel["commit"], branch=rel["ref"])
    return release


def restore(s: Session, snapshot_dir: Path | None = None, exclude: list[str] | tuple[str, ...] = ()) -> dict[str, Any]:
    """Wipe releases and restore the snapshot (minus `exclude` keys, e.g. ["0.9.0"]). Caller commits."""
    snap = snapshot_dir or default_snapshot_dir()
    manifest = load_manifest(snap)
    if manifest is None:
        raise FileNotFoundError(f"no MANIFEST.json in {snap}")
    wipe(s)
    _confirm_profile(s)
    restored: list[str] = []
    w8_finding: Finding | None = None
    w8_release: Release | None = None
    for rel in manifest["releases"]:
        if rel["key"] in exclude:
            continue
        res = CiResult.model_validate_json((snap / rel["dir"] / "result.json").read_text("utf-8"))
        asm = res.assessment
        release = ingest_release(s, rel, source=RESTORED_SOURCE)
        if release.id != asm.release_id:
            raise ValueError(f"snapshot {rel['dir']}: release id {asm.release_id} != {release.id}")
        created = asm.started_at or release.created_at  # the real capture time, not "now"
        row = s.get(ReleaseRow, release.id)
        row.created_at = created.isoformat()
        row.data = _j(release.model_copy(update={"created_at": created}))
        s.add(AssessmentRow(id=asm.id, release_id=release.id, run_id=asm.run_id,
                            started_at=asm.started_at.isoformat() if asm.started_at else "", data=_j(asm)))
        s.flush()
        for i, v in enumerate(res.findings):
            f = Finding.model_validate(v.model_dump(include=set(Finding.model_fields)))  # AI values only
            s.add(FindingRow(id=f.id, assessment_id=f.assessment_id, requirement_id=f.requirement_id, ord=i,
                             data=_j(f)))
            if w8_finding is None and f.requirement_id == W8:  # earliest restored release (0.9.0, else rc)
                w8_finding, w8_release = f, release
        for ev in res.events:
            s.add(AgentEventRow(run_id=ev.run_id, seq=ev.seq, data=_j(ev)))
        s.flush()
        restored.append(release.version)
    if w8_finding is not None:  # counsel decides W8 on 0.9.0; it carries to later releases (profile unchanged)
        br = w8_baseline_review()
        created = datetime.fromisoformat(s.get(ReleaseRow, w8_release.id).created_at)
        rev = Review(id=f"rev-w8-{w8_release.version}", finding_id=w8_finding.id, requirement_id=W8, product_id=PRODUCT.id,
                     reviewer_name=br.reviewer_name, decision=br.decision, comment=br.comment,
                     evidence_fingerprint=br.evidence_fingerprint, created_at=created)
        s.add(ReviewRow(id=rev.id, finding_id=rev.finding_id, requirement_id=W8, product_id=rev.product_id,
                        created_at=rev.created_at.isoformat(), data=_j(rev)))
    s.flush()
    return {"releases": restored, "reviews": int(w8_finding is not None)}


def _make_first(s: Session, release_id: str) -> None:
    """The live v0.9.0 is ingested last but is the first release: no baseline, ordered before rc and 1.0.0,
    and the oldest remaining release now diffs against it (otherwise "What changed" compares 0.9.0 to 1.0.0)."""
    from datetime import datetime, timedelta

    from ..models import ReleaseRow

    rows = [r for r in s.scalars(select(ReleaseRow).where(ReleaseRow.product_id == PRODUCT.id)) if r.id != release_id]
    me = s.get(ReleaseRow, release_id)
    if me is None or not rows:
        return
    oldest = min(rows, key=lambda r: r.created_at)
    first_at = (datetime.fromisoformat(oldest.created_at) - timedelta(days=1)).isoformat()
    me.created_at = first_at
    me.data = {**me.data, "created_at": first_at, "previous_release_id": None}
    oldest.data = {**oldest.data, "previous_release_id": release_id}
    s.flush()


def start(sm: sessionmaker[Session], snapshot_dir: Path | None = None) -> dict[str, Any]:
    """Restore rc + 1.0.0, ingest v0.9.0 with real provenance and queue a live assessment.
    Raises pipeline.RunInFlight when a run is going. The caller schedules pipeline.execute_run(sm, prep)."""
    holder = pipeline.runner.lock_holder(PRODUCT.id)
    if holder is not None:
        raise pipeline.RunInFlight(PRODUCT.id, holder)
    manifest = load_manifest(snapshot_dir)
    if manifest is None:
        raise FileNotFoundError("no demo snapshot")
    rel = next(r for r in manifest["releases"] if r["key"] == "0.9.0")
    with sm() as s:
        restore(s, snapshot_dir, exclude=["0.9.0"])
        release = ingest_release(s, rel, source="ui")  # started from the UI, on the real v0.9.0 commit
        _make_first(s, release.id)
        s.commit()
    prep = pipeline.prepare_run(sm, release.id)
    return {"release": release, "prep": prep,
            "provenance": {"repo": manifest.get("repo", REPO), "ref": rel["ref"], "commit": rel["commit"]}}


def reset(s: Session, snapshot_dir: Path | None = None) -> dict[str, Any]:
    """Snapshot when MANIFEST.json exists, else the contract fixtures."""
    if load_manifest(snapshot_dir) is not None:
        return restore(s, snapshot_dir)
    from ..seed import seed

    wipe(s)
    return seed(s)


__all__ = ["restore", "start", "reset", "wipe", "load_manifest", "w8_baseline_review", "demo_dir", "SNAPSHOT_DIR"]
