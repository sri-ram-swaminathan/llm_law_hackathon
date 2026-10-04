# CCOmmit: 4-minute pitch video script

**Slot:** 5 minutes. **Video:** 4:00, which leaves about 1 minute of buffer for questions or a slow start.
**Deck:** https://claude.ai/artifact/5A85PRTnqEYebVYoDeUrkv (13 slides; the speaker notes repeat the lines below).
**Format:** a short roleplay with four voices. The camera alternates between faces, slides and screen recordings.

> **Status:** the UI is still being built (wave 2 of 9). The click labels below follow the spec: SPEC §6.7 and the task files T02, T08, T09, T17 and T19. Re-check every label against the real UI after T19 (UI polish) and before recording. Anything that changes gets updated here.

## Cast

| Role | Who | Voice |
|---|---|---|
| **Founder**: Wealthpilot founder | [teammate] | Worried, honest, a bit funny. "I don't want to go to jail." |
| **CCOmmit**: the product, the "solution guy" | [teammate] | Calm, precise. Drives the screen. |
| **Markos**: legal counsel | [teammate] | Short and authoritative. Only appears for the review. |
| **Narrator**: us, the team | [teammate] | Explains what the product is and why it matters. Voice-over on slides. |

## Before recording (10 minutes, then again before every retake)

1. `make demo-reset` in CCOmmit. The database goes back to seeded v0.9.0, with the recorded runs and no counsel review yet.
2. `bash scripts/demo_reset.sh` in FinTechProto. The demo PR goes back to `v0.9.0`, and the demo tag is removed.
3. `make dev` → open **http://127.0.0.1:20001**. Enter the deploy token once.
4. Browser at 1920×1080, zoom 110%, bookmarks bar hidden, a clean profile, no notifications.
5. Tab 2: the GitHub PR page `RomanGrebnev/FinTechProto`, PR `demo/release → demo/base`.
6. Tab 3: a terminal in FinTechProto, with `scripts/demo_push.sh 2` already typed and not run.
7. **Fallback:** if the live model is slow, use **Replay** in the activity panel at ×4 speed. It shows a real recorded run.

## Timeline

| Time | Visual | Who | Line | Action / click |
|---|---|---|---|---|
| **0:00–0:15** | Slide **cover** | Founder (to camera) | "I'm launching Wealthpilot next month: AI investment ideas for French investors. Someone told me there are laws for this. I have no idea which ones." | — |
| 0:15–0:25 | Slide **cover** | CCOmmit | "That's what I'm for. I'm CCOmmit, your chief compliance officer, and I live in your commits." | Advance → **hook** |
| **0:25–0:40** | Slide **hook** → **problem** | Narrator | "Wealthpilot sits where investment rules, personal data and AI meet. The rules exist, in EU and French law, but they're scattered. And the real risk isn't in the policy. It's in the code." | Advance at 0:32 |
| **0:40–0:55** | Slide **meet** | CCOmmit | "Look: the disclaimer says 'not financial advice', but its own AI prompt says 'name tickers and give percentages'. That's investment advice. A lawyer reading the website never sees this. I read the code." | Advance → switch to **screen** |
| **0:55–1:10** | Screen: **Overview** `/r/v0.9.0/overview` | CCOmmit | "The founder connected the repo and the documents. I'll run the pre-launch assessment." | 1. Release switcher (header) shows **v0.9.0**. 2. Click **Run assessment** (header, right). The **activity panel** slides in. |
| 1:10–1:25 | Activity panel streaming | Narrator | "You watch the agent work: it scopes the rules, pulls the official articles, reads the code, and checks every quote. It even retries when a citation doesn't match." | Hover a `tool_call` row (e.g. `grep_code`) and click to expand it. Point at an amber **retry** row. If it's slow: click **Replay ×4**. |
| **1:25–1:35** | Overview: gate card turns **Not ready** | Founder | "Red bells. Lots of them." | Close the panel (✕). Point at the gate card: **2 blockers · 1 missing · 3 high**. |
| **1:35–2:00** | Finding workspace **W1** | CCOmmit | "Blocker one: you give personal investment advice without CIF status. Here's the disclaimer, here's the exact prompt line, and here's the law, MiFID II and the French Monetary Code, straight from the official source." | 1. Click blocker **"Product wording contradicts the advice it gives"** in **Blockers**. 2. Middle pane shows `config.py` with the highlight. 3. In the left evidence list, click **advisor.py:26**; the pane switches to code with line 26 highlighted. 4. Click the **Legal basis** tab, then **Open official source**: the drawer shows MiFID II Art. 4(1)(4) + CMF L.541-1 with the **Law** badge. |
| **2:00–2:20** | Header persona toggle → **Counsel**; finding **W8** | Markos | "I'm Markos, counsel. I don't read the whole codebase. CCOmmit already did the assessment. It's unsure about one AI Act point. The AI output is already labelled, so: not applicable. My decision carries to the next release." | 1. Header: toggle **Founder → Counsel**. 2. Open **Findings**, filter chip **Uncertain**, click **W8: AI transparency**. 3. Review panel: click **Not applicable**, type "AI output already labelled", **Save**. 4. The chip shows **Counsel decision**, and "counsel-reviewed 1/10" appears on the gate. |
| **2:20–2:35** | Overview → **Fix plan** drawer | Founder + CCOmmit | F: "OK, so what do I actually do?" C: "This. A fix plan your coding agent can run: files, legal basis, and how we know it's done." | 1. Toggle back to **Founder**. 2. Click **Fix plan** (Overview). 3. Scroll from item 1 to item 2. 4. Click **Copy as Claude Code prompt**: a "Copied" toast appears. |
| **2:35–2:45** | Slide **fix** (optional cut) | Narrator | "Six fixes later, with a privacy policy, terms and a CIF registration added, Wealthpilot is ready." | — |
| **2:45–3:20** | Slide **ci** → screen: **GitHub PR** (tab 2) | Narrator → CCOmmit | N: "Six months later the team ships fast. Every release PR meets CCOmmit." C: "First push: red. Two blockers, with the exact lines. Second push…" | 1. Show the PR with the red **compliance** check and the **CCOmmit compliance check ✕ NOT READY** comment. 2. Tab 3: run `scripts/demo_push.sh 2` (pre-typed, press Enter). 3. **Cut** the wait in editing (CI takes about 1–3 min), then show the check **green ✓** and the updated comment **READY · 7 resolved**. |
| 3:20–3:30 | Screen: CCOmmit **v1.0.0** | Founder | "And it's green. Now I can launch." | Release switcher → **v1.0.0**. The gate animates to **Ready**, and **What changed** lists the resolved items. (If needed: **Releases → Import CI run** first; pre-imported in the take.) |
| **3:30–3:45** | Slide **trust** | Narrator | "Official sources, every quote checked against your files, a live trace of what the agent did, and a human always has the final word." | — |
| 3:45–3:52 | Slide **roadmap** | Narrator | "Next: when Wealthpilot trains its own models, CCOmmit flags the new obligations in CI before anything ships." | — |
| **3:52–4:00** | Slide **close** | Founder → all | F: "Launch. Raise. Stay out of jail." All: "CCOmmit." | Hold the slide for 2 seconds. |

