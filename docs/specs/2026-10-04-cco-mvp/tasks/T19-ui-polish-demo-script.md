---
id: T19
title: UI polish, demo script and demo-path e2e
kind: work
deps: [G2, T14, T15, T16, T17]
owns: [frontend/src/**, contracts/openapi.json, frontend/e2e/demo-script.spec.ts, docs/demo-script.md]
repo: .
needs: [cmd:pnpm]
verify: cd frontend && pnpm build && pnpm lint
review: none
status: todo
---

# T19 — UI polish, demo script and demo-path e2e

## Goal

Maximize the wow effect and remove rough edges on the exact path we show on stage.

## Context

The SPEC's demo story (§0, §6.9, §6.12), G2 feedback (`gates/G2-ui-demo.md`), and `docs/design.md`. This is the only frontend task in wave 4, so it may touch any `frontend/src` file except `src/api/types.ts`.

## Definition of done

- [ ] Every item of G2's accepted feedback is done. · checklist in this file's Notes
- [ ] Empty, loading and error states for every page on the demo path; no console errors. · `demo-script.spec.ts` asserts no console errors
- [ ] Motion polish: release switch, gate state change, activity rows and drawer transitions; respects reduced motion. · visual check in VA
- [ ] `make types` is re-run against the real API, and the regenerated `openapi.json` and `types.ts` are committed with the build still green (AC1). · `make types && pnpm build`
- [ ] `docs/demo-script.md`: a 4-minute script with exact clicks, plus a fallback for each step (replay, recorded CI links). · file exists
- [ ] `e2e/demo-script.spec.ts` walks the full script on the seeded stack:
  - Overview v0.9.0
  - live activity (replay mode)
  - W1 workspace, highlights and legal drawer
  - counsel decides W8
  - fix plan copy
  - switch to v1.0.0 → Ready
  - · runs in VA
