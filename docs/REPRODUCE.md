# Reproducing CCOmmit's results

This explains how to rebuild every result the demo shows: the tests, the assessment scores, the recorded snapshot, the legal index and the GitHub red → green check. To just run the app, see the [README](../README.md) or the [jury guide](JURY.md).

## What is pinned

| Item | Value | Where |
|---|---|---|
| Evaluation model | `codestral-latest` (Mistral) | `.env` → `CCO_MODEL_EVAL` |
| Embedding model | `mistral-embed`, 1024 dims | `.env` → `CCO_MODEL_EMBED` |
| Requirement pack | `fintech-eu-fr@0.1.0`, 10 requirements, 18 provisions | `data/packs/fintech-eu-fr.yaml` |
| Expected results | gate and conclusion per requirement, for v0.9.0, rc and v1.0.0 | `demo/wealthpilot/expected.yaml` |
| Demo company code | [RomanGrebnev/FinTechProto](https://github.com/RomanGrebnev/FinTechProto): tag `v0.9.0` = `7bf6004`, `demo/rc` = `356a56c`, `demo/v1` = `051e4f6` | `demo/snapshot/MANIFEST.json` |
| Upload bundles built from those commits | `code.zip` + `compliance/*.md` | `demo/wealthpilot/{v0.9.0,rc,v1.0.0}/upload/` |
| Legal texts | EUR-Lex / CELLAR acts, Légifrance CMF L541-1 and L546-1, AMF / ESMA / CNIL guidance | `data/corpus-cache/` (18 provisions), `data/sources/`, `data/legal-index/` (704 chunks) |
| Recorded runs | three live runs, each scoring 10/10 against `expected.yaml` | `demo/snapshot/` |

The model isn't deterministic: roughly 1 requirement in 10 can change between runs. That's why the acceptance rule below allows a run to miss one, and why the demo restores runs that were checked first.

## Prerequisites

- **For the app:** Docker.
- **For the commands below:** Python 3.12 with [uv](https://docs.astral.sh/uv/), Node 20+ with pnpm, and git.
- **For live runs:** `MISTRAL_API_KEY` in `.env`.
- **For rebuilding the bundles:** a clone of FinTechProto next to this repo (`../FinTechProto`, or set `FINTECHPROTO_DIR`).

```bash
cp .env.example .env            # add MISTRAL_API_KEY
cd backend && uv sync && cd ..
pnpm -C frontend install
```

## 1. Tests (no network, no key)

```bash
make test                                   # backend: pytest, 115 tests
pnpm -C frontend test                       # frontend unit tests (vitest)
pnpm -C frontend exec playwright test       # frontend e2e on fixture data (own server on :20011)
make contracts-check                        # API models, fixtures, OpenAPI and TS types agree
```

## 2. Assessment scores (live, needs the key)

Score one release against `expected.yaml`. Each run takes about 20–60 s.

```bash
cd backend
uv run python -m cco.agent.check --ref v0.9.0 --release 0.9.0     # expect SCORE ≥ 9/10 (typically 10/10)
uv run python -m cco.agent.check --ref rc     --release rc
uv run python -m cco.agent.check --ref v1.0.0 --release 1.0.0
uv run python -m cco.agent.check --ref v0.9.0 --release 0.9.0 --trace   # print prompts and the model's reasoning
```

The golden evaluation runs all three releases five times. It also adds a prompt-injection file to v0.9.0, which must not change any conclusion.

```bash
uv run python -m cco.eval wealthpilot --runs 5 --json ../eval.json
```

Headless audit, exactly as CI runs it: exit code 1 means not ready, 0 means ready or review required, 2 means the engine failed.

```bash
uv run cco audit --help
```

## 3. Rebuild the inputs from source

```bash
make demo-bundles        # git archive of the FinTechProto refs → demo/wealthpilot/*/upload/
```

## 4. Re-capture the recorded snapshot

```bash
make demo-snapshot       # live: audits the three bundles, keeps a run only if it matches expected.yaml
                         # and every blocker/high finding has evidence; writes demo/snapshot/
make demo-reset          # load it into the database (the Docker API also loads it on start)
```

## 5. Rebuild the legal index

```bash
cd backend
uv run python -m cco.legal.build_index              # CELLAR + CMF + guidance → chunks + mistral-embed vectors
uv run python -m cco.legal.build_index --no-embed   # chunks only, no key needed
```

The company index is rebuilt automatically each time a release is ingested.

## 6. The GitHub check, red → green

This runs on [RomanGrebnev/FinTechProto](https://github.com/RomanGrebnev/FinTechProto) and needs push access. To run it on your own fork, add the Actions secrets `MISTRAL_API_KEY` and `CCOMMIT_REPO_TOKEN` (any token works, because this repo is public).

```bash
cd ../FinTechProto
bash scripts/demo_reset.sh --yes      # close the demo PR; demo/base and demo/release back on demo/root
bash scripts/demo_push.sh 1 --yes     # partial fixes
gh pr create --base demo/base --head demo/release --title "Release 1.0.0"
#   → check fails (Not ready), review "Changes requested" with inline comments on the cited code lines
bash scripts/demo_push.sh 2 --yes     # all fixes
#   → check passes (Ready), previous review dismissed, "7 resolved · 0 new"
```

Reference runs from 4 Oct 2026: [red](https://github.com/RomanGrebnev/FinTechProto/actions/runs/37211223778) and [green](https://github.com/RomanGrebnev/FinTechProto/actions/runs/37211288280). Full command notes are in FinTechProto's `docs/g3-commands.md`.

## 7. Evidence from the build

Each task's verification output is in `docs/specs/2026-10-04-cco-mvp/evidence/`, and the spec, the design and the decisions are in the same folder. `make acceptance` runs the acceptance criteria AC1–AC14. Some of them need the live stack and the key.
