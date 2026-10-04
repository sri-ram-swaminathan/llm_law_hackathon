# CCOmmit UI critique — information architecture and user journeys

Reviewer: independent product/UX critic (read-only; no assessment run, no uploads, no reviews posted).
Build: web http://127.0.0.1:20001 @ ft/cco-mvp (4bd73bb). Screenshots in `shots/`, page text dumps in `texts.txt`, script `shoot.cjs`.

## Verdict: SHIP_WITH_CHANGES

The core spine (Overview gate -> Findings -> three-pane workspace -> Legal basis -> Fix plan -> Releases) is coherent and the labels are mostly honest. What breaks the journeys is state ambiguity: which release a global action applies to, whether the activity panel is live or a replay, why the gate says "Ready (AI)" while the API says "Ready", and a headline release (v0.9.0) whose findings cite no code at all, so the signature "doc <-> code highlight" moment cannot be shown where the demo starts.

## Journeys

### Founder / engineer
| Step | Clarity | Notes |
|---|---|---|
| First landing | clear | `/` -> `/r/rel-0.9.0/overview`. Token prompt is a clean one-time modal (shots/00). |
| Understand status | unclear | Gate card is excellent (02). But the stat tile says **Blockers 2** while the card below says **BLOCKERS 3** (W3 "needs evidence" is listed as a blocker): `overview/index.tsx:139-142` lists `readiness.blockers`, the tile counts `counts.blockers`. "9/10 evaluated" on rc and 1.0.0 (26, 27) is never explained. |
| Drill into a finding | clear | Overview blocker row -> workspace with evidence list, viewer, highlights (07). Back arrow works. |
| Understand why + law | clear | Legal basis tab with verbatim provisions, Law/EU-FR badges, official source, retrieval date (09). Duplicate path: a "Legal basis (3)" button on the Finding tab opens a drawer with the same content as the adjacent tab. |
| Act (fix plan) | clear | Fix plan from gate card and from every finding; copy / download; agent vs founder split (21, 22). For a READY release the page still shows "Rules for the agent" + copy button with "Code items 0" (30): empty state missing. |
| Ship a new release | unclear | `/releases` reachable from the header, dialogs clear (23-25). But on `/releases` and `/profile` the section nav disappears and the switcher has no selection while **Run assessment stays enabled and silently runs on `data[0]`** (`Header.tsx:55`), i.e. whatever release the API lists first (currently v1.0.0). |
| See what changed | unclear | "What changed" compares to `previous_release_id` only. v1.0.0 -> "since v1.0.0-rc.12: W1, W2" (27). The demo narrative is v0.9.0 -> v1.0.0 (W1-W7 resolved); no way to pick the baseline. |
| Confirm the profile (journey A) | broken | `/profile` is not in the header; the only link is a footnote on `/releases` (`releases/index.tsx:76`). It shows "Not confirmed yet" (31) and Overview never warns that the gate was computed from an unconfirmed profile. |

### Legal counsel
| Step | Clarity | Notes |
|---|---|---|
| Entry / persona | unclear | Toggle visible, but Counsel mode changes nothing on Overview (14 is identical to 02) or Findings. No answer to "what needs my review?": no "Unreviewed" filter chip, no count. |
| Drill into a finding | clear | Same workspace. |
| Review | unclear | The Counsel review panel is the **last** block of the right pane, below Confidence, Remediation and "Open fix plan" (17). The persona's primary action is below the fold. |
| Carry-forward | unclear | W8 says "carried from v0.9.0" **while on v0.9.0** (05, 15) because the live re-run carried the seeded review. Reads as a bug. On v1.0.0 it is correct and useful (29). |
| Effect on gate | unclear | `gate.ts:9` requires `reviewed >= total` for "Ready", so v1.0.0 renders **"Ready (AI), counsel review still pending"** although the API returns `gate_label: "Ready"` and W8 is counsel-reviewed. Contradicts SPEC 6.3 and G2 step 6. |

