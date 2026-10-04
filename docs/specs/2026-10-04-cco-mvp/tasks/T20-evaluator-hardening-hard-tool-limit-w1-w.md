---
id: T20
title: Evaluator hardening — hard tool limit, W1/W6/W8 accuracy
kind: work                  # work | verify | gate
deps: [T10]
owns: [backend/cco/agent/**, data/packs/fintech-eu-fr.yaml, backend/tests/test_evaluator.py, backend/tests/test_hardening.py]                # work only: paths or globs this task may edit
repo: .
needs: [cmd:uv, env:MISTRAL_API_KEY@.env]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "cd backend && uv run pytest tests/test_evaluator.py tests/test_hardening.py -q"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: done                   # todo | doing | review | done | blocked | skipped
---

# T20 — Evaluator hardening — hard tool limit, W1/W6/W8 accuracy

## Goal

Make the full pipeline reproduce the golden expectations on Wealthpilot v0.9.0, starting with the headline W1 blocker.

## Context

Fix task from T10's live smoke run (`evidence/T10.md`), on codestral against the v0.9.0 bundle:
- **W1:** came out `uncertain`. Codestral looped on tools (185 calls despite `UsageLimits` = 6).
- **W6:** came out `uncertain`; validation retries were exhausted.
- **W8:** came out `satisfied`; the expected result is `uncertain`, which leads into the counsel review.
- **The other seven** matched.

The isolated `cco spike` (T06) found W1, W2 and W3 with 0 tool calls, so the pipeline's richer bundle or provisions are what trigger the tool use.

SPEC §6.4 and D16 still hold: severity is never set by the model, and validation is unchanged.

## Definition of done

- [ ] **Hard tool cap**, enforced by a counter inside the tool functions themselves, not only `UsageLimits`.
  - After N tool calls (default 6), tools return "limit reached — answer now with the evidence you have".
  - Total model requests per requirement are capped (≤ 1 + 6 + 2 retries).
  - · `test_hardening.py::test_tool_cap_enforced` (FunctionModel that always calls tools)
- [ ] **Evidence first.**
  - The prompt says the preloaded evidence is normally sufficient and tools are only for missing context.
  - Tools are offered only when the bundle lacks a hinted file.
  - · `test_hardening.py::test_no_tools_when_bundle_complete`
- [ ] **Live accuracy:** `uv run python -m cco.agent.check --ref v0.9.0` (new module in `agent/`) runs all 10 requirements through the evaluator, as the pipeline does, and matches `demo/wealthpilot/expected.yaml` for v0.9.0 on **≥ 9/10, twice**. W1, W2 and W3 must always match.
  - Tune the pack statements, `evidence_needed` and evidence hints for W1, W6 and W8 in `data/packs/fintech-eu-fr.yaml`. Ids, severity, `derived_from` and remediation stay unchanged.
  - For W8, the statement should ask whether AI Act Art. 50 transparency obligations clearly apply to a non-chatbot recommendation feature. When applicability is unclear, the answer is `uncertain`.
  - · paste the output in the task Notes

## Tests

`test_hardening.py` (new), `test_evaluator.py` (keep passing).

## Out of scope

Pipeline code (T10) and the gate.

## Notes
