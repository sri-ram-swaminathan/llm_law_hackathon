---
id: G3
title: Human — FinTechProto release PR red → green, tag v1.0.0
kind: gate
deps: [G1, T13, T18]
owns: []
repo: ../FinTechProto
needs: [gh]
verify: git -C ../FinTechProto rev-parse -q --verify refs/tags/v1.0.0
review: none
status: todo
---

# G3 — Human: FinTechProto release PR red → green, tag v1.0.0

## Goal

Roman performs the base-branch steps of the live CI demo. The agent prepares the exact commands and checks each result (AC13b).

## Definition of done

- [ ] **Secrets** in RomanGrebnev/FinTechProto:
  - `MISTRAL_API_KEY`
  - `CCOMMIT_REPO_TOKEN` (fine-grained, read-only on `sri-ram-swaminathan/llm_law_hackathon`)
- [ ] **Branch protection** on `main`: `compliance` is a required check. CODEOWNERS covers `.github/` and `compliance/`.
- [ ] `dev` is created from `v0.9.0`.
- [ ] **Push 1:** the workflow commit, T07's commits and `dbd5d3c` minus `cif-registration.md` (i.e. the A2 + A3 docs). Open PR `dev → main` → the check is **red** with W1 and W2.
- [ ] Counsel's W8 decision: `cco export-baseline 0.9.0` → `compliance/cco-baseline.json`, committed on `dev`.
- [ ] **Push 2:** T13's commits + `cif-registration.md` → the check is **green**.
- [ ] Merge, then tag `v1.0.0` → the tag run is READY. Import the artifact into the local app.
- [ ] Run links are recorded in `evidence/G3.md`.

## Notes

T18 prepares `docs/g3-commands.md` in FinTechProto with the exact cherry-pick list and `gh` commands. Roman runs it step by step.
