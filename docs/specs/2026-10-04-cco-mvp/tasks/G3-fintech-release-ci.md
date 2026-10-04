---
id: G3
title: Human — FinTechProto release PR red → green (replayable)
kind: gate
deps: [G1, T13, T18]
owns: []
repo: ../FinTechProto
needs: [gh]
verify: test -s docs/specs/2026-10-04-cco-mvp/evidence/G3.md
review: none
status: todo
---

# G3 — Human: FinTechProto release PR red → green, tag v1.0.0

## Goal

Roman performs the base-branch steps of the live CI demo. The agent prepares the exact commands and checks each result (AC13b).

## Definition of done

The demo runs on **disposable branches**: `demo/base` (PR target, = `v0.9.0`) and `demo/release` (PR head). `main` is never touched. It can be reset and replayed any number of times (`scripts/demo_reset.sh`).

- [ ] **Secrets** in RomanGrebnev/FinTechProto:
  - `MISTRAL_API_KEY`
  - `CCOMMIT_REPO_TOKEN` (fine-grained, read-only on `sri-ram-swaminathan/llm_law_hackathon`)
- [ ] **Branch protection** on `demo/base`: `compliance` is a required check.
- [ ] `scripts/demo_reset.sh` → open PR `demo/release → demo/base`.
- [ ] `scripts/demo_push.sh 1` → the check is **red** with W1 and W2.
- [ ] `scripts/demo_push.sh 2` → the check is **green**.
- [ ] Merge, then tag `v1.0.0-demo` on `demo/base` → the tag run is READY. Import the artifact into the local app.
- [ ] Reset and replay once, to prove it can be repeated.
- [ ] Run links are recorded in `evidence/G3.md`.

## Notes

T18 prepares `docs/g3-commands.md` in FinTechProto, with the exact commands. Roman runs them, or tells the orchestrator to run them.
