---
id: V2
title: Mid check — live run end to end + model spike (before the UI demo)
kind: verify
deps: [T08, T09, T10, T11, T12, T13, T20]
owns: []
repo: .
needs: [docker, cmd:pnpm, cmd:uv, env:MISTRAL_API_KEY@.env]
verify: make verify-w2
review: none
status: todo
---

# V2 — Wave 2 check: live run end to end in the UI

## Goal

Confirm that a real assessment runs from the UI, streams live activity, and lands in the workspace with working highlights.

## Definition of done

- [ ] `make verify-w2`:
  1. stack up (Postgres + API + web);
  2. `bash scripts/demo_bundles.sh`;
  3. upload the v0.9.0 bundle through the API;
  4. **live** assessment;
  5. assert NOT_READY with W1 and W2 as blockers and W3 insufficient;
  6. `cco spike --repo ../FinTechProto --ref dbb8e64 --req W1,W2,W3` matches ≥ 2/3, and Playwright `golden-path.spec.ts` runs against the live stack;
  7. backend unit suite.
  - Covers AC3, AC5, AC10, AC11, AC14.
- [ ] The FinTechProto suite passes on its `ft/cco-mvp` (T07 + T13).
- [ ] A screen recording or screenshots of the live run are saved to `evidence/V2/` for G2.

## Notes

Clean up with `docker compose -p sdd-cco-mvp down`.
