# CCOmmit UI redesign: design review and spec (G2 ADJUST → T26+)

Author: lead product designer / frontend architect (Opus), 2026-10-04. Read-only review of `ft/cco-mvp` @ 4bd73bb. The live API (`:20000`) and the code were checked; numbers below come from the running app.

Inputs: G2 §7 (founder, primary), `critique/ui/fable-journeys.md`, `critique/ui/opus-clarity.md`, SPEC §1–2/6/7/9, `frontend/src/**`, `backend/cco/api|contracts|ingest|cli|eval|seed`, pack, demo bundles, screenshots `ui-critique/{fable,opus}/shots`.

## 0. What the review found that changes the plan

Grounded facts. Each one shapes a decision below.

| # | Fact (verified) | Consequence |
|---|---|---|
| F1 | Seeded release SHAs are fabricated: `rel-0.9.0.git_sha = 81bbbbe5c0f1a2b3…` while FinTechProto tag `v0.9.0` is **`7bf6004`**. rc and 1.0.0 have `a1b2c3d4…` / `f0e1d2c3…` and CI URLs `…/runs/11000000001/2`. | Comment 4 is worse than "mocked links": the provenance itself is fake. The demo dataset must come from a real snapshot (T26/T33), and fixture mode shows a "Sample data" banner. |
| F2 | The live DB's v0.9.0 latest assessment is a weaker live run (`asm-0.9.0-5a9d67`). **Every** W1–W8 evidence ref is a `document_span`, W6 is `uncertain` with no evidence and the note "output validation failed after 2 retries". The hand-written fixture cites code. | The product is *already document-heavy in its data*. The UI hides that behind an "Evidence room" and a code viewer. Documents become the main surface (comment 5). The snapshot capture must reject runs whose blockers lack evidence (§6, B6). |
| F3 | `CiResult` has no artifacts. `POST /releases/import` and `cco import` create a release **with zero artifacts**. | A real CI import would have an empty Documents tab. Additive fix B2: `CiResult.artifacts`. It is also how the snapshot carries documents. |
| F4 | `ingest_bundle` sets `previous_release_id` to the *latest-created* release. | Deriving from v0.9.0 while 1.0.0 exists would diff against the wrong base. Additive kwarg B3. |
| F5 | `ReviewCreate` = `reviewer_name, decision (confirm/override/not_applicable/need_evidence), override_conclusion?, comment`. Reviews are **per finding**: no span anchor, no flag type. | Counsel actions on a highlight act on the owning finding. The copy says so: "Applies to W1 (3 evidence spans)". The note is `comment`, required by the UI. We don't invent span comments. |
| F6 | `FindingDetail` (`GET /findings/{id}`) already returns `finding + requirement + provisions + reviews` in one call. | The compliance-check view needs no new endpoint. |
| F7 | The pack has no list endpoint. The frontend reads `contracts/fixtures/requirements.json` in both modes. The org has no endpoint: `ProductOut` only carries `organization_id`. | Keep the requirements fixture (deterministic, same pack). Add `organization` to `ProductOut` (B1) so the entry point shows "Wealthpilot SAS" from data. |
| F8 | `GET /runs/{id}` gives `status running|ok|failed`, `started_at`, `ended_at`, totals. | This drives "Live" (status `running` only) vs "Recorded · 4 Oct 14:01 · 46 s", and the value metric "in X s". |
| F9 | `playwright.config.ts` uses `reuseExistingServer: true` on **:20001**, the port the Docker web app serves *without* fixtures. | E2E specs silently hit the live stack. T27 moves the fixtures server to :20011. |
| F10 | `MarkdownView` already renders N offset-based highlights per document with severity precedence; `highlight.ts` computes them from all findings. | The "contract review" document view is a layout and annotation job on a proven engine, not a rewrite. |

## 1. Verdict on the founder's 10 comments

| # | Comment | Verdict | One line |
|---|---|---|---|
| 1 | Header version switcher / stage selector; need an org → product entry | **Valid** | The switcher makes "which release?" ambiguous (critique: Run silently targets `data[0]`). Entry becomes Workspace → Product → Release, with a breadcrumb. Stage becomes a product attribute. |
| 2 | Findings / Evidence / Releases don't follow the journey | **Valid** | Tabs are reordered to the journey: Summary → Risks → Documents → Code → Fix plan → Activity. Releases move up a level to the product timeline. |
| 3 | No place to upload a single new document and have it indexed | **Valid** | Today only a whole-bundle "New release" exists. Add/replace a document derives a new release (B4), re-indexes on ingest, and runs. |
| 4 | CI run / PR #1 links are mocked | **Valid, worse than stated** | SHAs are fabricated too (F1). Show only real provenance. The snapshot uses real tag commits. "Connect CI" shows the real workflow. |
| 5 | Reads code-centred; must check docs, plan, terms and highlight them | **Partially valid** | The data is doc-heavy (F2); the presentation isn't. Documents become a first-class tab with inline highlights and margin annotations. Code is secondary. |
| 6 | Comparison against legal sources must be vivid | **Valid** | The finding becomes a "compliance check": company evidence ↔ verdict ↔ law text, linked by drawn connectors, with law in serif and the company text in sans. |
| 7 | Put the value up front | **Valid** | The Summary hero says what was checked against what and how fast, all from API numbers. The product home hero says it per release. |
| 8 | "Start demo": check out the flawed version, run the analyzer, show risks by category, alerts, highlights, recommendations | **Valid, with one nuance** | No runtime `git checkout` (server-side repo ingestion is a non-goal, M5). We ingest the bundle built from tag `v0.9.0` and show the tag and commit as provenance. |
| 9 | Founder vs Counsel shows no difference | **Valid** | Counsel becomes a distinct mode: its own frame, a review queue, inline decisions, keyboard flow, and a gate-impact preview. |
| 10 | State-of-the-art UI; review → plan → tasks → run; don't rewrite the backend; take both critiques | **Valid** | This doc plus the §7 task split. The backend changes are 5 additive items (§6). Every critique finding maps to a task (§7, "critique coverage"). |

### Where I deviate from the orchestrator's position (and why)

1. **Start demo restores the snapshot *minus* v0.9.0, then ingests v0.9.0 live.** Restoring all three and then ingesting v0.9.0 again would collide on `rel-0.9.0` or force a fake `0.9.0-live` version. The timeline sorts by **semver**, not `created_at`, so the live v0.9.0 sits under the recorded 1.0.0-rc and 1.0.0. Reset restores all three as recorded.
2. **No category hues.** Status owns colour (red, orange and so on). Four more hues would make "red = violation" unreadable in the document margins. Categories get an icon, a label and order. The "Risks by category" grouping does the job.
3. **There is no separate live-run route.** A live run is a *state* of the release, not a page. A sticky run strip shows on every tab, Summary fills in as `finding` events arrive, and the Activity tab holds the full timeline. "Lands on Summary" is literal: Start demo navigates to Summary in its live state.
4. **The org comes from an additive field on `ProductOut`, not a new endpoint (B1).** One call feeds the workspace home.
5. **One extra additive fix the orchestrator didn't list: `CiResult.artifacts` (B2).** Without it, any real CI import has no documents (F3), and the snapshot couldn't carry them.

## 2. Information architecture and route map

```
/                                   Workspace home: Wealthpilot SAS → product cards
/p/:productId                       Product home: value hero, release timeline, Connect CI, profile summary
/p/:productId/profile               Regulatory profile (moved; reached from the product home)
/p/:productId/v/:version            → redirect to …/summary
/p/:productId/v/:version/summary    Release report · Summary (default)
/p/:productId/v/:version/risks[/:findingId]       Risks by category · Compliance check
/p/:productId/v/:version/documents[/:artifactId]  Documents with highlights + margin annotations   (?f=<findingId> focuses)
/p/:productId/v/:version/code[?path=…]            Code with line highlights + annotations           (?f=<findingId>)
/p/:productId/v/:version/fix-plan                 Fix plan
/p/:productId/v/:version/activity[?run=<runId>]   Agent activity (live or recorded)
/p/:productId/v/:version/review[/:findingId]      Counsel review queue (counsel mode only; founder mode redirects to risks)
```

The URL uses `version` (readable, and what the breadcrumb shows). It resolves through `GET /releases`. Release ids keep the `rel-<version>` convention.

**Chrome.** The top bar holds the wordmark, the breadcrumb `Wealthpilot SAS / Wealthpilot / v0.9.0 ▾` and, on the right, the Mode switch (Founder | Counsel) and the theme toggle. The `v0.9.0 ▾` crumb is the only version picker: a popover listing the timeline with gate chips. Under it, on release routes, comes the **release header**: version, gate chip, provenance line, and the "Re-run assessment on v0.9.0" button. Then the tabs. There's no stage pill: stage shows as a tag on the product card and the product home ("Pre-launch").

