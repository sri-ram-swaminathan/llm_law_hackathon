"""`cco spike`: live evaluator check on a few requirements of a git ref (SPEC §6.4, B4)."""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import tarfile
import tempfile
from io import BytesIO
from pathlib import Path

import typer
import yaml
from dotenv import find_dotenv, load_dotenv

from cco.agent.bundle_tools import ArtifactDoc, EvidenceBundle
from cco.agent.evaluator import evaluate_requirement, make_model
from cco.contracts.activity import AgentEvent
from cco.contracts.domain import ArtifactKind, CodeRef, DocumentSpanRef, MissingRef, Requirement

REPO_ROOT = Path(__file__).resolve().parents[3]
KIND_BY_STEM: list[tuple[str, ArtifactKind]] = [
    ("business-plan", "business_plan"),
    ("privacy", "privacy_policy"),
    ("terms", "terms"),
    ("cif-registration", "regulatory_registration"),
    ("orias", "regulatory_registration"),
]


def _export_ref(repo: Path, ref: str, dest: Path) -> None:
    data = subprocess.run(["git", "-C", str(repo), "archive", ref], check=True, capture_output=True).stdout
    with tarfile.open(fileobj=BytesIO(data)) as tf:
        tf.extractall(dest, filter="data")


def load_bundle(root: Path, ref: str) -> EvidenceBundle:
    """compliance/*.md by file name, docs/*.md as product_spec; everything else is code."""
    arts: list[ArtifactDoc] = []
    for p in sorted((root / "compliance").glob("*.md")):
        kind: ArtifactKind = next((k for stem, k in KIND_BY_STEM if stem in p.stem.lower()), "other")
        arts.append(ArtifactDoc(f"art-{ref}-{p.stem}", kind, f"compliance/{p.name}", p.read_text("utf-8")))
    for p in sorted((root / "docs").glob("*.md")):
        arts.append(ArtifactDoc(f"art-{ref}-{p.stem}", "product_spec", f"docs/{p.name}", p.read_text("utf-8")))
    return EvidenceBundle(root=root, artifacts=arts, code_artifact_id=f"art-{ref}-code")


def _fmt_ev(ev) -> str:
    if isinstance(ev, MissingRef):
        return f"missing:{ev.artifact_kind}"
    if isinstance(ev, CodeRef):
        return f"code {ev.path}:{ev.start_line}-{ev.end_line} {ev.quote[:70]!r}"
    if isinstance(ev, DocumentSpanRef):
        return f"doc {ev.artifact_id}[{ev.start}:{ev.end}] {ev.quote[:70]!r}"
    return str(ev)


def spike(
    repo: Path = typer.Option(..., help="Path to the product git checkout (read-only; not modified)"),
    ref: str = typer.Option("v0.9.0", help="Git ref to evaluate"),
    req: str = typer.Option("W1,W2,W3", help="Comma-separated requirement ids or W-aliases"),
    release: str = typer.Option("0.9.0", help="Release key in expected.yaml"),
    trace: bool = typer.Option(False, help="Print agent events"),
    model: str = typer.Option(None, help="Override CCO_MODEL_EVAL"),
) -> None:
    os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")
    load_dotenv(find_dotenv(usecwd=True) or None)
    fx = json.loads((REPO_ROOT / "contracts/fixtures/requirements.json").read_text("utf-8"))
    reqs = [Requirement.model_validate(r) for r in fx["requirements"]]
    wanted = [w.strip() for w in req.split(",") if w.strip()]
    selected = [r for w in wanted for r in reqs if w in (r.alias, r.id)]
    expected = {
        e["id"]: e["conclusion"][release]
        for e in yaml.safe_load((REPO_ROOT / "demo/wealthpilot/expected.yaml").read_text("utf-8"))["requirements"]
    }

    def on_event(e: AgentEvent) -> None:
        if trace:
            typer.echo(f"  [{e.seq:02d} {e.type}] {e.summary}" + (f"  ERR {e.error[:300]}" if e.error else ""))

    async def run() -> list[tuple[Requirement, str, str]]:
        out = []
        with tempfile.TemporaryDirectory() as tmp:
            _export_ref(repo, ref, Path(tmp))
            bundle = load_bundle(Path(tmp), ref)
            m = make_model(model)
            for r in selected:
                res = await evaluate_requirement(r, bundle, model=m, on_event=on_event, run_id="spike")
                c = res.candidate
                typer.echo(
                    f"{r.alias or r.id} {r.id} -> {c.conclusion} (attempts={res.attempts}, tools={res.tool_calls}, "
                    f"tokens={res.tokens}) | {c.title}"
                )
                typer.echo(f"   {c.reasoning_summary}")
                for ev in c.evidence:
                    typer.echo(f"   - {_fmt_ev(ev)}")
                for n in res.validation_notes:
                    typer.echo(f"   ! {n}")
                out.append((r, c.conclusion, expected.get(r.id, "?")))
        return out

    rows = asyncio.run(run())
    ok = sum(1 for _, got, exp in rows if got == exp)
    typer.echo("")
    for r, got, exp in rows:
        typer.echo(f"{r.alias or r.id}: got={got} expected={exp} {'MATCH' if got == exp else 'MISMATCH'}")
    typer.echo(f"match {ok}/{len(rows)}")
