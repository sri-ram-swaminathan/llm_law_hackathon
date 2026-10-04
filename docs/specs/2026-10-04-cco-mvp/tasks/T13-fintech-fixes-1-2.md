---
id: T13
title: FinTechProto — fix-plan items 1–2 (suitability, CIF wording)
kind: work
deps: [T07]
owns: [backend/tests/conftest.py, backend/app/models.py, backend/app/schemas.py, backend/app/advisor.py, backend/app/config.py, backend/app/routers/advice.py, frontend/src/pages/Onboarding.jsx, frontend/src/components/Disclaimer.jsx, backend/tests/test_suitability.py, backend/tests/test_disclosure.py, version]
repo: ../FinTechProto
needs: [cmd:uv]
verify: cd backend && uv run --no-project --with-requirements requirements.txt --with pytest --with httpx python -m pytest -q
review: none
status: done
---

# T13 — FinTechProto: fix-plan items 1–2 (suitability, CIF wording)

## Goal

Build the "full fix": resolve the two blockers, so the release PR turns green.

## Context

Golden fix plan items 1 (W2) and 2 (W1). Item 2 depends on A1, the `compliance/cif-registration.md` already committed in `dbd5d3c`.

Current code @ `dbb8e64`:

| Area | Location |
|---|---|
| Profile model | `backend/app/models.py:29-40` |
| Profile schema | `backend/app/schemas.py:19-25` |
| Onboarding steps | `frontend/src/pages/Onboarding.jsx:26-31` |
| System prompt | `backend/app/advisor.py:17-26` |
| Disclaimer | `backend/app/config.py:10-14` |

`CIF_ORIAS_NUMBER` defaults to `00000000` (fictional). Bump `version` to `1.0.0`.

## Definition of done

- [ ] Item 1:
  - three new profile fields and 9 onboarding steps;
  - 400 when the profile is incomplete;
  - the prompt includes the new fields and requires a suitability statement.
  - · `backend/tests/test_suitability.py`
- [ ] Item 2: no "not financial advice" string remains; the status disclosure shows the ORIAS number; prompt lines 17–19 are reworded. · `backend/tests/test_disclosure.py` + `! grep -rn "not financial advice" backend frontend/src`
- [ ] The AI-output labels in `Recommendations.jsx` are untouched, so W8's fingerprint is unchanged. · `git diff dbd5d3c -- frontend/src/pages/Recommendations.jsx` limited to item 3/6 changes from T07
- [ ] `version` is `1.0.0`; one commit per item. Branch **`demo/v1`** is created (and pushed) at the result. · `git log`

## Tests

The two files above.

## Out of scope

CI (T18) and the docs (already done).