| Old route | New route | Notes |
|---|---|---|
| `/` (redirect to the first release) | `/` Workspace home | Explicit entry point (comment 1) |
| `/profile` | `/p/wealthpilot/profile` | Old path redirects |
| `/releases` | `/p/wealthpilot` (timeline) | Old path redirects |
| `/r/:id/overview` | `/p/wealthpilot/v/:version/summary` | `id` → `version` by stripping `rel-` |
| `/r/:id/findings` | `…/risks` | |
| `/r/:id/findings/:fid` | `…/risks/:fid` | |
| `/r/:id/evidence[/:aid]` | `…/documents[/:aid]`; `code_repo` → `…/code` | |
| `/r/:id/fix-plan` | `…/fix-plan` | |
| activity slide-over | `…/activity` + run strip | The slide-over is retired |
| (none) | `…/review[/:fid]` | Counsel mode |
| unknown release or finding | Not-found card with "Back to Wealthpilot" | Fixes the infinite skeleton (critique 11) |

All legacy redirects live in one `LegacyRedirects` component (T27).

## 3. Journeys

### 3.1 Founder: "Can I launch, and what do I do?"

| # | Screen | What they see | Primary action |
|---|---|---|---|
| 1 | Workspace home `/` | Wealthpilot SAS → product card "Wealthpilot · Pre-launch · v0.9.0 Not ready · 3 blocking" | **Open Wealthpilot** |
| 2 | Product home | Value hero for the latest release. Timeline: 1.0.0 Ready (recorded audit, ref demo/v1 @ sha) · rc.N Not ready · 0.9.0 Not ready (live, 2 min ago) | **Open v0.9.0** |
| 3 | Summary | Gate "Not ready", why (3 blocking), value line "Checked 4 documents and 63 code files against 14 provisions from GDPR, MiFID II, AI Act, CMF in 46 s", risks grouped into 4 categories, next step "Fix plan: 6 code changes, 4 founder actions" | **Open the top blocker** (W1) |
| 4 | Risks → Compliance check W1 | Business-plan clause highlighted ↔ verdict "Violation · Blocker" ↔ MiFID II Art. 4(1)(4) and CMF L.541-1 verbatim with official links | **See in document** |
| 5 | Documents (business plan, W1 focused) | The whole plan with all highlights (W1, W2…) and margin notes. "Missing: Privacy policy (W3), Terms, CIF registration" | **Add or replace a document** (or the Fix plan) |
| 6 | Fix plan | Code items for the coding agent; founder appendix A1–A4 | **Copy as Claude Code prompt** |
| 7 | Documents → Add document | Upload `privacy-policy.md` into the "Privacy policy" slot. New version `0.9.1` derived from v0.9.0 | **Create v0.9.1 and assess**, then the live run, then the Summary with "What changed since v0.9.0: W3 resolved" |

### 3.2 Counsel: "What needs my judgement, and what does it change?"

| # | Screen | What they see | Primary action |
|---|---|---|---|
| 1 | Any release screen | Mode switch → **Counsel**: teal frame, banner "Counsel review · v0.9.0 · 1 of 10 reviewed · 2 need you" | **Open review queue** |
| 2 | Review queue `…/review` | Left: queue, unreviewed first, ordered uncertain → blocker → high → rest; progress `1/10`. Centre: the compliance check of the selected finding. Bottom: decision bar | Keyboard: `J/K` move, `C/O/N/E` pick, type a note, `⌘↵` record |
| 3 | Decision bar (W8 uncertain) | Picking **Not applicable** previews "Gate stays **Not ready** (W1, W2, W3 still block). Counsel-reviewed 1 → 2/10" | **Record decision** → the queue moves on to the next unreviewed finding |
| 4 | Documents (counsel mode) | Margin annotations carry inline Confirm / Override / N/A / Need evidence | Review in context of the clause |
| 5 | Reviewed finding | "Not applicable · Roman (counsel) · 'No chatbot; AI output labelled' · 14:05". On later releases: "Carried from v0.9.0 · evidence unchanged" | **Revoke** if wrong |
| 6 | Exit (`Esc` or the switch) | Back to founder mode on the same screen | — |

### 3.3 Demo / judge (3 minutes)

| # | Screen | What they see | Primary action |
|---|---|---|---|
| 1 | Workspace home | Product card plus a **Start demo** CTA (only when `GET /demo` says enabled), with the line "Live run on FinTechProto v0.9.0 · tag v0.9.0 @ 7bf6004" | **Start demo** |
| 2 | Inline confirm sheet | "Resets Wealthpilot to the recorded snapshot (captured 4 Oct 15:20) and runs a live assessment of v0.9.0. About 30–60 s." | **Start live run** |
| 3 | Summary, live state | Run strip "● Live · 6/10 requirements · 00:23 · Watch the agent". Category cards fill as findings arrive; the gate reads "Assessing…" | (watch) or **Watch the agent** → Activity |
| 4 | Summary, run ended | The gate resolves to **Not ready** (one-time reveal). Value line with real numbers. 3 blocking risks | **Open W1** |
| 5 | Compliance check W1 | Evidence ↔ law, connectors draw in | **See in document** |
| 6 | Documents | Business plan with every risk highlighted; margin notes by category | **Fix plan** |
| 7 | Fix plan | Recommendations | Breadcrumb → **v1.0.0** |
| 8 | v1.0.0 Summary (recorded) | "Ready · counsel-reviewed 1/10". What changed since v0.9.0: W1–W7 resolved. Provenance "Recorded audit · FinTechProto demo/v1 @ sha" | (Counsel beat: switch mode, review W8 on v0.9.0) |
| ✕ | Fallback | Live run fails (Mistral down, `run_end` with error) → banner "The live run couldn't finish: model unavailable. **Show the recorded v0.9.0 run** (captured 4 Oct 15:20)" | → `POST /demo/reset` → Summary of the recorded run, labelled Recorded |

## 4. Screen-by-screen spec

Shared conventions:
- **Loading:** skeletons shaped like the content, never spinners on whole pages.
- **Error:** an inline `Banner tone=error` with the HTTP reason in plain words and **Retry**.
- **401:** the token prompt. Nothing fetches before the token exists, which fixes the console 401.
- **404:** a `NotFound` card.
- **Labels:** every gate surface carries **"AI pre-assessment, not legal advice"** and **"Counsel-reviewed n/m"** (verbatim from `readiness.labels`).
- **Fixtures mode (`VITE_FIXTURES=1`):** a slim "Sample data: fixtures, not a real run" banner across the top. All links are disabled.

### 4.1 Workspace home `/`

Purpose: the explicit entry point (comment 1). Answers "where am I, what's the state of my product?"

