# Critique 01 — spec

- Date: 2026-10-04
- Target: `SPEC.md` @ `29502d2` (plus the uncommitted seed-corpus edit in §6.5)
- Critics: three independent agents with fresh context, one lens each: correctness and feasibility · simplicity · risk and operability. Each also did the alignment check.
- Raw verdicts: correctness ACCEPT_WITH_CHANGES (2B/6M/2m) · simplicity ACCEPT_WITH_CHANGES (2B/6M/2m) · risk ACCEPT_WITH_CHANGES (2B/6M/2m). Merged and deduplicated below.

## Verdict

**ACCEPT_WITH_CHANGES.** The product shape and the §1 problem hold. But the headline demo outcome (v1.0.0 READY) is unreachable under the spec's own gate rule. The ~25-requirement pack is mostly unspecified. A public deployment with no auth would let anyone flip the CI gate. And the surface area is larger than a hackathon can build.

## Findings

Every blocker and major was checked against the evidence by the orchestrator (✓ = evidence holds).

### Blockers

- **[B1] v1.0.0 can never be READY: W8 stays uncertain and reviews don't carry forward.** ✓
  - Evidence: §6.3 (any unreviewed `uncertain` → REVIEW_REQUIRED). W8 in §6.9 is "uncertain … carried forward", but findings are per assessment (D3), so every new run (CI rc, tag, AC4 eval) creates a fresh unreviewed W8. This contradicts AC4, AC13 and remediation-plan.md "A4 decided by counsel". *(correctness, risk)*
  - Change: add **review carry-forward**. A counsel decision applies to later assessments of the same product and `requirement_id` while the evidence fingerprint (hash of cited paths and quotes) is unchanged, and the UI shows it as "carried from vX". Uncertain caused by a validation failure behaves the same way. Add a carry-forward case to AC6, and restate AC4/AC13 as READY given the carried decision.
- **[B2] About 17 of ~25 pack requirements have no expected outcome, so the counts and v1.0.0 READY are uncontrolled.** ✓
  - Evidence: §6.5 says ~25, §6.9 defines only W1–W8, and §6.3 makes any mandatory `insufficient_evidence` NOT_READY. The PR example says "27 requirements". On small models each untested requirement is a chance to break the green moment, and each one also needs legal review and adds quota. *(correctness, simplicity)*
  - Change: **cut the pack to about 10 requirements** (W1–W8 plus 2 controls that come out satisfied or not applicable), with `expected.yaml` giving the expected conclusion of **every** requirement for both releases. AC4 compares all of them. Grow the pack only after AC4 passes.
- **[B3] A public deployment with no auth lets anyone flip the gate, read server files, make the server fetch internal URLs, or burn the quota.** ✓
  - Evidence: §6.8 says "CI token is the only real auth". D8 is a persona toggle with no auth. Q3 deploys publicly. `POST /findings/{id}/reviews` changes the effective gate (§6.3). `repo_path` ingestion (§6.6) can read arbitrary files, and the URL fetch can reach internal addresses (SSRF). *(risk)*
  - Change: add **one deploy-wide access token** on every `/api` route except `/ci` (which keeps its per-product token) and `/mcp` (its own token). Keep "no RBAC". Drop `repo_path` from the public API (seed-only). Add an SSRF guard on the URL fetch, or drop the URL fetch (see M5). Allow one in-flight assessment per product.
- **[B4] The midpoint gate tests the UI, not the risky part.** ✓
  - Evidence: §12 W1 midpoint = AC2 on fixtures. The evaluator arrives in W2, the live golden eval in W3, and CI in W4. §10 names small-model misses as the top risk. *(simplicity)*
  - Change: add a **W1 spike**, a CLI that runs the evaluator on W1–W3 against FinTechProto v0.9.0. The midpoint becomes AC2 on fixtures plus at least 2 of 3 golden findings found live. Settle Q3 by W1, and stub `cco_check.py` against the fixture API in W1.

### Majors

- **[M1] The v0.9.0/v1.0.0 identity and branch model contradict each other.** ✓
  - Evidence: D12 says `release/v1.0.0`, while §6.9, §6.12 and remediation-plan.md:14 say `dev`. v0.9.0 is said to be `main@ae1c4e5`, yet docs must be committed first, which changes the SHA. Tags, the release PR merge and the main commit in FinTechProto are base-branch actions that agents may not do (README). *(all three)*
  - Change:
    - Set D12 to `dev`.
    - v0.9.0 = ae1c4e5 plus one docs-only commit (`git diff ae1c4e5 v0.9.0 -- backend frontend` is empty), so the line refs hold. Pin `expected.yaml` and AC12 to the tag.
    - Add **human gate tasks**: main docs commit, `v0.9.0` tag, release-PR merge, `v1.0.0` tag, and branch protection with `compliance` as a required check.
