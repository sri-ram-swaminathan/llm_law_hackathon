# UI critique: clarity, trust, demo readiness (Opus, 2026-10-04)

Verdict: **SHIP_WITH_CHANGES**. Screenshots are in the session scratchpad `ui-critique/opus/shots/`.

## Findings (checked against the code and the API by the orchestrator)

- **blocker:** v0.9.0 shows a weaker live run (`asm-0.9.0-5a9d67`) in place of the seed. W1 has no code evidence, W6 shows raw validator text, and the agent tried to read the non-existent `backend/app/schemas.py`.
- **blocker:** a replay is labelled "Live" (`frontend/src/features/activity/index.tsx:54`).
- **major:**
  - validator/internal error text leaks into the finding, the fix plan and the activity panel;
  - the CI/PR links are fabricated (`releases/index.tsx:97,101`, runs 11000000001/2);
  - the Blockers tile (2) and the Blockers list (3) disagree (`overview/index.tsx:84` vs `:139-142`);
  - "carried from v0.9.0" appears on v0.9.0 itself;
  - the gate is shown against an unconfirmed profile;
  - IDs and enums (FR-CIF-STATUS-01, snake_case, "3 violation") appear on the trust surfaces;
  - "What changed" on 1.0.0 is against rc.12 (W1, W2), not v0.9.0.
- **minor:**
  - no release switcher or navigation at 390px (`Header.tsx:85-86`);
  - an unknown release renders a blank page;
  - the fix plan overflows at 390px;
  - a 1.0.0 plan with no fixes still offers "Copy".
- **Console:** a 401 on first load before the token is entered, and 404s on an unknown release. No JS exceptions.
