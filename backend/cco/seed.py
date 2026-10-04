"""Idempotent seed from contracts/fixtures (releases, findings, events, W8 review). `python -m cco.seed`."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from sqlalchemy.orm import Session

from . import config
from .contracts import (
    AgentEvent,
    Finding,
    Organization,
    Product,
    RegulatoryProfile,
    ReleaseFixture,
    RequirementsFixture,
)
from .db import session_scope
from .models import (
    AgentEventRow,
    ArtifactRow,
    AssessmentRow,
    FindingRow,
    OrganizationRow,
    ProductRow,
    ReleaseRow,
    RequirementRow,
    ReviewRow,
)

log = logging.getLogger("cco.seed")

RELEASE_FILES = ["release-0.9.0.json", "release-1.0.0-rc.json", "release-1.0.0.json"]  # 0.9.0 first (W8 review)
ORG = Organization(id="wealthpilot-sas", name="Wealthpilot SAS")
PRODUCT = Product(
    id="wealthpilot",
    organization_id=ORG.id,
    name="Wealthpilot",
    description="AI-generated, personalised portfolio recommendations for French retail investors. No trade execution.",
)
PROFILE = RegulatoryProfile(
    jurisdictions=["EU", "FR"],
    industry="fintech",
    activities=["investment_advice", "portfolio_recommendations"],
    customer_types=["retail"],
    data_categories=["identity", "financial_situation", "holdings", "risk_profile"],
    ai_uses=["generative_recommendations"],
    stage="pre-launch",
)


def _j(model) -> dict:
    return model.model_dump(mode="json")


def seed(s: Session, fixtures_dir: Path | None = None) -> dict[str, int]:
    fx = fixtures_dir or config.FIXTURES_DIR
    n = {"releases": 0, "findings": 0, "reviews": 0, "events": 0, "requirements": 0}

    s.merge(OrganizationRow(id=ORG.id, data=_j(ORG)))
    existing = s.get(ProductRow, PRODUCT.id)  # never overwrite a profile confirmed in the UI
    s.merge(ProductRow(id=PRODUCT.id, organization_id=ORG.id, data=_j(PRODUCT),
                       profile=existing.profile if existing else _j(PROFILE)))

    pack = RequirementsFixture.model_validate_json((fx / "requirements.json").read_text())
    for i, r in enumerate(pack.requirements):
        s.merge(RequirementRow(id=r.id, pack_version=pack.pack_version, ord=i, data=_j(r)))
        n["requirements"] += 1

    for fname in RELEASE_FILES:
        f = ReleaseFixture.model_validate_json((fx / fname).read_text())
        rel = f.release
        if rel.source == "ci":  # fixture CI links are illustrative, not real runs: never show them as provenance
            rel = rel.model_copy(update={"source": "seed", "ci_run_url": None, "pr_number": None})
        s.merge(ReleaseRow(id=rel.id, product_id=rel.product_id, version=rel.version,
                           created_at=rel.created_at.isoformat() if rel.created_at else "", data=_j(rel)))
        for a in f.artifacts:
            s.merge(ArtifactRow(id=a.id, release_id=rel.id, data=_j(a)))
        asm = f.assessment
        s.merge(AssessmentRow(id=asm.id, release_id=rel.id, run_id=asm.run_id,
                              started_at=asm.started_at.isoformat() if asm.started_at else "", data=_j(asm)))
        s.flush()
        for i, v in enumerate(f.findings):
            finding = Finding.model_validate(v.model_dump(include=set(Finding.model_fields)))  # AI values only
            s.merge(FindingRow(id=finding.id, assessment_id=finding.assessment_id,
                               requirement_id=finding.requirement_id, ord=i, data=_j(finding)))
            n["findings"] += 1
        s.flush()
        for r in f.reviews:
            s.merge(ReviewRow(id=r.id, finding_id=r.finding_id, requirement_id=r.requirement_id,
                              product_id=r.product_id, created_at=r.created_at.isoformat(), data=_j(r)))
            n["reviews"] += 1
        n["releases"] += 1

    for raw in json.loads((fx / "events-0.9.0.json").read_text()):
        ev = AgentEvent.model_validate(raw)
        row = s.query(AgentEventRow).filter_by(run_id=ev.run_id, seq=ev.seq).one_or_none()
        if row is None:
            s.add(AgentEventRow(run_id=ev.run_id, seq=ev.seq, data=_j(ev)))
        else:
            row.data = _j(ev)
        n["events"] += 1
    s.flush()
    return n


def main(argv: list[str] | None = None) -> None:
    import argparse

    ap = argparse.ArgumentParser(prog="python -m cco.seed")
    ap.add_argument("--snapshot", type=Path, default=None,
                    help="restore validated live runs from this snapshot dir (demo/snapshot) instead of fixtures")
    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO)
    with session_scope() as s:
        if a.snapshot is not None:
            from .demo import restore

            counts = restore(s, a.snapshot.resolve())
        else:
            counts = seed(s)
    print("seeded:", counts)


if __name__ == "__main__":
    main()