**Optional (if under time):** at 3:40, a 10-second Claude Code clip. Type "Which compliance blockers are open?" and the MCP `list_findings` answer appears, showing W1 and W2.

## Click map (quick reference for the screen operator)

| Step | Where | Element |
|---|---|---|
| 1 | Header | Release switcher → **v0.9.0** |
| 2 | Header | **Run assessment** |
| 3 | Activity panel | Expand a `tool_call` row · **Replay ×4** (fallback) · ✕ close |
| 4 | Overview | **Blockers** → first item (W1) |
| 5 | Finding workspace | Evidence list → **advisor.py:26** |
| 6 | Finding workspace | Tab **Legal basis** → **Open official source** |
| 7 | Header | Persona toggle → **Counsel** |
| 8 | Findings | Chip **Uncertain** → **W8** → **Not applicable** → comment → **Save** |
| 9 | Header | Persona toggle → **Founder** |
| 10 | Overview | **Fix plan** → **Copy as Claude Code prompt** |
| 11 | GitHub tab | PR checks + CCOmmit comment |
| 12 | Terminal tab | `scripts/demo_push.sh 2` |
| 13 | Header | Release switcher → **v1.0.0** |

## Recording tips

- Record **screen and faces separately**, then edit. The CI wait (step 12) must be cut.
- The narrator's lines are voice-over on slides. Record them clean in one take.
- Keep the mouse calm: move only to the next element, and let highlights sit for 1 second.
- Total spoken words are about 520 at about 140 words a minute, which comes to about 3:45 plus pauses. Trim the **fix** slide first if long.

## How this differs from the teammates' draft

- **"Red bells → counsel → new docs → green bells"** is kept as Act 1. The "new documentation" is the v1.0.0 compliance docs (privacy policy, terms, CIF registration) plus the fixes from the fix plan.
- **"Six months later" (Act 2)** is shown with what we really built: the CI release gate on a release PR, red then green. The "own models / not just a Mistral wrapper" scenario sits on the **roadmap** slide as what's next, because the product doesn't check model-training obligations today, and we shouldn't demo what doesn't exist.
- **Markos (counsel)** reviews only the one finding the AI is unsure about (W8, AI Act transparency). That's the real "fraction of the cost" story: the assessment is already done.
