---
id: T05
title: Requirement pack (W1–W8, C1–C2) and scoper
kind: work
deps: [T01]
owns: [data/packs/fintech-eu-fr.yaml, backend/cco/pack/**, backend/tests/test_pack.py]
repo: .
needs: [cmd:uv]
verify: cd backend && uv run pytest tests/test_pack.py -q
review: none
status: done
---

# T05 — Requirement pack (W1–W8, C1–C2) and scoper

## Goal

Write the ten curated requirements, each carrying its evidence hints and remediation template, and a scoper that turns the profile into the applicable requirements.

## Context

SPEC §6.5, §6.9 (table, including severities and the mandatory flag), §6.11 (remediation parts), D2, D13, D16.

**Remediation templates:** must reproduce `demo/wealthpilot/v0.9.0/remediation-plan.md`:
- items 1–6, with their locations and boundaries;
- appendix A1–A4;
- W1 is split into code item 2 plus A1/A3, and item 2 `depends_on` A1.

**Evidence hints** use real paths (FinTechProto @ `dbb8e64`):

| Path | Used by |
|---|---|
| `backend/app/config.py` | W1, W6 |
| `backend/app/advisor.py` | W1, W2 |
| `backend/app/schemas.py`, `models.py`, `frontend/src/pages/Onboarding.jsx` | W2 |
| `backend/app/routers/profile.py`, `advice.py` | W4, W7 |
| `backend/app/routers/auth.py` | W5, C2 |
| `docs/PRODUCT_GUIDE.md` | all |
| `compliance/*.md` by kind | W1, W3 |

## Definition of done

- [ ] The pack validates against `data/packs/schema.json`, with exactly 10 requirements and correct severities and mandatory flags. · `test_pack.py::test_pack_valid`
- [ ] Every `derived_from` ID exists in T01's citations list. · `test_pack.py::test_citations_known`
- [ ] `scope(profile)` gives the Wealthpilot profile all 10 requirements; C1's `applies_when` marks it not_applicable, with a reason. · `test_pack.py::test_scope_wealthpilot`
- [ ] The remediation parts match the golden plan's item IDs, kinds, `depends_on` and boundaries. · `test_pack.py::test_remediation_matches_golden`

## Tests

`test_pack.py`.

## Out of scope

Rendering the plan (T15) and evaluating requirements (T06/T10).
