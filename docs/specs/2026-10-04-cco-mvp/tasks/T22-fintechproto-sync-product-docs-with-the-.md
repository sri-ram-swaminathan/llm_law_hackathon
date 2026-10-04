---
id: T22
title: FinTechProto — sync product docs with the fixes (rc + v1), rebuild demo refs
kind: work                  # work | verify | gate
deps: [T18]
owns: [docs/PRODUCT_GUIDE.md, docs/TECHNICAL_ARCHITECTURE.md]                # work only: paths or globs this task may edit
repo: ../FinTechProto
needs: [cmd:uv]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "! grep -nE 'Account deletion is not yet available|does not ask about your investment knowledge|This is not financial advice' docs/PRODUCT_GUIDE.md"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: done                   # todo | doing | review | done | blocked | skipped
---

# T22 — FinTechProto — sync product docs with the fixes (rc + v1), rebuild demo refs

## Goal

The fixed Wealthpilot releases describe themselves correctly: the product guide and the technical doc match the code. Then the CI demo goes green for the right reason. "Docs must match code" is itself a compliance point.

## Context

From the T18 dry run (`evidence/T18.md`), `docs/PRODUCT_GUIDE.md` on `demo/v1` and `demo/push2` still says:
- "account deletion not available" (lines 40 and 208);
- "does not ask about investment knowledge, experience…" (line 59);
- the old "not financial advice" disclaimer (line 133);
- "no in-app deletion" (line 226).

CCOmmit cites these, so W1, W2 and W5 stay red.

Fixes landed in:
- **T07** (`demo/rc`): items 3–6, i.e. outdated flag, deletion, secret, history;
- **T13** (`demo/v1`): items 1–2, i.e. suitability questions, CIF status disclosure.

## Definition of done

- [ ] **Commit A** on FinTechProto `ft/cco-mvp`, `docs: sync guide with fixes 3–6 (T22)`: the guide documents account deletion, history and the outdated-analysis flag, and the tech doc no longer lists the `dev-secret-change-me` default.
- [ ] **Commit B**, `docs: sync guide with suitability + CIF status (T22)`: the guide describes the 9-question profile (knowledge, experience, loss capacity), the CIF status disclosure with ORIAS 00000000 (fictional), and the suitability statement. "not financial advice" no longer appears anywhere.
- [ ] **The legal-review appendix** (lines 210–228) is updated to the new behaviour in the matching commit.
- [ ] **Demo refs rebuilt** (nothing has been demoed yet, so moving them now is safe):
  - `demo/rc` = old `demo/rc` + A;
  - `demo/v1` = old `demo/v1` + A + B;
  - `demo/push1` = old `demo/push1` + A;
  - `demo/push2` = old `demo/push2` + A + B.
  - Use cherry-picks on top, never rewrite history below. Leave `v0.9.0` untouched.
  - · `git log --oneline -3 demo/push2`
- [ ] Nothing is pushed. The orchestrator pushes the refs.

## Out of scope

Code changes.