- **[M2] The golden fix plan contradicts the FinTechProto code.** ✓
  - Evidence:
    - `models.py:20-25`: `User` cascades only to profile and holdings, while `Recommendation` (`models.py:57-64`) has a bare FK, so item 4's "cascading to … recommendations" is false and `models.py` isn't in its boundaries.
    - There are no test files in the repo, yet the boundaries cite "onboarding tests".
    - There's no `version` file, which §6.12 reads. *(correctness)*
  - Change:
    - Fix item 4: add `models.py:57-64` to its locations and boundaries, and delete the user's recommendations explicitly.
    - Add a FinTechProto prep task: pytest scaffold and a `version` file.
    - Re-check every location at the `v0.9.0` tag.
- **[M3] Fix-plan generation can't produce the golden plan from the model as specified.** ✓
  - Evidence: W1 splits into code item 2 plus appendix A1/A3 with "Depends on A1". Boundaries and `done_when` aren't derivable from finding locations. A per-item LLM call makes "same Markdown" (AC12) non-deterministic. *(correctness, simplicity)*
  - Change: put a **`remediation` template on each requirement** in the pack (parts[] with kind, required_change, boundaries, done_when, depends_on). **Render the plan deterministically**: one `GET /assessments/{id}/fix-plan.md` with one target, and drop the per-item LLM call, the `founder` target and the builder page (use a "Fix plan" button with a preview). MCP returns the same rendered file.
- **[M4] The MCP and chat surface is too big and its contract is inconsistent.** ✓
  - Evidence: §2 and AC9 say 6 tools but §6.8 lists 7. The MCP plan signature differs from the REST one. Chat (`/assistant`, the `chat` run kind) and ⌘K aren't in the demo story. *(correctness, simplicity)*
  - Change: cut MCP to **4 tools**: `get_release_readiness`, `list_findings`, `get_finding`, `get_remediation_plan`. `run_assessment` becomes stretch. Drop chat, assistant-ui and ⌘K from V1.
- **[M5] Too many ingestion paths, none of them hardened.** ✓
  - Evidence: §6.6 accepts PDF, MD, URL, ZIP and `repo_path`, and AC11 tests all of them. There are no ZIP limits. Agent tool previews (§6.10) can surface secrets from uploaded repos. *(simplicity, risk)*
  - Change:
    - **One ingestion path**: repo ZIP plus `compliance/*.md`, which is the same as CI. The seed and the UI "New release" use it too. Drop URL fetch, PDF and `repo_path` from V1.
    - Harden extraction: size, file-count and ratio caps; reject absolute paths, `..` and symlinks; exclude `.env*`, `*.pem`, `*.key` and `id_*` server-side; never execute anything.
    - Run a **secret redactor** on artifact text and on all previews.
    - Confine the agent tools to the release root.
    - Add security tests.
- **[M6] The CI gate can be bypassed, isn't actually enforced, and infrastructure failures read as NOT READY.** ✓
  - Evidence: `cco.yaml` globs live in the PR. There's no branch protection. The exit codes are only 1/0. The rc.N naming and tag promotion are undefined. A PR checkout is a synthetic merge SHA. *(risk, correctness)*
  - Change:
    - Keep the globs and document list on the CCO server per product; `cco.yaml` carries only `product_id`.
    - Use `pull_request` (not `_target`) with `permissions: {contents: read, pull-requests: write}`. Send `head.sha`.
    - Exit codes: 1 = NOT_READY, 0 = READY or REVIEW_REQUIRED (with a warning), **2 = CCO unreachable or error (neutral)**. Add a `/healthz` preflight step.
    - The server assigns rc.N per (product, version). A tag run is a fresh assessment that creates `vX`.
    - Upsert the PR comment by a hidden marker.
    - Add a prompt-injection fixture to the eval.
- **[M7] French citations have no working source, and the legal layer is overbuilt.** ✓
  - Evidence: Légifrance auth fails (§3, Q8), yet W1 cites CMF L.541-1/L.546-1 and AC8 says "once credentials work". The pipeline resolves provisions by id, so `search()`, pgvector and Legora aren't on the critical path. *(correctness, risk, simplicity)*
  - Change: commit **hand-curated CMF texts** to `data/corpus-cache` with the Légifrance `source_url` and provenance `manual`. Split AC8 into AC8a (CELLAR + cache, required) and AC8b (live Légifrance, stretch). pgvector + `mistral-embed` stay only for legal search; see triage T7.
- **[M8] Legal-liability framing.** ✓
  - Evidence: READY is computed with no human review and shown as "✅ READY" on the PR. The legal references are unreviewed (Q2). v1.0.0 commits `cif-registration.md` with an ORIAS number, which is the same pattern as W1. *(risk)*
  - Change:
    - Label every gate surface "AI pre-assessment, not legal advice" and show "counsel-reviewed n/m".
    - Show READY without counsel as "Ready (AI)".
    - Add a gate task: a legal teammate signs off the pack and citations before AC4 counts.
    - Put a FICTIONAL DEMO banner on the demo compliance docs, and use an obviously invalid ORIAS number.
