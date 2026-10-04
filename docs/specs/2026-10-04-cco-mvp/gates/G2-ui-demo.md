# G2 — UI demo and feedback

- Date: 2026-10-04
- Feeds: V2 (`evidence/V2.md`), T02, T08, T09, T17 (UI), T10/T11 (live run + events)

## How to open it

- Web: http://127.0.0.1:20001 · API: http://127.0.0.1:20000 (stack started with `make up`)
- Deploy token (asked once by the UI): `dev-token`
- Data: clean seed (v0.9.0, 1.0.0-rc.12, 1.0.0 from fixtures + recorded agent run + W8 counsel review)

## 2-minute walkthrough

1. **Overview v0.9.0**: gate card "Not ready", the AI pre-assessment label, counsel-reviewed 1/10, coverage by domain, blockers W1 and W2.
2. **Run assessment** (header): the live activity panel opens. Steps, tool calls, retries and findings stream in; a real Codestral run takes about 20 s. Use ×4 replay for the recorded run.
3. **Open blocker W1**: the three-pane workspace.
   - The document highlight in the business plan / product guide.
   - Click the code evidence: the viewer morphs to `config.py` / `advisor.py` with the lines highlighted.
   - **Legal basis** tab / drawer: MiFID II Art. 4(1)(4), CMF L.541-1, and AMF guidance (law vs guidance badges, official source link).
   - **How this was produced** tab: the agent trace for W1.
4. **Persona → Counsel**: the review panel on W8 (AI Act Art. 50), with Confirm / Override / Not applicable. The gate counters update.
5. **Fix plan** button: the rendered plan, with "Copy as Claude Code prompt" and code items vs the founder appendix.
6. **Release switcher → 1.0.0**: "Ready", What changed (W1–W7 resolved), W8 "carried from 0.9.0".
7. **/releases**: source badges, New release (drag in `demo/wealthpilot/v1.0.0/upload/`), Import CI run.

## Known gaps (not blockers for this demo)

- A *live* run of v1.0.0 still shows W1/W6 false positives (T25 in progress). The seeded v1.0.0 release shows the intended READY state.
- The /profile link is only on the Releases page (T19 adds a header link).
- Evidence search (company + legal indexes, T24) exists in the API. The UI search box comes in T19.

## 7. Decision

<!-- Roman's words, name, date: go / adjust + list of UI changes for T19 -->
