---
id: T18
title: FinTechProto — `compliance.yml` CI workflow
kind: work
deps: [T07, T13, T16]
owns: [.github/workflows/compliance.yml, scripts/ci_run.sh, scripts/demo_reset.sh, scripts/demo_push.sh, docs/g3-commands.md]
repo: ../FinTechProto
needs: [cmd:uv]
verify: uv run --no-project --with pyyaml python -c "import yaml; d=yaml.safe_load(open('.github/workflows/compliance.yml')); assert 'jobs' in d"
review: none
status: doing
---

# T18 — FinTechProto: `compliance.yml` CI workflow

## Goal

Add a release check that runs CCOmmit on GitHub-hosted runners and posts the gate to the PR.

## Context

SPEC §6.12 (triggers, permissions, Postgres service `pgvector/pgvector:pg16`, steps 1–8, secrets `MISTRAL_API_KEY` and `CCOMMIT_REPO_TOKEN`, exit codes, upsert by marker, artifact `ccommit-result`), D14.

CCOmmit is checked out from `sri-ram-swaminathan/llm_law_hackathon` at a pinned ref. Until a tag exists, pin `ft/cco-mvp`. Pass `head.sha` on PRs.

## Definition of done

- [ ] The workflow parses. · the verify command
- [ ] It has `pull_request` (branches `main` and `demo/base`), `push` tags `v*`, and `workflow_dispatch`, with no `pull_request_target`, and `permissions: {contents: read, pull-requests: write}`. · `grep` checks in G3
- [ ] Exit code 2 produces a neutral "CCOmmit could not run" summary.
- [ ] The workflow is a thin wrapper around `scripts/ci_run.sh`, which is runnable locally.
- [ ] **Local dry run:** in a temp clone, build `dev` push 1 and push 2 and run `scripts/ci_run.sh` on each. It exits 1 and then 0, and `comment.md` lists W1 and W2 after push 1. · output pasted into the task Notes
- [ ] `docs/g3-commands.md`: the exact commands for G3 (secrets, branch protection, `dev` from `v0.9.0`, the two pushes, PR, merge, tag), including how to split `dbd5d3c` so `cif-registration.md` goes in push 2.
- [ ] **Replayable demo** (Roman, 4 Oct: "restart it and re-do"):
  - Prepare two fixed refs. **`demo/push1`** = `v0.9.0` + workflow + T07 fixes + privacy policy + terms. **`demo/push2`** = `demo/push1` + T13 fixes + `cif-registration.md` + `cco-baseline.json` carrying W8. Push both.
  - `scripts/demo_push.sh 1|2` force-updates the disposable PR head `demo/release` to `demo/push1` or `demo/push2`.
  - `scripts/demo_reset.sh` closes the open demo PR, resets `demo/base` and `demo/release` to `v0.9.0`, and deletes the demo tag `v1.0.0-demo`.
  - The stable refs `v0.9.0`, `demo/rc`, `demo/v1`, `demo/push1` and `demo/push2` are **never** rewritten.
  - `main` is never touched by the demo.
  - · dry run: reset → push1 (exit 1) → push2 (exit 0) → reset → push1 again, all locally with `ci_run.sh`
- [ ] CCOmmit's `ft/cco-mvp` is pushed with T16 included, so the workflow's pin resolves.

## Out of scope

Adding the secrets and branch protection (G3, human).