```
┌ CCOmmit ─────────────────────────────────────────────── Founder|Counsel  ◐ ┐
│                                                                            │
│  Wealthpilot SAS                                    Organization           │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ Wealthpilot                                   Pre-launch · EU, FR  │    │
│  │ AI-generated, personalised portfolio recommendations for French    │    │
│  │ retail investors. No trade execution.                              │    │
│  │                                                                    │    │
│  │ Latest release  v0.9.0  ● Not ready  3 blocking · 4 Oct 15:20     │    │
│  │ 3 releases · last checked 4 documents + 63 code files              │    │
│  │                                   [Start demo ▶]   [Open product →]│    │
│  └────────────────────────────────────────────────────────────────────┘    │
│  AI pre-assessment, not legal advice                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

**Components:** `OrgHeader`, `ProductCard`, `GateChip`, `DemoStartSheet` (T32 slot `home.demo`).

**API:** `GET /api/product` (with `organization`, B1) · `GET /api/releases` · `GET /api/releases/{latest}/readiness` · `GET /api/demo`.

**States:**
- No releases: "No releases yet. Upload your first bundle." → product home.
- `GET /demo` disabled: the Start demo button isn't rendered.
- Product fetch error: a Banner with Retry.

**Copy:** "Open product", "Start demo", "Latest release", "{n} blocking".

### 4.2 Product home `/p/:productId`

Purpose: value up front (comment 7) and an honest release history (comment 4).

```
Wealthpilot SAS / Wealthpilot
┌ Hero ──────────────────────────────────────────────────────────────────────┐
│ v0.9.0 is not ready to launch                       ● Not ready            │
│ Checked 4 documents and 63 code files against 14 provisions               │
│ from GDPR · MiFID II · AI Act · CMF in 46 s.                               │
│ 3 blocking · 2 high · 1 needs counsel        [Open report →] [Fix plan]    │
│ AI pre-assessment, not legal advice · Counsel-reviewed 1/10                │
└────────────────────────────────────────────────────────────────────────────┘
Releases                                   [Add document…] [New release] [Import CI run]
│ ● 1.0.0        Ready             Recorded audit (CLI) · ref demo/v1 @ 3c1e9a2 · 4 Oct
│ ● 1.0.0-rc.12  Not ready  2 blk  Recorded audit (CLI) · ref demo/rc @ 8d02b11 · 4 Oct
│ ● 0.9.0        Not ready  3 blk  Upload · ref v0.9.0 @ 7bf6004 · live run 2 min ago
│ (vertical timeline, semver-desc; each row → Summary; gate chip; "What changed" mini-diff)
┌ Connect CI ────────────────────────┐ ┌ Regulatory profile ──────────────────┐
│ 1 Add .github/workflows/compliance  │ │ Pre-launch · EU, FR · fintech        │
│ [yaml snippet, Copy]                │ │ investment advice, retail, AI recs   │
│ 2 gh run download … -n ccommit-res… │ │ ⚠ Not confirmed: the gate assumes    │
│ 3 [Import CI run]                   │ │   these values. [Review and confirm] │
└─────────────────────────────────────┘ └──────────────────────────────────────┘
```

**Components:** `ValueHero` (shared with Summary), `ReleaseTimeline`, `ProvenanceLine`, `ConnectCiPanel`, `ProfileCard`, the existing `NewReleaseDialog` / `ImportDialog` (moved).

**API:**
- `GET /api/product` · `GET /api/releases`
- `GET /api/releases/{id}/readiness` for each release (≤ 5; cached)
- `GET /api/runs?release_id=` for the latest release (duration, live status)
- `GET /api/provisions/{id}` for the union of citations (acts list)
- `POST /api/releases` · `POST /api/releases/import`

**Provenance rules** (one pure function `provenance(release, runSummary)` in `lib/provenance.ts`):
- `source=ci` with `ci_run_url` → "CI · PR #n · run ↗" (a real link; only GitHub Actions runs pass `--run-url`).
- `source=ci` without a URL → "Recorded audit (CLI)".
- `source=ui` → "Upload". When `previous_release_id` is set and the version came from derive → "Upload · derived from v0.9.0".
- `source=seed` → "Seed".
- `branch` is shown as "ref <branch>". `git_sha` shows as 7 characters, no link.
- In fixtures mode all links are suppressed and the whole app shows the Sample banner.

**Connect CI:** the YAML is the real `compliance.yml`, copied verbatim into `contracts/ci/compliance.yml` and imported with `?raw`. No fake run links.

**States:**
- Latest release not assessed: the hero says "v0.9.1 hasn't been assessed yet" with [Run assessment].
- Run in flight: the hero shows the live strip.

### 4.3 Release header and tabs (all `…/v/:version/*`)

```
Wealthpilot SAS / Wealthpilot / v0.9.0 ▾
v0.9.0  ● Not ready   Upload · ref v0.9.0 @ 7bf6004 · assessed 4 Oct 15:20 (live)   [↻ Re-run on v0.9.0]
Summary   Risks 8   Documents 4   Code 3   Fix plan   Activity            (Counsel: Review 2 before Risks)
[run strip when a run is in flight: ● Live · 6/10 requirements · 00:23 · Watch →]
```

**Behaviour:**
- Tabs show counts. Risks counts the open findings (effective conclusion not satisfied or n/a). Documents counts the docs. Code counts the cited files.
- Below `md` the tabs become a horizontally scrollable segmented bar, and the breadcrumb collapses to `‹ Wealthpilot · v0.9.0 ▾`. This fixes the mobile nav (critique 12).
- **Re-run:** `POST /api/releases/{id}/assessments`. A 409 shows "A run is already in progress", with a link to it. The button is scoped to the release in the URL, and its tooltip names the version (critique 1).

### 4.4 Summary `…/summary`

Purpose: answer "can I launch, why not, what's checked, what next".

```
┌ Gate ─────────────────────────────┐ ┌ What was checked ─────────────────────────┐
│ NOT READY                          │ │ 4 documents   63 code files   14 provisions│
│ 3 risks block launch               │ │ GDPR · MiFID II · Del.Reg 2017/565 ·       │
│  2 violations (blocker)            │ │ AI Act · CMF   + AMF/ESMA/CNIL guidance    │
│  1 missing mandatory evidence      │ │ 10 requirements · 46 s · Recorded 4 Oct    │
│ AI pre-assessment, not legal advice│ │ 15:20 (or ● Live)                          │
│ Counsel-reviewed 1/10 ▓░░░░░░░░    │ └────────────────────────────────────────────┘
└────────────────────────────────────┘
Risks by category
┌ Licensing (2) ───────┐ ┌ Suitability (3) ─────┐ ┌ Data protection (4) ┐ ┌ AI transparency (1)┐
│ W1 Violation·Blocker │ │ W2 Violation·Blocker │ │ W3 Missing evidence │ │ W8 Not applicable  │
│ C1 Not applicable    │ │ W4 Violation·High    │ │ W5 Violation·High   │ │   counsel ✓        │
│                      │ │ W7 Violation·Medium  │ │ W6 Needs review     │ │                    │
│                      │ │                      │ │ C2 Compliant        │ │                    │
└──────────────────────┘ └──────────────────────┘ └─────────────────────┘ └────────────────────┘
┌ Next step ──────────────────────────────┐ ┌ What changed since [v0.9.0 ▾] ──────────────┐
│ Fix plan: 6 code changes · 4 founder    │ │ Resolved W1 W2 W3 W4 W5 W6 W7 · New — ·     │
│ actions  [Open fix plan] [Copy prompt]  │ │ Unchanged W8 C1 C2                          │
└─────────────────────────────────────────┘ └─────────────────────────────────────────────┘
⚠ Profile not confirmed: this gate assumes the seeded profile. [Review profile]   (only if confirmed_at = null)
```

**Rules (critique fixes):**
- **Gate title:** `readiness.gate_label` verbatim ("Ready" on 1.0.0, not "Ready (AI)"). The dashed "AI only" border appears only when `counsel_reviewed.reviewed === 0`.
- **Block count:** "{n} risks block launch" = `readiness.blockers.length`. The breakdown comes from the same list (violation-blocker vs missing evidence). The old Blockers tile (2) that disagreed with the list (3) is gone.
- **"What was checked":**
  - documents = artifacts with `kind ≠ code_repo`; code files = `code_repo.files.length`;
  - provisions = the union of `finding.citations`; acts come from `shortAct(provision.act_title)`, with law and guidance shown in separate groups;
  - requirements = `counts.requirements_total`; duration = `ended_at − started_at` of `GET /runs/{assessment.run_id}`.
  - "9/10 evaluated" is replaced by "10 requirements · 1 out of scope".
- **Category cards:** groups by `requirement.domain`, in the order Licensing, Suitability, Data protection, AI transparency, others. Rows sort by severity, then status. Each row links to `…/risks/:fid`.
- **Fix-plan counts:** remediation parts of open findings, from the pack. This mirrors the deterministic renderer: code parts → "code changes", document and organisational parts → "founder actions". At zero → "Nothing to fix for launch", and the copy button is hidden (critique 11).
- **What changed:** the default baseline is `previous_release_id`. The picker allows any earlier release; the diff is computed client-side from both findings lists by `requirement_id` and effective conclusion. Deterministic: the same rule as `changes_since_previous`.

**API:**
- `GET /api/releases` (version → id) · `GET /api/releases/{id}` · `GET /api/releases/{id}/readiness`
- `GET /api/assessments/{asm}/findings` · `GET /api/provisions/{id}` · `GET /api/runs/{run_id}` · `GET /api/product`

**Live state:**
- The gate card shows "Assessing… 6/10" with a shimmer bar.
- Category cards show placeholders for requirements not yet reported. Each `finding` SSE event invalidates `findings` and `readiness` (debounced 300 ms), so rows enter one by one.
- On `run_end` the gate value cross-fades in once.

**States:**
- Not assessed: an empty-state card "This release hasn't been assessed" with [Run assessment].
- Assessment failed: Banner "The last run failed: {plain reason}" with [Re-run].

### 4.5 Risks `…/risks`

A list grouped by category (the same grouping as Summary, full width). Columns: alias · title · **status** (plain conclusion word) · **severity** (separate tag) · evidence summary ("2 document clauses · 1 code location" or "Document missing: privacy policy") · counsel ("Reviewed ✓" or "Carried from v0.9.0" or "—").

Filters (chips): All · Blocking · Needs counsel (uncertain or unreviewed) · Compliant · Not applicable.

**Plain-language vocabulary** (`lib/status.ts`, used everywhere, no enums on trust surfaces):

| `effective_conclusion` | Status word | Colour | | `severity` | Tag |
|---|---|---|---|---|---|
| potential_violation | Violation | blocker / high / medium tone by severity | | blocker | Blocker |
| insufficient_evidence | Missing evidence | evidence (blue) | | high | High |
| uncertain | Needs counsel | uncertain (violet) | | medium | Medium |
| satisfied | Compliant | satisfied (green) | | low | Low |
| not_applicable | Not applicable | na (grey) | | | |

The chip renders "Violation · Blocker". Requirement ids (`FR-CIF-STATUS-01`) appear only in a tooltip on the alias.

**API:** findings + the requirements fixture.

**Empty:** "No risks in this category."

### 4.6 Compliance check `…/risks/:findingId` (comment 6)

Purpose: make "your text vs the law" undeniable.

```
‹ Risks   W1  Product wording contradicts the advice it gives        Violation · Blocker   Licensing
┌ YOUR COMPANY ────────────────┐   ┌ VERDICT ─────────────┐   ┌ THE LAW ───────────────────────────┐
│ Business plan · §1 Summary   │╲  │  ● Violation         │  ╱│ LAW · EU  MiFID II · Art. 4(1)(4) │
│ "…gives French retail        │ ╲ │  Blocker             │ ╱ │ ‘investment advice’ means the     │
│ investors a ▇personal invest-│──▶│                      │◀──│ provision of personal recommend-  │
│ ment adviser▇ in their pocket│ ╱ │ The plan offers      │ ╲ │ ations to a client…  (serif)      │
│ …"   [Open in document →]    │╱  │ personalised buy/sell│  ╲│ Official source ↗ · EUR-Lex ·     │
│ Product guide · notice       │   │ advice, which is     │   │ retrieved 4 Oct 2026               │
│ "…This is not financial      │   │ investment advice    │   ├────────────────────────────────────┤
│ advice…"                     │   │ under MiFID II, while│   │ LAW · FR  CMF · Art. L.541-1 (I)  │
│ backend/app/config.py 10–14  │   │ the product denies   │   │ …                                  │
│ ▌10 DISCLAIMER = "not finan… │   │ it and shows no CIF  │   ├────────────────────────────────────┤
│                              │   │ registration.        │   │ GUIDANCE · AMF  CIF status …      │
│ ⦸ Missing: CIF registration  │   │ Confidence: high     │   │ (guidance: interprets, not binding)│
└──────────────────────────────┘   │ [Fix: P2, A1, A3 →]  │   └────────────────────────────────────┘
                                   └──────────────────────┘
What the rule requires (CCOmmit rule W1, curated from MiFID II 4(1)(4), CMF L.541-1, L.546-1): <statement>
[ How this was produced ▸ ]  (collapsible: the Activity timeline filtered by requirement_id; validation notes live here, never in the verdict)
[slot check.actions]  ← counsel decision bar in counsel mode (T31)
```

**Evidence column:**
- Each `document_span` renders as a clause card: kind label, the nearest preceding Markdown heading (computed client-side from `artifact.text` before `start`), the quote with ±120 chars of context, and the quote itself highlighted.
- Each `code` ref renders as a mini code block of lines `start_line−2 … end_line+2` with a band.
- A `missing` ref renders as a ghost card: "⦸ Missing: Privacy policy. Not in this release. [Add document]".

**Law column:**
- One card per entry in `FindingDetail.provisions`, in `citations` order.
- Badge `LAW · EU|FR` or `GUIDANCE · ESMA|AMF|CNIL`. Guidance cards get a dashed border and the caption "Guidance interprets the law; it is not binding."
- Verbatim text in serif (clamped to 8 lines, "Show full text"), plus "Official source ↗" from `source_url`, the source label and `retrieved_at`.

**Connectors:**
- An SVG overlay draws a Bézier from each evidence card's right edge to the verdict, and from each law card's left edge to the verdict. Hub and spoke: the data doesn't map evidence to provisions one-to-one, so no false pairwise links.
- Hovering or focusing a card thickens its connector and the matching highlight in the quote.
- Draw on mount: `pathLength 0→1`, 320 ms, staggered 40 ms. Recomputed on resize (ResizeObserver).
- No connectors below `lg`: the columns stack Evidence → Verdict → Law, separated by "checked against".

**Uncertain without evidence** (W6 live, F2): the verdict shows "Needs counsel: the AI couldn't produce a verifiable answer for this requirement." `validation_notes` are hidden here; they appear only in "How this was produced" under "Technical details" (critique: raw validator text). The evidence column says "No evidence was cited", not "expected when a requirement does not apply".

**Reviews:** "Reviewed by {reviewer_name} · {decision word} · '{comment}' · {time}". "Carried from v{x}" shows only when `carried_from_version !== current version` (critique 10).

**API:** `GET /api/findings/{id}` (finding, requirement, provisions, reviews) · `GET /api/releases/{id}` (artifact text and code for context) · `GET /api/runs/{run_id}/events?requirement_id=` (SSE, how produced).

**States:**
- Unknown finding: NotFound "This risk isn't part of v0.9.0" with [All risks].
- A provision fetch failed: the card reads "Citation {id} could not be loaded".

**Keyboard:** `[` / `]` previous/next risk; `D` open in document.

### 4.7 Documents `…/documents[/:artifactId]` (comments 3, 5)

Purpose: contract-review-tool reading of every compliance document, with all risks inline.

```
┌ Documents ────────┐ ┌ Business plan · compliance/business-plan.md ───────┐ ┌ Notes (4) ─────────────┐
│ ● Business plan  4│ │ FICTIONAL DEMO DOCUMENT …                          │ │                        │
│ ● Product guide  6│ │ # Wealthpilot SAS: Business Plan 2026–2028         │ │ ┌ W1 Violation·Blocker ┐│
│ ● Tech. arch.    2│ │ ## 1. Summary                                      │ │ │ Licensing            ││
│ Missing           │ │ ▇Wealthpilot gives French retail investors a perso-│─┤ │ Plan offers personal ││
│ ⦸ Privacy policy  │ │ nal investment adviser in their pocket…▇           │ │ │ advice while denying ││
│   cited by W3     │ │ …                                                  │ │ │ CIF status.          ││
│ ⦸ Terms           │ │ ## 4. Onboarding                                   │ │ │ MiFID II 4(1)(4) ·   ││
│ ⦸ CIF registration│ │ ▇We deliberately keep onboarding short…▇           │─┤ │ CMF L.541-1          ││
│                   │ │                                                    │ │ │ [Open check →]       ││
│ [+ Add or replace │ │                                                    │ │ │ [counsel actions]    ││
│    a document]    │ │                                                    │ │ └──────────────────────┘│
└───────────────────┘ └────────────────────────────────────────────────────┘ └────────────────────────┘
 minimap rail at the right edge of the doc: coloured ticks at each highlight's position, click to jump
```

**Document list:**
- Artifacts with `kind ≠ code_repo`, ordered business plan, terms, privacy policy, CIF registration, product spec, other. Each shows a highlight count and its worst-status dot.
- **Missing documents** = the union of `missing` evidence refs (each with the aliases that cite it), plus expected kinds not present (`EXPECTED_KINDS`). Each one has an [Add] button that opens Add document with the slot preset.

**Document body:**
- `MarkdownView` with `docHighlights(all findings, artifactId)` (the existing engine).
- Colour = status. Overlaps resolve to the more severe one (existing `moreSevere`).
- Highlight underline thickness: 2 px; active: a 30% fill.

**Margin notes:**
- One card per (finding × span) group, y-aligned to the first line of its highlight. A collision-avoiding stack with a min gap of 8 px.
- A thin leader line runs from the card to its highlight.
- Clicking a highlight focuses its note, and vice versa: scroll-into-view plus a single 600 ms pulse.
- `?f=<findingId>` focuses on load.
- Below `xl`, notes collapse into a bottom sheet that opens on highlight tap.

**Notes content:** alias, status chip, category, the first sentence of `reasoning_summary`, the short names of the cited acts, and [Open check →]. In counsel mode the `annotation.actions` slot adds the decision row (§4.10).

**Add or replace a document** (sheet):
1. **Slot:** Business plan / Terms / Privacy policy / CIF registration / Other. Each maps to the configured path `compliance/business-plan.md`, `terms.md`, `privacy-policy.md`, `cif-registration.md` or `compliance/<slug>.md`. A slot that already holds a document says "Replaces the current file".
2. **File:** drop a `.md` file, ≤ 1 MB. A preview shows its first heading.
3. **New version:** suggested as the next patch with `-docs.N` if taken (`0.9.1`). Validated with `VERSION_RE`.
4. **Copy:** "Creates v0.9.1 from v0.9.0's documents and code, with your file in place of the privacy policy. Then runs a new assessment."
5. Submit → `POST /api/releases/{id}/derive` (B4) → `POST /api/releases/{new}/assessments` → navigate to `/p/…/v/0.9.1/summary` (live state).
6. **Errors:**
   - 409 → "v0.9.1 already exists, pick another version";
   - 400 → the server's reason in plain words;
   - an assessment 409 → "A run is in progress on Wealthpilot; your release was created, start the run when it finishes".

**API:** `GET /api/releases/{id}` · findings · `POST /api/releases/{id}/derive` · `POST /api/releases/{id}/assessments`.

**Empty:** "This release has no documents. Add the business plan to start."

### 4.8 Code `…/code`

A file tree with the section "Files with findings (3)" first, then "All files read by the agent (63)", collapsed. `CodeView` (Shiki) with line bands and the same margin-note component. `?path=` and `?f=` drive focus.

**Honest empty state** (live v0.9.0, F2): "No code lines are cited in this release's findings. The agent could read these 63 files." The tree stays browsable.

**API:** the same as Documents.

### 4.9 Fix plan `…/fix-plan`

Keep the existing feature: `GET /api/assessments/{id}/fix-plan.md`, a Prose render, Copy as Claude Code prompt, Download.

**Changes:**
- Top summary "6 code changes · 4 founder actions · ordered blocker → medium".
- Each item links back to its compliance check.
- Founder actions that are documents get [Add document] (prefilled slot).
- **Zero items:** "Nothing to fix for launch on v1.0.0", no agent rules, no Copy (critique 11).
- Responsive width: `max-w-prose` with `overflow-x-auto` code blocks (fixes the 390 px overflow).

### 4.10 Counsel mode (comment 9)

**Frame:**
- `body[data-mode=counsel]` gives a 2 px teal top rule and a teal mode banner under the release header: "⚖ Counsel review · v0.9.0 · Reviewed 1/10 · 2 need you · [Open queue] · Exit (Esc)".
- The Mode switch in the top bar is a two-option segmented control with a gavel icon. It persists in `localStorage` and is mirrored to the URL `?mode=counsel` so a shared link opens in review.
- Founder mode never shows decision UI.

**Review queue `…/review[/:findingId]`:**

```
┌ Queue  1/10 ▓░░░░ ────────┐ ┌ (Compliance check of the selected finding, §4.6 layout) ────────────┐
│ NEEDS YOU                 │ │                                                                       │
│ ▸ W6 Needs counsel  High  │ │                                                                       │
│   W1 Violation  Blocker   │ │                                                                       │
│   W2 Violation  Blocker   │ │                                                                       │
│   W3 Missing ev. High     │ ├ Decision ─────────────────────────────────────────────────────────────┤
│ … REVIEWED                │ │ AI: Needs counsel ·  [C Confirm] [O Override ▾] [N Not applicable]    │
│ ✓ W8 Not applicable       │ │                      [E Need evidence]                                 │
│   (carried / by Roman)    │ │ Note (required) [_____________________________]  Reviewer [Roman  ]   │
└───────────────────────────┘ │ Gate impact: Not ready → Not ready (W1, W2, W3 still block) ·         │
                              │ counsel-reviewed 1 → 2/10                    [⌘↵ Record decision]     │
                              └───────────────────────────────────────────────────────────────────────┘
```

**Queue:**
- Order: unreviewed first; within that, uncertain, then blocker, high, medium, low; then missing evidence; reviewed last.
- Progress `reviewed/total` comes from `readiness.counsel_reviewed`.

**Keyboard:**
- `J/K` next/previous; `C/O/N/E` choose a decision; `O` opens the override conclusion picker (arrow keys);
- `/` focuses the note; `⌘↵` records; `U` revokes (with an inline "Revoke? ⌘↵ to confirm" step, since `confirm()` isn't used); `Esc` exits the mode.
- A `?` overlay lists the keys.

**Gate-impact preview:**
- `features/review/gatePreview.ts` is a pure TS port of SPEC §6.3 `gate()` over effective conclusions, with the candidate decision applied through the existing `effectiveFor`.
- It shows before → after for the gate and the counsel-reviewed count, and names the requirement aliases that still block.
- A vitest parity test runs it against the three fixtures' `readiness.gate` values.

**Inline actions elsewhere:** the `check.actions` slot (compliance check) and the `annotation.actions` slot (document and code notes) render a compact decision row. The copy says "Applies to W1 (all 3 evidence spans)" (F5).

**After record:** `POST /api/findings/{id}/reviews`, then invalidate `readiness`, `findings` and `finding`. The queue advances to the next unreviewed finding, and the progress bar animates.

**API:** `GET /api/releases/{id}/readiness` · findings · `GET /api/findings/{id}` · `POST /api/findings/{id}/reviews` · `POST /api/reviews/{id}/revoke`.

**States:**
- All reviewed: "All 10 findings have a counsel decision. Gate: Ready."
- Save error: an inline alert, and the decision is kept.

### 4.11 Activity `…/activity` and the run strip

**Run selection:** `?run=` or the assessment's `run_id`. Header from `GET /api/runs/{id}`.

**Labels (critique 4):**
- `status === "running"` → **"● Live"** (pulsing dot) and an elapsed timer. The only place the word Live appears.
- `ok` → **"Recorded run · 4 Oct 14:01 · 46 s"** with [▶ Replay ×1 / ×4]. Replay uses `?replay=true&speed=`, and the badge reads **"Replay of recorded run · 4 Oct 14:01"** while it plays.
- `failed` → "Run failed · {plain reason}".

**Body:** the existing Timeline (steps, tool calls, retries, findings), grouped by requirement alias. Retries show the plain sentence "The answer failed validation and was retried". Raw validator errors sit under "Technical details". The header "Latest run codestral-latest" becomes "Model: codestral-latest" in the details row only.

**Run strip** (all release tabs, shown while a run on this release is `running`): "● Live · {requirements done}/{total} · {mm:ss} · Watch the agent →". It's driven by the same SSE (`useRunStream`), and on each `finding` event it invalidates `findings` and `readiness`. When the run ends it collapses into a toast: "Assessment finished · Not ready · 46 s".

**API:** `GET /api/runs?release_id=` · `GET /api/runs/{id}` · SSE `GET /api/runs/{id}/events?after_seq=&replay=&speed=`.

### 4.12 Start demo, reset, fallback (comment 8)

- **Home:** the `DemoStartSheet`, shown only if `GET /api/demo → enabled`. It shows the snapshot provenance: "Recorded snapshot captured 4 Oct 15:20 · model codestral-latest · eval: matches expected for all 10 requirements" and "Live target: FinTechProto tag v0.9.0 @ 7bf6004".
- **Start:** `POST /api/demo/start` (202) → `{release, assessment_id, run_id, provenance}` → navigate to `…/v/0.9.0/summary`, which is live.
- **Reset:** a link in the demo sheet and on the product home in demo mode: "Reset demo to the recorded snapshot". It shows inline confirmation text ("This replaces all Wealthpilot releases and reviews with the snapshot."), calls `POST /api/demo/reset`, then navigates to the product home.
- **Fallback:** on `run_end` with `error`, or `GET /runs` → `failed`, the Summary shows a Banner with [Show the recorded run], which calls reset → v0.9.0 Summary (Recorded).
- **Fixtures mode:** `demo.start` returns the recorded run, labelled "Simulated (sample data)", never "Live".

### 4.13 Profile `/p/:productId/profile`

The existing form, moved. Stage is a select inside the profile. Operating and Scaling are disabled with "coming soon". After Confirm, the Summary's "unconfirmed" warning disappears. **API:** `GET /api/product`, `PUT /api/product/profile`.

## 5. Visual system

**Keep:**
- All tokens in `globals.css` (status triplets fg/bg/bd, the indigo accent `#4f46e5` / `#818cf8`, surfaces, durations `120/200/320`, ease `cubic-bezier(.2,.7,.2,1)`).
- Geist and Geist Mono.

**Change or add:**

| Token / rule | Value | Why |
|---|---|---|
| Dark mode trigger | `@media (prefers-color-scheme: dark)` on `:root:not([data-theme=light])`, plus the existing `[data-theme=dark]`; a theme toggle (System/Light/Dark) in the top bar | Today dark only works via the attribute |
| `--counsel-fg/bg/bd` | light `#0f766e / #e6f5f3 / #b5e0da`; dark `#2dd4bf / #0d2421 / #1a4a43` | The counsel frame needs a hue no status uses |
| `--law-font` | `"Source Serif 4", Georgia, serif` (Google Fonts, 400/600) | Law text in serif vs company text in sans: the "vivid comparison" in one glance |
| Type scale | 12 / 13 / 14 (body) / 16 / 20 / 28 / 40 (gate word only), tracking −0.01em ≥ 20 px | Denser, calmer hierarchy |
| Status words | §4.5 table; the chip renders `Status · Severity` | Splits two axes (critique 9) |
| Category | **No hue.** lucide icons: Licensing `BadgeCheck`, Suitability `UserRoundCheck`, Data protection `ShieldHalf`, AI transparency `Sparkles`, other `Scale`. Neutral `text-2` label | Status owns colour, so margins stay legible. Deliberate deviation |
| Highlight | 2 px underline in `--{status}-fg`, 14% fill; active 30% fill + 1.5 px outline (existing `markStyle`) | Kept |
| Radius / elevation | 6 px cards, 4 px chips; borders over shadows; `shadow-overlay` only for popovers and sheets | Linear-like calm |
| Density | 32 px rows in lists, 8 px grid, 24 px page gutters (16 px at < 640 px) | — |

**Motion** (framer-motion, all behind `useReducedMotion`; motion explains a relation or a change of state, never decorates):
1. **Connectors** (evidence → verdict ← law): draw in 320 ms on mount; thicken in 120 ms on hover/focus.
2. **Highlight ↔ note linking:** smooth scroll plus one 600 ms pulse of the target. No looping.
3. **Live run:** risk rows enter with `y:4 → 0, opacity` in 160 ms. Counters tick with `AnimatedNumber`. The gate value cross-fades **once** at `run_end`. The Live dot pulses, the only infinite animation, and only while live.
4. **Tabs:** the underline uses `layoutId` (200 ms). Content cross-fades in 120 ms. No slide-in pages.
5. **Version switch:** the breadcrumb popover → the release header cross-fades (200 ms); gate chips morph colour.
6. **Queue advance:** the selected row slides (`layout`); the progress bar animates width.

Forbidden: parallax, bouncing, staggered page-load cascades longer than 240 ms in total, auto-playing replays.

## 6. Backend additions (additive only)

All of these are additive: new optional fields, a new kwarg, new routes. No existing route changes behaviour. Contracts are regenerated with `make types`.

| # | Signature | Behaviour | Files | Tests |
|---|---|---|---|---|
| **B1** | `ProductOut.organization: Organization \| None = None` on `GET /api/product` | Fills it from `OrganizationRow` ("Wealthpilot SAS") | `contracts/api.py`, `api/product.py` | `tests/test_demo.py::test_product_has_organization` |
| **B2** | `CiResult.artifacts: list[Artifact] = []` | `_build_result` fills it from `deps.release_artifacts`. `POST /releases/import` and `cco import` (`import_result_bytes`) insert `ArtifactRow`s when present. Older results still import. | `contracts/ci.py`, `cli/ci.py`, `api/releases_write.py` | `tests/test_ci.py::test_import_carries_artifacts`, plus the existing `test_ci.py` green |
| **B3** | `ingest_bundle(..., previous_release_id: str \| None \| _Unset = UNSET)` | When given (including `None`), it's used as-is instead of "latest created" | `ingest/__init__.py` | `tests/test_derive.py::test_previous_is_base` |
| **B4** | `POST /api/releases/{release_id}/derive`, multipart: `version: str` (Form), `documents: list[UploadFile]` (File; filename = target basename, e.g. `privacy-policy.md`) → **201 `ReleaseOut`** | 404 if the base is unknown. 400 if any file isn't `.md`, is > 1 MB, has a path separator or `..`, or isn't UTF-8. 409 if the version exists. Materialises the base into a temp dir: each document artifact's `text` at its `path`, and each `code_repo.files[*]` at its path. Overlays `compliance/<basename>`. Calls `ingest_bundle(s, tmpdir, version, source="ui", previous_release_id=base.id, branch=base.branch)` with `git_sha=None` (the content no longer matches a commit). Re-indexing happens inside ingest (T24 hook). Does **not** start a run; the UI calls `POST /assessments`. | new `api/derive.py`, `main.py` (router) | `tests/test_derive.py`: replace and add; base-is-previous; code carried over byte-equal; 400/404/409 cases; the derived release assesses with the scripted model |
| **B5** | `GET /api/demo` → `{enabled: bool, snapshot?: Manifest}` · `POST /api/demo/reset` → 200 `{releases: [version], captured_at}` · `POST /api/demo/start` → 202 `{release: Release, assessment_id, run_id, provenance: {repo, ref, commit}}` | Gated by `CCO_DEMO=1`: POSTs return 404 when off, and GET returns `{enabled:false}`. **reset**: in one transaction, delete the product's agent_events, reviews, findings, assessments, artifacts and releases; `ensure_base`; import every snapshot result via `import_result_bytes` (with B2 artifacts); delete `bundle_root` dirs of removed releases. **start**: 409 if a run is in flight; reset minus the manifest's `live_target` (0.9.0); `ingest_bundle(demo/wealthpilot/v0.9.0/upload, "0.9.0", source="ui", git_sha=<provenance.commit>, branch=<provenance.ref>, previous_release_id=None)`; `pipeline.prepare_run`, then `execute_run` in the background. Same rules as `POST /assessments`. | new `cco/demo/__init__.py` (`load_manifest`, `restore`, `start`, `capture`), new `cco/demo/__main__.py` (typer: `capture`, `reset`, `start`), new `api/demo.py`, `main.py` | `tests/test_demo.py`: gated 404; reset is idempotent and leaves exactly the snapshot (counts, gates); start ingests with the real commit, creates a run and rejects a second start with 409; uses a 2-release test snapshot under `tests/data/snapshot/` and the scripted `FunctionModel` |
| **B6** | `python -m cco.demo capture --runs 3 --out demo/snapshot` (CLI only, needs `MISTRAL_API_KEY`) | For each of v0.9.0, rc and v1.0.0: `run_audit(bundle, version, sha=PROVENANCE.commit, baseline=chain)`. The v0.9.0 → rc → 1.0.0 baseline chain applies `demo/snapshot/counsel-reviews.json` (W8 decision by Roman, human-authored) after v0.9.0, so it carries. Accept a run only if `eval.harness.compare()` shows no diffs **and** every blocker or high finding has ≥ 1 non-missing evidence ref with no `validation_notes`. Retry up to `--runs`. Writes `<version>.result.json` (with artifacts) and `manifest.json` `{captured_at, model, pack_version, ccommit_commit, live_target:"0.9.0", releases:[{version, file, repo, ref, commit, gate, seconds, eval:"match"}]}` | `cco/demo/*` | `tests/test_demo.py::test_capture_rejects_mismatch` (scripted model producing a wrong conclusion → nothing written) |
| **B7** | `scripts/demo_bundles.sh` also writes `upload/PROVENANCE.json` `{repo:"RomanGrebnev/FinTechProto", ref, commit}` per bundle | It's the source of the commit shown in the UI | `scripts/demo_bundles.sh`, `demo/wealthpilot/*/upload/PROVENANCE.json` | `test_demo.py::test_provenance_matches_tag` (skips if FinTechProto isn't checked out) |

**Snapshot lifecycle, concretely.**
- **Captured** by `make demo-capture` (= B6) on a dev machine with the Mistral key, after `make demo-bundles`.
- **Stored** in git under `demo/snapshot/` (about 0.5–1 MB of JSON: result + events + artifacts per release).
- **Restored** by `make demo-reset` (now `python -m cco.demo reset`, offline, no model) or `POST /api/demo/reset`.
- **Re-captured** whenever the pack or the prompts change. The manifest records the `ccommit_commit`, so drift is visible.
- **`make seed`** stays the fixtures path for tests. `make seed` in dev also scrubs the fake `ci_run_url`s: `seed.py` loads CI fixture releases with `ci_run_url=None`, so no fabricated link can render even off-snapshot. That one-line change belongs to T26 and is checked by `test_api_basic.py::test_seed_has_no_fake_ci_links`.

## 7. Task split (parallel, Opus agents)

**Waves:**
- **W1:** T26 ∥ T27.
- **W2:** T28 ∥ T29 ∥ T30 ∥ T31 ∥ T32 ∥ T33 (T33 needs T26 only).
- **W3:** T34.

Owns are disjoint inside a wave. Placeholder page stubs created by T27 transfer to the owning W2 task at merge.

**Cross-task seams (frozen by T27):**
- `lib/routes.ts` (path builders), `lib/status.ts` (vocabulary), `lib/categories.ts`, `lib/provenance.ts`, `lib/queries.ts` (hooks incl. `useReleaseByVersion`, `useRunSummary`, `useDemo`).
- `api/client.ts` (all existing and new endpoints with fixture fallbacks; the types for B1–B5 are hand-declared in `api/extra.ts` until T26's regen lands, then re-exported).
- Slots: `check.actions`, `annotation.actions`, `release.banner`, `release.runStrip`, `home.demo`, `summary.liveOverlay`.
- Components: `GateChip`, `StatusChip` v2, `SeverityTag`, `CategoryIcon`, `LawBadge`, `Banner`, `EmptyState`, `NotFound`, `Kbd`, `Sheet`, `ProvenanceLine`, `ValueLine`.

| id | title | goal | owns (globs) | deps | verify (< 2 min) | definition of done (each item names its check) |
|---|---|---|---|---|---|---|
| **T26** | Backend: demo snapshot, derive, additive contracts | B1–B7 | `backend/cco/demo/**`, `backend/cco/api/demo.py`, `backend/cco/api/derive.py`, `backend/cco/api/product.py`, `backend/cco/api/releases_write.py`, `backend/cco/main.py`, `backend/cco/contracts/api.py`, `backend/cco/contracts/ci.py`, `backend/cco/cli/ci.py`, `backend/cco/ingest/__init__.py`, `backend/cco/seed.py`, `backend/tests/test_demo.py`, `backend/tests/test_derive.py`, `backend/tests/data/snapshot/**`, `backend/tests/test_ci.py`, `backend/tests/test_api_basic.py`, `scripts/demo_bundles.sh`, `demo/wealthpilot/*/upload/PROVENANCE.json`, `Makefile`, `contracts/openapi.json`, `frontend/src/api/types.ts` | — | `cd backend && uv run pytest tests/test_demo.py tests/test_derive.py tests/test_ci.py tests/test_api_basic.py tests/test_ingest.py -q && cd .. && make contracts-check` | (1) `test_demo.py` gating/reset/start/capture-reject pass; (2) `test_derive.py` replace/add/400/404/409/previous pass; (3) `test_ci.py::test_import_carries_artifacts` passes and the existing `test_ci.py` stays green; (4) `test_api_basic.py::test_seed_has_no_fake_ci_links` and `::test_product_has_organization` pass; (5) `make contracts-check` has no diff after `make types`; (6) the full `make test` stays green |
| **T27** | Frontend foundation: IA, shell, primitives, client, tokens | Routes of §2 with legacy redirects; top bar + breadcrumb + version popover + Mode switch + theme toggle; release header + tabs (mobile segmented); slots; lib seams; tokens of §5; client + fixture fallbacks for B1–B5; Sample-data banner; NotFound/401 handling; Playwright fixtures server on :20011 | `frontend/src/app/**`, `frontend/src/lib/**`, `frontend/src/components/**`, `frontend/src/api/client.ts`, `frontend/src/api/extra.ts`, `frontend/src/styles/**`, `frontend/tailwind.config.ts`, `frontend/index.html`, `frontend/playwright.config.ts`, `frontend/e2e/shell.spec.ts`, `docs/design.md`, `frontend/src/features/*/page.tsx` (stubs only) | — | `pnpm -C frontend exec tsc -b && pnpm -C frontend exec vitest run src/lib src/components && pnpm -C frontend exec playwright test shell.spec.ts` | (1) `shell.spec.ts`: `/` shows the org + product card; the breadcrumb navigates org → product → v0.9.0; every legacy route redirects (`/r/rel-0.9.0/findings` → `/p/wealthpilot/v/0.9.0/risks`); an unknown version shows NotFound; at 390 px the tabs scroll and the breadcrumb collapses; (2) `src/lib/status.test.ts` maps all 5 conclusions × 4 severities to §4.5 words; (3) `src/lib/provenance.test.ts`: CI-with-URL links, CI-without-URL → "Recorded audit (CLI)", fixtures → no links; (4) the dark theme follows `prefers-color-scheme` (`shell.spec.ts` with `colorScheme:'dark'`); (5) `playwright.config.ts` serves fixtures on :20011 and `reuseExistingServer:false` |
| **T28** | Workspace home, Product home, Summary | §4.1, §4.2, §4.4, §4.13: value hero, semver timeline with honest provenance, Connect CI (real workflow), profile card + unconfirmed warning, Summary gate from `gate_label`, block count from `blockers`, "What was checked", category cards, next step, What-changed picker | `frontend/src/features/workspace/**`, `frontend/src/features/product/**`, `frontend/src/features/summary/**`, `frontend/src/features/releases/**`, `frontend/src/features/profile/**`, `frontend/src/features/overview/**` (delete), `contracts/ci/compliance.yml`, `frontend/e2e/golden-path.spec.ts`, `frontend/e2e/releases.spec.ts`, `frontend/e2e/product.spec.ts` | T27 | `pnpm -C frontend exec vitest run src/features/summary src/features/product && pnpm -C frontend exec playwright test golden-path.spec.ts releases.spec.ts product.spec.ts` | (1) `golden-path.spec.ts` (rewritten): `/` → Wealthpilot → v0.9.0 Summary shows "Not ready", "3 risks block launch" with breakdown 2 + 1, the AI label, "Counsel-reviewed 1/10", 4 category cards, W1 → check; (2) v1.0.0 Summary shows "Ready", not "Ready (AI)" (`golden-path.spec.ts`); (3) `src/features/summary/checked.test.ts`: document/code/provision/act counts and duration from fixture data; (4) `releases.spec.ts` (rewritten; fix-plan test removed → T32): timeline semver order, provenance text, no `href` containing `11000000` in fixtures, New release and Import dialogs work; (5) `product.spec.ts`: Connect CI shows the YAML and a Copy that works; profile unconfirmed → the Summary warning appears and goes after confirm; (6) `what-changed.test.ts`: the baseline picker diff of v0.9.0 → v1.0.0 = W1–W7 resolved |
| **T29** | Risks and Compliance check | §4.5, §4.6: grouped list, filters, plain vocabulary; the three-column evidence ↔ verdict ↔ law view with connectors, clause context, serif law, guidance badge, How produced (collapsible, technical details), not-found | `frontend/src/features/risks/**`, `frontend/src/features/check/**`, `frontend/src/features/legal/**`, `frontend/src/features/finding/**` (delete after migration), `frontend/src/features/findings/**` (delete), `frontend/e2e/finding.spec.ts` (rewritten → `check.spec.ts`; the evidence-room test is dropped) | T27 | `pnpm -C frontend exec vitest run src/features/check src/features/risks && pnpm -C frontend exec playwright test check.spec.ts` | (1) `check.spec.ts`: W1 shows ≥ 1 document clause card, a code card (fixtures), 3 law cards with "Official source" links and a LAW/GUIDANCE badge, and connectors (`[data-connector]` count = evidence + provisions); (2) W3 shows "Missing: Privacy policy" with [Add document] linking to Documents with the slot preset; (3) W6-like uncertain-without-evidence shows "Needs counsel…" and no validator text outside Technical details (`check.spec.ts` asserts that `validation failed` isn't visible by default); (4) `carried.test.ts`: the carried label is hidden when `carried_from_version` equals the current version; (5) `risks.test.tsx`: grouping by domain + filter counts; (6) an unknown finding shows NotFound (`check.spec.ts`); (7) at 390 px the columns stack (`check.spec.ts` mobile project) |
| **T30** | Documents, Code, Add/replace document | §4.7, §4.8: doc list with missing docs; all highlights; aligned margin notes with leader lines, minimap, `?f=` focus; code tree + bands + notes; Add-document sheet → derive → run → live Summary | `frontend/src/features/documents/**`, `frontend/src/features/code/**`, `frontend/src/features/viewer/**`, `frontend/src/features/add-document/**`, `frontend/src/features/evidence/**` (delete), `frontend/e2e/documents.spec.ts`, `frontend/e2e/add-document.spec.ts` | T27 | `pnpm -C frontend exec vitest run src/features/viewer src/features/documents && pnpm -C frontend exec playwright test documents.spec.ts add-document.spec.ts` | (1) `documents.spec.ts`: the business plan of v0.9.0 shows highlights for all findings citing it (`mark[data-finding-id]` count = spans from the fixture); clicking a mark focuses its note and vice versa; `?f=W1` scrolls to it; missing Privacy policy / Terms / CIF registration are listed with citing aliases; (2) `viewer.test.tsx` (extended): the note layout has no overlaps and stays y-ordered; (3) `documents.spec.ts`: the Code tab lists "Files with findings" first; the empty-cited state copy shows when there are no code refs; (4) `add-document.spec.ts` (fixtures): picking slot Privacy policy + a .md file + version 0.9.1 calls derive, then assessments, and lands on `/v/0.9.1/summary`; 409 shows the version message; (5) highlights work in dark mode (`documents.spec.ts` dark project screenshot assertion on mark colour var) |
| **T31** | Counsel mode | §4.10: frame and banner, Mode switch semantics + `?mode=`, review queue route, decision bar, keyboard flow, gate-impact preview, slot contributions `check.actions` / `annotation.actions` / `release.banner` | `frontend/src/features/review/**`, `frontend/src/features/persona/**` (→ mode), `frontend/e2e/counsel.spec.ts` | T27 | `pnpm -C frontend exec vitest run src/features/review && pnpm -C frontend exec playwright test counsel.spec.ts` | (1) `gatePreview.test.ts`: the port reproduces `readiness.gate` for all 3 fixtures, and W8 → not_applicable on v0.9.0 keeps NOT_READY with blockers W1, W2, W3; (2) `counsel.spec.ts`: switching to Counsel shows the teal banner "Reviewed 1/10"; the queue lists unreviewed first; `J`, `N`, typing a note and `⌘Enter` records, the progress becomes 2/10 and the selection advances; (3) founder mode shows no decision controls on check or documents (`counsel.spec.ts`); (4) the inline note action in Documents records a review on the owning finding with the copy "Applies to W1" (`counsel.spec.ts`); (5) `?mode=counsel` deep link opens in counsel; `Esc` exits (`counsel.spec.ts`) |
| **T32** | Live run, Activity, Start demo UI, Fix plan polish | §4.9, §4.11, §4.12: run strip + live Summary invalidation, Live vs Recorded vs Replay labels, Activity tab, Start demo sheet / reset / fallback, Fix plan zero state and links | `frontend/src/features/activity/**`, `frontend/src/features/demo/**`, `frontend/src/features/fixplan/**`, `frontend/e2e/activity.spec.ts` (rewritten), `frontend/e2e/fixplan.spec.ts` | T27 | `pnpm -C frontend exec vitest run src/features/activity src/features/fixplan && pnpm -C frontend exec playwright test activity.spec.ts fixplan.spec.ts` | (1) `activity.test.tsx` (extended): the label is "Live" only for `status:"running"`, "Recorded run · <time> · <s>" for ok, and "Replay of recorded run" while replaying; (2) `activity.spec.ts`: the recorded v0.9.0 run never shows "Live"; the ×4 replay streams events; the persona part is removed (moved to T31); (3) `activity.spec.ts`: a simulated in-flight run (fixtures stream) shows the run strip on Summary, and the rows grow as `finding` events arrive; (4) `fixplan.spec.ts`: the v0.9.0 plan shows "6 code changes · 4 founder actions" with items linked to checks; v1.0.0 shows "Nothing to fix for launch" with no Copy; no horizontal overflow at 390 px; (5) `demo.test.tsx`: the Start button is hidden when `enabled:false`; the fallback banner appears on a failed run and calls reset |
| **T33** | Capture the golden snapshot (live) | Run B6 against the real model; commit `demo/snapshot/**` + `counsel-reviews.json`; log the evidence | `demo/snapshot/**`, `docs/specs/2026-10-04-cco-mvp/evidence/T33.md` | T26 | `cd backend && uv run python -m cco.demo capture --runs 3 --out ../demo/snapshot && CCO_DATABASE_URL=sqlite:///$(mktemp -d)/t.db uv run python -m cco.demo reset --check` | (1) `manifest.json` lists 0.9.0 / rc / 1.0.0 with real commits equal to `git -C FinTechProto rev-parse <ref>` (checked by `test_demo.py::test_provenance_matches_tag`); (2) `cco.demo reset --check` prints gates NOT_READY / NOT_READY / READY and "counsel-reviewed 1/10" on 1.0.0; (3) v0.9.0 W1 and W2 each have ≥ 1 evidence ref with no validation notes (enforced by capture); (4) `evidence/T33.md` records the capture command, the model, the run times and attempts |
| **T34** | Demo path E2E (live stack) + docs | A Playwright spec against the live stack with `CCO_DEMO=1`: home → Start demo → live Summary → W1 check → Documents → Fix plan → v1.0.0 Ready → counsel W8 → Reset; plus the run docs | `frontend/e2e/demo-path.spec.ts`, `frontend/playwright.live.config.ts`, `docs/run.md` (demo section), `docs/specs/2026-10-04-cco-mvp/evidence/T34.md` | T26, T28–T33 | `pnpm -C frontend exec playwright test -c playwright.live.config.ts demo-path.spec.ts` (the live model run is about 60 s; timeout 150 s) | (1) `demo-path.spec.ts` passes on the live stack: "Live" appears during the run and "Recorded" after reset, the Summary shows 4 category cards, W1 shows a law card with an official link, Documents show ≥ 3 highlights in the business plan, v1.0.0 shows "Ready"; (2) the same spec with `MISTRAL_API_KEY` unset hits the fallback banner, and "Show the recorded run" lands on the Recorded v0.9.0 Summary; (3) no console errors other than the expected first-load 401 (now none); (4) `docs/run.md` documents `CCO_DEMO=1`, `make demo-capture` and `make demo-reset`; (5) the full fixtures suite `pnpm -C frontend exec playwright test` stays green |

**Existing e2e specs:**
- `golden-path.spec.ts` → rewritten by **T28**.
- `releases.spec.ts` → rewritten by **T28** (its fix-plan test moves to `fixplan.spec.ts`, **T32**).
- `finding.spec.ts` → replaced by `check.spec.ts`, **T29** (its evidence-room test is superseded by `documents.spec.ts`, **T30**).
- `activity.spec.ts` → rewritten by **T32** (its persona assertion moves to `counsel.spec.ts`, **T31**).

**Critique coverage:**

| Critique item | Task |
|---|---|
| Global Run with no release (1) | T27 (release header) |
| v0.9.0 without code (2) | T33 capture rule + T30 honest empty state |
| Gate label (3) | T28 |
| Live vs replay (4) | T32 |
| Counsel entry (5) | T31 |
| What-changed baseline (6) | T28 |
| Blocker counts (7) | T28 |
| Profile hidden (8) | T28 |
| Status vocabulary (9) | T27 + T29 |
| Carried-from on origin (10) | T29 |
| Dead ends and raw text (11) | T27 NotFound, T29, T32 |
| Mobile nav (12) | T27 |
| Fake CI links (opus) | T26 seed scrub + T27 provenance + T28 |
| Weak live run as default (opus) | T26/T33 snapshot |
| 401 on first load (opus) | T27 |

## 8. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| The live model cites only documents (F2) or misses expected conclusions, so capture can't produce a clean snapshot | Medium / high | Capture retries `--runs`. T25 already fixed the 1.0.0 false positives. If W1/W2 never cite code, the story stands on documents (Documents is the main surface by design), and the capture rule relaxes to "≥ 1 non-missing ref". This is decided at T33 and logged. |
| A live run on stage is slow or rate-limited (model queue, 429) | Medium / medium | The fallback banner goes to the recorded run in one click. The run strip shows progress, so a 60 s wait reads as work. Start is disabled while a run is in flight (409). |
| The connector overlay misaligns on resize, font load or scroll | Medium / low | ResizeObserver plus `document.fonts.ready` recompute. Connectors are decorative-plus: hidden below `lg`, and the cards carry `aria-describedby` to the verdict, so meaning never depends on them. |
| The margin-note layout gets dense on PRODUCT_GUIDE (6+ spans, overlaps) | Medium / medium | A collision stack, with notes grouped per finding when spans fall within 48 px. The minimap gives jump access. Unit test in T30. |
| T27 seams freeze too early; W2 tasks need a lib change | Medium / medium | Slots and `api/extra.ts` give extension points. A W2 task needing a lib change files it as a follow-up; it doesn't edit `lib/**` (owned by T27, already merged). The orchestrator can run a tiny serial fix between waves. |
| Hand-declared types in `api/extra.ts` drift from T26's regenerated `types.ts` | Low / medium | §6 fixes the shapes exactly. T34 runs `tsc -b` after both merge, and `extra.ts` re-exports from `types.ts` once present. |
| Reset deletes reviews counsel recorded during the demo | Expected / low | That's what reset means. The confirmation copy states it. Before reset, `cco export-baseline` stays available. |
| Derive from a seeded or CI release whose code artifact holds only the globbed files | Low / low | The assessment only reads globbed files and documents, so the derived release is equivalent for assessment. The release row says "derived from vX" and carries no `git_sha`. |
| `GET /releases` returns all artifacts with full code for every release (payload ~1–2 MB) | Low / low | Acceptable for V1 with ≤ 5 releases. If needed later: a `?light=1` param, out of scope now. |
| Requirements read from the bundled fixture drift from the DB pack | Low / medium | The same file seeds the DB; `make contracts-check` validates it. Documented in T27. |
| Playwright fixture runs hit the live app (F9) | Certain today / medium | T27 moves them to :20011 with `reuseExistingServer:false`. |
