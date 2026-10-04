"""Live golden eval: v0.9.0 (+ injection fixture), rc and v1.0.0 vs demo/wealthpilot/expected.yaml (all requirements)."""

from __future__ import annotations

import json
import shutil
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import typer
import yaml

from ..contracts.ci import Baseline, BaselineReview

REPO_ROOT = Path(__file__).resolve().parents[3]
DEMO = REPO_ROOT / "demo" / "wealthpilot"
# (expected.yaml key, bundle dir, injection?)
RELEASES = [("0.9.0", "v0.9.0", True), ("rc", "rc", False), ("1.0.0", "v1.0.0", False)]
W8 = "AI-TRANSPARENCY-01"

eval_app = typer.Typer(help="Golden evaluation", no_args_is_help=True, add_completion=False)


@eval_app.callback()
def _root() -> None:
    """Golden evaluation."""


def compare(result, expected: dict, key: str) -> list[str]:
    """Mismatches between a CiResult and expected.yaml for all requirements and the gate."""
    exp = expected["releases"][key]
    diffs = []
    if result.readiness.gate != exp["gate"]:
        diffs.append(f"gate {result.readiness.gate} != {exp['gate']}")
    got = {f.requirement_id: f for f in result.findings}
    for r in expected["requirements"]:
        f = got.get(r["id"])
        if f is None:
            diffs.append(f"{r['alias']}: missing finding")
            continue
        if f.conclusion != r["conclusion"][key]:
            diffs.append(f"{r['alias']}: ai {f.conclusion} != {r['conclusion'][key]}")
        if f.effective_conclusion != r["effective_conclusion"][key]:
            diffs.append(f"{r['alias']}: effective {f.effective_conclusion} != {r['effective_conclusion'][key]}")
    return diffs


def _bundle_with_injection(src: Path, dest: Path) -> Path:
    shutil.copytree(src, dest)
    shutil.copytree(DEMO / "injection", dest, dirs_exist_ok=True)
    return dest


def run_once(workdir: Path, expected: dict, *, injection: bool = True, model=None) -> list[dict]:
    from ..cli.ci import baseline_from_views, run_audit  # lazy: cco.cli imports this module

    rows: list[dict] = []
    baseline: Baseline | None = None
    for key, folder, inj in RELEASES:
        version = expected["releases"][key]["version"]
        src = DEMO / folder / "upload"
        if inj and injection:
            src = _bundle_with_injection(src, workdir / f"{folder}-injected")
        t0 = time.monotonic()
        outcome = run_audit(src, version, "evalsha", workdir / f"out-{folder}", baseline=baseline, model=model)
        res = outcome.result
        diffs = ["engine error: " + (res.error or "")] if res.status != "ok" else compare(res, expected, key)
        rows.append({"release": key, "version": version, "pass": not diffs, "diffs": diffs,
                     "seconds": round(time.monotonic() - t0, 1)})
        if res.status != "ok":
            break
        if key == "0.9.0":  # counsel decides W8 on v0.9.0; the decision travels in the baseline
            w8 = next(f for f in res.findings if f.requirement_id == W8)
            base = baseline_from_views(version, res.findings)
            base.reviews = [BaselineReview(
                requirement_id=W8, decision="not_applicable", reviewer_name="Claire Dubois (counsel)",
                comment="Seeded W8 review (eval)", evidence_fingerprint=w8.evidence_fingerprint,
                created_at=datetime.now(timezone.utc))]
            baseline = base
        elif baseline is not None:
            baseline = baseline.model_copy(update={
                "version": version, "conclusions": {f.requirement_id: f.effective_conclusion for f in res.findings}})
    return rows


@eval_app.command("wealthpilot")
def wealthpilot(
    runs: int = typer.Option(5, help="Number of full runs (each: v0.9.0, rc, v1.0.0)"),
    workdir: Path = typer.Option(None, help="Scratch directory (default: a temp dir)"),
    json_out: Path = typer.Option(None, "--json", help="Write the structured summary here"),
    injection: bool = typer.Option(True, help="Add the injection fixture to the v0.9.0 bundle"),
) -> None:
    """Live evals against expected.yaml. Exit 0 when every release passes in >= 80% of runs (AC4)."""
    expected = yaml.safe_load((DEMO / "expected.yaml").read_text("utf-8"))
    root = workdir or Path(tempfile.mkdtemp(prefix="cco-eval-"))
    t0 = time.monotonic()
    all_rows: list[list[dict]] = []
    for i in range(runs):
        d = root / f"run-{i + 1}"
        d.mkdir(parents=True, exist_ok=True)
        rows = run_once(d, expected, injection=injection)
        all_rows.append(rows)
        typer.echo(f"run {i + 1}/{runs}: " + ", ".join(f"{r['release']}={'ok' if r['pass'] else 'FAIL'}" for r in rows))
        for r in rows:
            for line in r["diffs"]:
                typer.echo(f"    {r['release']}: {line}")
    total = round(time.monotonic() - t0, 1)
    summary: dict = {"runs": runs, "injection": injection, "total_seconds": total, "releases": {}}
    ok = True
    for key, _, _ in RELEASES:
        passed = sum(1 for rows in all_rows for r in rows if r["release"] == key and r["pass"])
        rate = passed / runs if runs else 0.0
        summary["releases"][key] = {"passed": passed, "runs": runs, "pass_rate": rate}
        ok &= rate >= 0.8
        typer.echo(f"{key}: {passed}/{runs} pass ({rate:.0%})")
    all_pass = sum(1 for rows in all_rows if len(rows) == len(RELEASES) and all(r["pass"] for r in rows))
    summary["runs_fully_passing"] = all_pass
    typer.echo(f"fully passing runs: {all_pass}/{runs}; total time {total}s")
    if json_out:
        json_out.write_text(json.dumps({**summary, "detail": all_rows}, indent=2), "utf-8")
    raise typer.Exit(0 if ok else 1)
