"""Live accuracy check: run the pipeline's per-requirement evaluation on a demo release and score it.

    uv run python -m cco.agent.check --ref v0.9.0 [--model codestral-latest] [--only W1,W6]

Builds the same bundles as `cco.pipeline.runner` (hints + compliance docs + provisions) from
demo/wealthpilot/<ref>/upload, evaluates every applicable requirement and compares with
demo/wealthpilot/expected.yaml (AI value `conclusion`).
"""

from __future__ import annotations

import argparse
import asyncio
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[3]
REF_KEYS = {"v0.9.0": "0.9.0"}


def _load_env() -> None:
    from dotenv import load_dotenv

    for base in (REPO, *Path(__file__).resolve().parents):
        if (base / ".env").is_file():
            load_dotenv(base / ".env")
            return
    try:  # git worktree: the .env lives in the main checkout
        common = subprocess.run(["git", "rev-parse", "--git-common-dir"], cwd=REPO, capture_output=True,
                                text=True, check=True).stdout.strip()
        env = (REPO / common).resolve().parent / ".env"
        if env.is_file():
            load_dotenv(env)
    except Exception:  # noqa: BLE001
        pass


async def run(ref: str, model_name: str | None, only: set[str], concurrency: int) -> int:
    from cco import seed
    from cco.agent import ArtifactDoc, EvidenceBundle, evaluate_requirement
    from cco.agent.evaluator import make_model
    from cco.db import init_db, make_engine, make_sessionmaker
    from cco.ingest import ingest_bundle
    from cco.pack import load_pack, scope
    from cco.pipeline.runner import _provisions_for

    exp = yaml.safe_load((REPO / "demo/wealthpilot/expected.yaml").read_text())
    key = REF_KEYS.get(ref, ref.lstrip("v"))
    expected = {r["id"]: (r["alias"], r["conclusion"][key]) for r in exp["requirements"]}

    upload = REPO / "demo/wealthpilot" / ref / "upload"
    tmp = Path(tempfile.mkdtemp(prefix="cco-check-"))
    engine = make_engine(f"sqlite:///{tmp}/db.sqlite")
    init_db(engine)
    sm = make_sessionmaker(engine)
    with sm() as s:
        release, artifacts = ingest_bundle(s, upload, ref.lstrip("v"), base=tmp)
        s.commit()
    from cco.contracts.bundle import bundle_root

    root = bundle_root(release.id, tmp)
    code_art = next((a for a in artifacts if a.kind == "code_repo"), None)
    docs = [ArtifactDoc(a.id, a.kind, a.path, a.text) for a in artifacts if a.kind != "code_repo" and a.text.strip()]
    model = make_model(model_name)
    sem = asyncio.Semaphore(concurrency)

    async def one(sr):
        req = sr.requirement
        if not sr.applicable:
            return req, "not_applicable", 0, 0, []
        bundle = EvidenceBundle(root=root, artifacts=docs, code_artifact_id=code_art.id if code_art else "code",
                                provisions=_provisions_for(req))
        async with sem:
            res = await evaluate_requirement(req, bundle, model=model)
        return req, res.candidate.conclusion, res.tool_calls, res.attempts, res.validation_notes

    results = [r for r in scope(seed.PROFILE, load_pack())]
    if only:
        results = [r for r in results if r.requirement.alias in only]
    rows = await asyncio.gather(*(one(r) for r in results))

    ok = 0
    for req, got, tools, attempts, notes in sorted(rows, key=lambda r: r[0].alias):
        alias, want = expected[req.id]
        match = got == want
        ok += match
        print(f"{alias:3} {req.id:28} got={got:22} want={want:22} {'OK ' if match else 'MISMATCH'} "
              f"tools={tools} attempts={attempts}")
        if not match and notes:
            print("     notes:", " | ".join(notes)[:400])
    print(f"SCORE {ok}/{len(rows)}")
    return 0 if ok == len(rows) else 1


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m cco.agent.check")
    ap.add_argument("--ref", default="v0.9.0")
    ap.add_argument("--model", default=None)
    ap.add_argument("--only", default="", help="comma-separated aliases, e.g. W1,W6")
    ap.add_argument("--concurrency", type=int, default=3)
    a = ap.parse_args(argv)
    _load_env()
    only = {x.strip() for x in a.only.split(",") if x.strip()}
    return asyncio.run(run(a.ref, a.model, only, a.concurrency))


if __name__ == "__main__":
    sys.exit(main())