- **[M9] The activity layer is heavier than the demo needs.** ✓
  - Evidence: 15 event types, in-process pub/sub (which breaks with more than one worker), a runs page, a separate trace endpoint. *(simplicity, correctness)*
  - Change:
    - One `agent_events` table with about 8 types.
    - SSE reads that table by `seq`, so live and replay use the same code and the pub/sub goes away.
    - The finding trace becomes `GET /runs/{id}/events?requirement_id=`.
    - The latest run shows on the Overview page, and the Activity history page is dropped.
    - Map `UsageLimitExceeded` to `uncertain`.
- **[M10] Setup and onboarding are built for many companies, but the demo has one.** ✓
  - Evidence: §6.2 has Organization, Product and RegulatoryProfile, the AI profile suggestion (ministral) and the onboarding stepper. The demo seeds one company. *(simplicity)*
  - Change: seed the org and product. Keep a **single profile-confirm form** to meet §2. Drop the AI suggestion and the stepper. Flatten the routes to `/r/:release`.
- **[M11] Some acceptance criteria can't pass or don't verify what they claim.** ✓
  - Evidence:
    - AC8 is conditional on credentials.
    - AC10's "every finding has a model_request" is false for scoped-out findings.
    - AC13 is checked only by hand-recorded links.
    - No AC covers security. *(risk)*
  - Change:
    - Split AC8 (see M7).
    - Limit AC10 to findings where a model was called.
    - Add a scripted AC13 part: `cco_check.py` against a local CCO with fixture ZIPs, asserting exit codes 1/0/2 and the comment body.
    - Add **AC14 security**: tokens enforced, zip-slip and zip-bomb uploads rejected, previews redacted.

### Minors

- **[m1]** Put review inline on the Finding workspace and drop the Reviews queue page. The persona toggle: see triage T6. *(simplicity)*
- **[m2]** Fold release compare into `GET /releases/{id}/readiness` as `changes_since_previous{resolved,new}`, which CI also uses. Drop the compare route and page. *(simplicity)*
- **[m3]** Add `make demo-reset` and `make demo-export`, and commit the replay streams under `contracts/fixtures`. *(risk)*
- **[m4]** The MCP token comes from `CCO_MCP_TOKEN` env only, is compared in constant time, and is rotated after the demo. Log the client name, never the token. *(risk)*
- **[m5]** The PR-comment example contradicts the partial-fix state. Generate it from `expected.yaml`, and use it as the AC13 snapshot. *(correctness)*
- **[m6]** State runtime assumptions: single-process deploy; MCP session manager wired into the FastAPI lifespan. *(correctness)*

### Rejected or escalated, not applied automatically

- The simplicity critic's "drop pgvector + embeddings": this conflicts with the explicit user instruction to use Mistral embeddings, so it's escalated to triage (T7).
- The simplicity critic's "drop the persona toggle": the counsel persona was a user requirement, so it's escalated to triage (T6).

## Alignment check

All three critics agree the spec still solves §1 within §2. Drifts found:
- D12 is out of date (M1).
- The MCP tool count disagrees (M4).
- D3, D4, D5, D8 and D9 are still `proposed`, though the design depends on them. They must be decided before `/roman-plan`.
- D8 (no auth) was made for a local demo and no longer fits a public deployment (B3).
- The "demoable by halfway" constraint is met only on fixtures (B4).

## Triage (with the human)

| Finding | Decision | Note |
|---|---|---|
| B1 review carry-forward | accept | Carried while the evidence fingerprint is unchanged |
| B2 pack ~10 | accept | W1–W8 + 2 controls, all in `expected.yaml` |
| B3 deploy token | accept | Plus no `repo_path` on the public API, and one in-flight run per product |
| B4 W1 model spike | accept | Midpoint = AC2 + ≥2/3 live; Q3 settled in W1 |
| M1 + M2 FinTechProto model | accept | |
| M3 deterministic fix plan | accept | |
| M4 MCP 4 tools, no chat | accept | |
| M5 one ingestion path | accept | Roman: "prepare a demo directory with those documents that we can upload" → `demo/wealthpilot/{v0.9.0,v1.0.0}/upload/` |
| M6 CI hardening | accept | |
| M7 + M11 legal cache + ACs | accept | |
| M8 liability labels | accept | |
| M9 slimmer activity layer | accept | |
| M10 seeded setup | accept | |
| T6 persona toggle | keep toggle, drop Reviews queue | Review inline on the finding (m1) |
| T7 embeddings | keep, off the critical path | Used by `get_legal_basis` search and "related provisions" |
| m2–m6 | accept all | |
| D3, D4, D5, D6, D8, D9 | decided | D8 = persona toggle + deploy token |