### Hackathon judge (3-minute demo)
| Step | Clarity | Notes |
|---|---|---|
| Opening frame | clear | "Can we launch v0.9.0?" + Not ready + counts is a strong first screen. |
| Run / activity | unclear | "Latest run `codestral-latest`" is labelled with a model name. The panel header says **Live** during a replay of a recorded run (04) because `streaming` is true while SSE replays from the table (`activity/index.tsx:54`). REQS shows 2/2 mid-replay. |
| Doc <-> code evidence | broken for v0.9.0 | All three W1 evidence items are documents (07, 08); evidence room says the code artifact has **"No findings cite this"** (18). G2 step 3 cannot happen on v0.9.0. Code highlights exist on v1.0.0 W8 (29). |
| Status vocabulary | unclear | One STATUS column mixes severity (Blocker, High, Medium) and conclusion (Needs evidence, Verified, N/A, Uncertain) (05). W7 "Medium" is a violation but the word never appears. |
| MCP / CI | hidden | Nothing in the UI shows MCP or CI exists besides the "ci" badge and "Import CI run". |

## Findings (ordered by severity)

1. major: Global "Run assessment" with no release context. `frontend/src/app/Header.tsx:55` runs on `data?.[0]` from `/releases` and `/profile`. Change: disable with tooltip when no release is in the URL, or move it per-release on the Releases list.
2. major: v0.9.0 findings cite no code (`shots/18-evidence-room.png`, `shots/07`). Change: re-seed v0.9.0 with the code citations from `expected.yaml` (config.py:10-14, profile.py:12-20) or script the doc/code beat on the rc.
3. major: Gate label contradicts API and spec. `frontend/src/features/overview/gate.ts:9` renders "Ready (AI)" for v1.0.0; API returns `gate_label: "Ready"`; SPEC 6.3 defines "Ready (AI)" as no applicable review. Change: use `readiness.gate_label`; dashed border only when `reviewed === 0`.
4. major: Live vs recorded indistinguishable in the activity panel (`shots/04`, `activity/index.tsx:54`). Change: "Replay . run-996288 . 4 Oct 14:01" when the run has `ended_at`; "Live" only for a run started this session.
5. major: Counsel persona has no entry point; review panel below the fold (`shots/14`, `shots/17`). Change: "Unreviewed n" chip in Findings filters; Counsel review block at the top of the Finding tab.
6. major: "What changed" baseline fixed to the previous release (`shots/27`). Change: "since" picker defaulting to the previous non-rc release, or to the release the user switched from.
7. major: Blockers tile vs list disagree, 2 vs 3 (`overview/index.tsx:84,139-142`, `shots/02`). Change: title the card "Blocking the gate" and show W3 with its "Needs evidence" chip.
8. minor: Profile is a hidden feature (`releases/index.tsx:76`; `shots/31` "Not confirmed yet"). Change: header link + Overview notice when unconfirmed.
9. minor: STATUS column mixes severity and conclusion (`shots/05`). Change: two columns or chip text "Violation . blocker".
10. minor: "carried from v0.9.0" shown on v0.9.0 (`shots/05`, `shots/15`). Change: hide when `carried_from_version` equals the current version.
11. minor: Dead ends. Unknown release -> infinite skeleton (`shots/33`); READY fix plan shows agent rules + copy with 0 items (`shots/30`); W6 empty-evidence copy says "expected when a requirement does not apply" for an Uncertain finding and leaks the raw validator error (`shots/13`, `finding/EvidenceList.tsx:14`).
12. minor: Header nav vanishes below 1024px with no fallback (`shots/35`); on `/releases` only "Releases" remains, so Overview/Findings/Evidence are unreachable without the switcher.

## Top 5 changes before the demo
1. Gate label from the API (`gate_label`) so v1.0.0 reads "Ready" with "counsel-reviewed 1/10".
2. Code evidence on v0.9.0 W1/W2 (re-seed) or script the doc/code beat on the rc/v1.0.0.
3. Activity panel: "Replay" vs "Live"; rename "Latest run codestral-latest" to "Last run . 14:01 . 46 s".
4. Disable "Run assessment" outside a release route; show the target version in the tooltip.
5. Counsel mode: "Unreviewed" filter chip + review panel on top; drop "carried from" on the origin release.
