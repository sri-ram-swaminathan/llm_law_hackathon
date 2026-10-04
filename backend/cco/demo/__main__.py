"""`python -m cco.demo reset|accept|baseline|manifest` (the last three are steps of scripts/demo_snapshot.sh)."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

from .. import config
from ..contracts.ci import BASELINE_FORMAT_VERSION, Baseline, CiResult
from . import REPO, SNAPSHOT_DIR, W8, w8_baseline_review

EXPECTED = config.REPO_ROOT / "demo" / "wealthpilot" / "expected.yaml"
# key in expected.yaml, snapshot dir, bundle folder, FinTechProto ref
RELEASES = [("0.9.0", "0.9.0", "v0.9.0", "v0.9.0"), ("rc", "1.0.0-rc", "rc", "demo/rc"),
            ("1.0.0", "1.0.0", "v1.0.0", "demo/v1")]
DECISIVE = {"blocker", "high"}


def accept(result: CiResult, expected: dict, key: str) -> dict:
    """A run is accepted only if it matches expected.yaml (gate + every AI and effective conclusion) and every
    blocker/high finding cites at least one evidence ref and has no validation notes."""
    from ..eval.harness import compare

    if result.status != "ok":
        return {"pass": False, "score": "0/0", "diffs": [f"engine error: {result.error}"]}
    diffs = compare(result, expected, key)
    sev = {r["id"]: r["severity"] for r in expected["requirements"]}
    got = {f.requirement_id: f for f in result.findings}
    for r in expected["requirements"]:
        f = got.get(r["id"])
        if f is None or sev[r["id"]] not in DECISIVE or f.conclusion == "not_applicable":
            continue
        if not f.evidence:
            diffs.append(f"{r['alias']}: no evidence ref")
        if f.validation_notes:
            diffs.append(f"{r['alias']}: validation notes: {' | '.join(f.validation_notes)[:200]}")
    bad = {d.split(":")[0] for d in diffs if not d.startswith("gate")}
    ok = sum(1 for r in expected["requirements"] if r["alias"] not in bad)
    return {"pass": not diffs, "score": f"{ok}/{len(expected['requirements'])}", "gate": result.readiness.gate,
            "diffs": diffs}


def _load(p: Path) -> CiResult:
    return CiResult.model_validate_json(p.read_text("utf-8"))


def cmd_accept(a) -> int:
    expected = yaml.safe_load(EXPECTED.read_text("utf-8"))
    v = accept(_load(a.result), expected, a.key)
    v["attempt"] = a.attempt
    (a.result.parent / "accept.json").write_text(json.dumps(v, indent=2) + "\n", "utf-8")
    print(f"{a.key}: {'ACCEPTED' if v['pass'] else 'REJECTED'} score {v['score']} gate {v.get('gate')}")
    for d in v["diffs"]:
        print("   ", d)
    return 0 if v["pass"] else 1


def cmd_baseline(a) -> int:
    """Baseline for the next release: the previous result's effective conclusions + the W8 counsel review."""
    res = _load(a.result)
    b = Baseline(format_version=BASELINE_FORMAT_VERSION, version=res.release.version,
                 conclusions={f.requirement_id: f.effective_conclusion for f in res.findings},
                 reviews=[w8_baseline_review()])
    assert b.reviews[0].requirement_id == W8
    a.out.write_text(b.model_dump_json(indent=2) + "\n", "utf-8")
    return 0


def _commit(ref: str) -> str:
    repo = Path(os.environ.get("FINTECHPROTO", config.REPO_ROOT.parent / "FinTechProto"))
    return subprocess.run(["git", "-C", str(repo), "rev-parse", f"{ref}^{{commit}}"], capture_output=True,
                          text=True, check=True).stdout.strip()


def cmd_commit(a) -> int:
    print(_commit(a.ref))
    return 0


def cmd_manifest(a) -> int:
    rels = []
    model = ""
    for key, d, folder, ref in RELEASES:
        res = _load(a.snapshot / d / "result.json")
        acc = json.loads((a.work / d / "accept.json").read_text("utf-8"))
        model = model or res.assessment.model
        rels.append({"key": key, "dir": d, "version": res.release.version,
                     "bundle": f"demo/wealthpilot/{folder}/upload", "repo": REPO, "ref": ref, "commit": _commit(ref),
                     "gate": res.readiness.gate, "score": acc["score"], "attempts": acc["attempt"],
                     "run_id": res.assessment.run_id})
    m = {"product": "wealthpilot", "repo": REPO, "model": model, "pack_version": res.assessment.pack_version,
         "captured_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
         "acceptance": "matches demo/wealthpilot/expected.yaml (gate + all conclusions); every blocker/high "
                       "finding has >=1 evidence ref and no validation notes",
         "counsel_reviews": [{"requirement_id": W8, "release": "0.9.0", "decision": "not_applicable",
                              "carries_to": ["rc", "1.0.0"]}],
         "releases": rels}
    (a.snapshot / "MANIFEST.json").write_text(json.dumps(m, indent=2) + "\n", "utf-8")
    print(json.dumps({r["version"]: [r["gate"], r["score"], r["attempts"]] for r in rels}))
    return 0


def cmd_reset(a) -> int:
    from ..db import session_scope
    from . import reset

    with session_scope() as s:
        print("reset:", reset(s, a.snapshot))
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m cco.demo")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("reset", help="restore the snapshot (fixtures when there is none) into CCO_DATABASE_URL")
    p.add_argument("--snapshot", type=Path, default=None, help="default $CCO_DEMO_DIR/snapshot")
    p.set_defaults(fn=cmd_reset)
    p = sub.add_parser("accept")
    p.add_argument("result", type=Path)
    p.add_argument("key", choices=[k for k, *_ in RELEASES])
    p.add_argument("--attempt", type=int, default=1)
    p.set_defaults(fn=cmd_accept)
    p = sub.add_parser("baseline")
    p.add_argument("result", type=Path)
    p.add_argument("out", type=Path)
    p.set_defaults(fn=cmd_baseline)
    p = sub.add_parser("commit")
    p.add_argument("ref")
    p.set_defaults(fn=cmd_commit)
    p = sub.add_parser("manifest")
    p.add_argument("--snapshot", type=Path, default=SNAPSHOT_DIR)
    p.add_argument("--work", type=Path, required=True)
    p.set_defaults(fn=cmd_manifest)
    a = ap.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
