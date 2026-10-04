---
id: VA
title: Acceptance — AC1–AC14 and the full demo script
kind: verify
deps: [T19, T21, T22, T23, T24, G3]
owns: []
repo: .
needs: [docker, cmd:pnpm, cmd:uv, env:MISTRAL_API_KEY@.env]
verify: bash docs/specs/2026-10-04-cco-mvp/acceptance.sh
review: none
status: todo
---

# VA — Acceptance: AC1–AC14 and the full demo script

## Definition of done

- [ ] `acceptance.sh` passes: one `check` per AC in SPEC §9, plus `e2e/demo-script.spec.ts` on the seeded stack.
- [ ] The demo is rehearsed twice in a row, following `docs/demo-script.md`, with `make demo-reset` in between.
