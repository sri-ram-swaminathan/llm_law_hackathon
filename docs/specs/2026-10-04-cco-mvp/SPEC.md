---
title: CCOmmit — AI Chief Compliance Officer MVP
slug: cco-mvp
created: 2026-10-04
status: draft                  # draft → approved → planned → executing → verifying → closed
size: full                     # lite | full
base_branch: main           # asked at the start: main or dev
integration_branch: ft/cco-mvp
task_branch_pattern: ft/cco-mvp-{id}
repos: [., ../FinTechProto]    # the lead repo first; other repos as relative paths
run_mode: step                 # step (stop after every wave) | auto (stop at gates only)
push: all                      # none | integration | all
docker_parallel: 1             # max Docker-using tasks at once
needs: [gh, docker, env:MISTRAL_API_KEY]   # spec-wide preflight needs
---

# CCOmmit — AI Chief Compliance Officer MVP

> **Inputs:** `docs/product-brief.md`, the frontend and legal-sources brainstorm, and the alignment decisions of 4 Oct 2026. This file began as `docs/spec-outline.md`.
> **Revision:** rev 2 applies every accepted finding of `critique/01-spec.md`. Finding ids (B1…, M1…, m1…) are cited where they changed the design.
> **Team brief:** https://claude.ai/artifact/EnnazLhd2cNqiAKS3jxLMA (written before rev 2; some details differ, and this file wins).

## 0. Background

**Product claim:** *"Can this company launch this release? What blocks it, why, and what has to change?"* It's a launch gate, not a legal chatbot.

**Core ideas kept from the brainstorm:**
- The **Finding** is the atomic unit: law → obligation → company claim → implementation → remediation.
- **LegalProvision ≠ Requirement**: we audit requirements, which are derived from provisions.
- **Insufficient evidence** is a state of its own, because not finding a problem isn't proof of compliance.
- **Curated scoping**, not RAG-based applicability.
- **One engine, several surfaces**: web, CI and MCP.
- **One company, two releases**: non-compliant → compliant, connected by a fix plan and a CI release gate.

## 1. Problem

Founders launching a regulated product, fintech in particular, don't know which obligations apply to them or whether their policies and code actually meet those obligations. Compliance advice is expensive, generic, and disconnected from what the product actually does. Once a product is live, every release can quietly break a promise made in its policies.

Success, for this hackathon: on stage, a fintech's release is shown **not ready to launch**, with each blocker traced to the founder's own documents and code and to the official law. A generated fix plan drives the fixes. The next release passes the same check in CI.

## 2. Goals / non-goals

**Goals (V1, hackathon)**
- A seeded company (Wealthpilot) whose regulatory profile the founder confirms on one form (M10).
- Evidence comes in one way: a **repo ZIP + `compliance/*.md` documents**. The UI upload, the seed and CI all use it (M5).
- A pre-launch assessment produces a **launch gate** (Not ready / Review required / Ready) from about **10 curated requirements** for **EU + France, fintech** (B2).
- Every finding traces to **company evidence** (a document span or code lines) and an **official legal citation**.
- **Agent activity is visible** live during a run and afterwards per finding.
- **Counsel** can confirm or override a finding inline. Their decision drives the gate and **carries forward** to later releases while the evidence is unchanged (B1).
- A **deterministic fix plan** for the open findings, which a coding agent can execute (M3).
- A **CI release gate**: a GitHub Action on FinTechProto's release PR and tags (M6).
- **MCP** with 4 read tools for Claude Code (M4).
- Wealthpilot v0.9.0 → v1.0.0 shows the blockers resolved.

**Non-goals (V1):**
- Chat or the Ask CCO drawer, assistant-ui, a ⌘K palette (M4).
- URL fetch, PDF ingestion, server-side `repo_path` ingestion (M5).
- Onboarding stepper and AI profile suggestion; multi-company setup UI (M10).
- A separate Reviews queue, Activity history or compare page (m1, M9, m2).
- A GitHub App or OAuth; checks on non-release PRs; general delta analysis.
- Operating and Scaling stage workflows ("coming soon" only); a regulator persona; user accounts or RBAC (B3 adds one deploy token, not accounts).
- Countries other than FR; exhaustive legal coverage; data rooms; live Légifrance (stretch only, M7).

## 3. Constraints

- **Timeline:** hackathon. The midpoint must prove both the UI on fixtures **and** the live model on the golden findings (B4).
- **Backend:** Python 3.12 (via `uv`), FastAPI, PydanticAI, SQLAlchemy + Postgres + pgvector, official `mcp` Python SDK. **Single process** (one uvicorn worker). The MCP Streamable HTTP session manager runs in the FastAPI lifespan (m6).
- **LLM: Mistral, only the models our key has quota for** (checked 4 Oct; medium, small, magistral, large and OCR have 0 quota or aren't in our tier):

  | Role | Model | Quota (req/min) | Checked |
  |---|---|---|---|
  | Evaluator agent | `codestral-latest` | 125 | strict JSON schema ✓, tool calls ✓, CIF finding correct and identical on 2 runs, ~2.5 s |
  | Light tasks (summaries) | `ministral-8b-latest` | 188 | strict JSON schema ✓, tool calls ✓ |
  | Fallback | `open-mistral-nemo` | 188 | same as ministral |
  | Embeddings | `mistral-embed` | 60 | 1024 dims → `vector(1024)` |

  - Model ids are config: `CCO_MODEL_EVAL`, `CCO_MODEL_LIGHT`, `CCO_MODEL_EMBED`. If `mistral-medium-latest` gets quota, switching is one line, and AC4 decides whether to keep it.
  - Because these models are small:
    - **The model never sets severity**; it comes from the requirement.
    - There is one requirement per prompt, with the evidence preloaded.
    - The **quote locator is tolerant**: it compares against two normalized forms (whitespace collapsed; string-literal joins and quote characters removed). About a third of the test quotes joined Python strings that were split across lines.
- **Frontend:** React + Vite + TypeScript + Tailwind + shadcn/ui, with a custom design.
- **Process:** SDD. **Opus** plans, specs and verifies; **Sonnet** implements.
- **Legal sources:**
  - CELLAR is public and works: SPARQL by CELEX, and REST by CELEX for the full XHTML text.
  - The eur-lex.europa.eu pages return a bot-challenge 202, and legifrance.gouv.fr pages return a Cloudflare 403, so neither can be scraped.
  - Légifrance via PISTE OAuth fails (`invalid_client`). French texts are **curated into the cache by hand** (M7), and live Légifrance is a stretch.
- **Legal posture:** every output is an **AI pre-assessment, not legal advice** (M8).

## 4. Current state (grounded @ 05897a0; FinTechProto @ dbb8e64)

**This repo:** there is no application code. It contains:
- `docs/product-brief.md` and this spec;
- `demo/wealthpilot/v0.9.0/remediation-plan.md` (the golden fix plan);
- the SDD kit (`docs/specs/_kit`) and the `roman-*` skills (`.claude/skills/`).

**Demo target `../FinTechProto` (Wealthpilot Phase 1):** a FastAPI + SQLAlchemy backend and a React (JSX) + Tailwind frontend. It uses Mistral JSON-mode recommendations, yfinance and JWT auth.

Its `main` advanced from `ae1c4e5` to **`dbb8e64`** on 4 Oct with three commits:
- `docs/PRODUCT_GUIDE.md`, the customer-facing guide;
- `docs/TECHNICAL_ARCHITECTURE.md`, today's architecture plus a **fictional "planned" AWS production setup** (eu-west-3, RDS with KMS, WAF, backups);
- `MISTRAL_MODEL` made configurable (`config.py:7`).

The only code change is that one line, so every anchor below holds at `dbb8e64`. The two docs are **company evidence**: claims the CCO checks against the code, and fictional by design. The claims this spec relies on, checked against `dbb8e64`:

| Claim | Where | Status |
|---|---|---|
| Disclaimer says "This is not financial advice" | `backend/app/config.py:10-14` | verified |
| System prompt asks for personalised analysis with concrete tickers and percentages | `backend/app/advisor.py:17-26` | verified |
| JWT secret falls back to `"dev-secret-change-me"` | `backend/app/config.py:4` | verified |
| Risk profile has 6 fields; no knowledge/experience or loss capacity | `backend/app/models.py:29-40`, `backend/app/schemas.py:19-25`, `frontend/src/pages/Onboarding.jsx:26-31` | verified |
| Profile upsert overwrites in place | `backend/app/routers/profile.py:12-20` | verified |
| Only the latest analysis is exposed | `backend/app/routers/advice.py:31-38` | verified |
| No account deletion | `backend/app/routers/auth.py` (signup, login, me) | verified |
| `User` cascades to profile and holdings only; `Recommendation` has a bare FK and no cascade | `backend/app/models.py:20-25`, `:57-64` | verified (M2) |
| No tests, no `version` file, no `.github/` | `git ls-tree HEAD` | verified (M2) |
| Product guide repeats "not financial advice" while promising "three recommendations … naming a specific instrument" | `docs/PRODUCT_GUIDE.md:115`, `:133`, `:176` | verified (W1 evidence) |
| Guide's legal-review appendix: no terms, privacy notice or consent step; data kept indefinitely; access logs record IPs | `docs/PRODUCT_GUIDE.md:225-227` | verified (W3 evidence; retention and logs are candidates for growing the pack) |
| Account deletion "not yet available … contact the team" | `docs/PRODUCT_GUIDE.md:207-208` | verified (W5 evidence) |
| Planned production: AWS eu-west-3, RDS KMS-encrypted, WAF rate limit on auth | `docs/TECHNICAL_ARCHITECTURE.md:140-252` | verified; fictional, labelled "planned, not yet built" |
| `JWT_SECRET` default documented as `dev-secret-change-me` | `docs/TECHNICAL_ARCHITECTURE.md:92` | verified (W6 evidence: the doc admits it) |
| An older local draft `docs/product.md` is untracked and differs from the guide | local only | **superseded** by `PRODUCT_GUIDE.md`; not committed |
| No privacy policy, terms or business plan | whole repo | verified; written as demo content |

Nothing contradicts the problem statement.

## 5. Options considered

| Topic | Options | Pick |
|---|---|---|
| Backend runtime | **Python + PydanticAI** · Python + Mastra sidecar · TS + Mastra | Python + PydanticAI |
| Applicability | **Curated requirement pack** · vector search over the corpus | Curated |
| Pack size | **~10 (W1–W8 + 2 controls)** · ~25 | ~10, grow after AC4 (B2) |
| Evidence selection | **Evidence hints + bounded read-only tools** · embedding search over artifacts | Hints + tools |
| Highlight location | **Quote → server-side lookup** · offsets from the model | Quote |
| Review across releases | **Carry forward while the evidence fingerprint is unchanged** · re-review every run | Carry forward (B1) |
| Fix plan | **Deterministic render from per-requirement templates** · LLM-written per item | Template (M3) |
| Access control | **One deploy token + MCP token, no accounts; local hosting** · public deploy | Deploy token, local (B3, Q3) |
| CI reachability | **CI runs CCOmmit itself on GitHub-hosted runners (CLI) + import** · self-hosted runner · tunnel to the laptop | CLI in CI (Q3) |
| Ingestion | **One path: ZIP + `compliance/*.md`** · PDF, URL, ZIP, repo_path | One path (M5) |

## 6. Design

### 6.1 Architecture

```
React/Vite web ──REST + SSE──┐  (deploy token)
CLI `cco import` ────────────┤  (results of CI runs, which execute `cco audit` on GitHub runners, §6.12)
Claude Code ─────MCP /mcp────┤  (MCP token)
                             ▼
                FastAPI app (single process)
                 ├─ Assessment workflow (async Python, one in-flight run per product, global model queue)
                 │    └─ Evaluator agent (PydanticAI + codestral, read-only tools confined to the release)
                 ├─ Activity recorder → agent_events table → SSE (live and replay from the table)
                 ├─ Legal layer: CellarProvider · CorpusCache (committed; incl. hand-curated CMF) · [LegifranceProvider: stretch]
                 ├─ Fix-plan renderer (deterministic)
                 ├─ MCP server (mcp SDK, Streamable HTTP, mounted at /mcp)
                 └─ Postgres + pgvector
```

### 6.2 Domain model

```
Organization ─ Product ─┬─ RegulatoryProfile (seeded; confirmed on one form)
                        └─ Release ─┬─ Artifact[] (compliance docs + code_repo)
                                    └─ Assessment[] ─┬─ Finding[] (one per scoped Requirement)
                                                     │    ├─ EvidenceRef[] · citations → LegalProvision[]
                                                     │    └─ Review[] (append-only; may be carried)
                                                     └─ agent_events[] (by run_id)
LegalProvision ◀─ derived_from ─ Requirement (pack: statement, applies_when, severity, evidence hints, remediation template)
```

| Entity | Key fields |
|---|---|
| `RegulatoryProfile` | `jurisdictions`, `industry`, `activities[]`, `customer_types[]`, `data_categories[]`, `ai_uses[]`, `stage`, `confirmed_at` |
| `Release` | `version` (e.g. `0.9.0`, `1.0.0-rc.2`, `1.0.0`), `source` (`seed\|ui\|ci`), `git_sha`, `branch?`, `pr_number?`, `ci_run_url?`, `previous_release_id?` |
| `Artifact` | `kind` (`business_plan\|product_spec\|privacy_policy\|terms\|regulatory_registration\|code_repo\|other`), `path`, `text` (redacted), `files[]` (code: path + redacted content), `sha256` |
| `LegalProvision` | `id`, `kind` (`law\|guidance`), `source` (`cellar\|legifrance\|manual`), `issuer?` (ESMA, AMF, CNIL), `jurisdiction`, `act_title`, `celex\|legi_id`, `article`, `paragraph?`, `text`, `source_url`, `retrieved_at`, `embedding vector(1024)` |
| `Requirement` (pack) | `id`, `domain`, `statement`, `derived_from[]`, `applies_when`, `mandatory`, `severity`, `evidence_hints{artifact_kinds[], code_globs[]}`, `evidence_needed`, `remediation{parts[]}` (§6.11) |
| `Assessment` | `release_id`, `status`, `pack_version`, `model`, `run_id`, timestamps |
| `Finding` | `requirement_id`, `conclusion`, `severity` (copied from the requirement), `title`, `reasoning_summary`, `evidence[]`, `citations[]`, `confidence{applicability, evidence, finding}`, `attempts`, `validation_notes[]`, `evidence_fingerprint` |
| `EvidenceRef` | `document_span{artifact_id, quote, start, end}` · `code{artifact_id, path, start_line, end_line, quote}` · `missing{artifact_kind}` |
| `Review` | `finding_id`, `requirement_id`, `product_id`, `reviewer_name`, `decision` (`confirm\|override\|not_applicable\|need_evidence`), `override_conclusion?`, `comment`, `evidence_fingerprint`, `created_at`, `revoked_at?` |
| `AgentEvent` | `run_id`, `run_kind` (`assessment\|mcp`), `seq`, `ts`, `type` (§6.10), `requirement_id?`, `tool?`, `attempt?`, `summary`, `input_preview?`, `output_preview?` (redacted, ≤ 2 KB), `tokens?`, `latency_ms?`, `error?` |

`evidence_fingerprint` = sha256 of the sorted (path, quote) pairs of the finding's evidence, plus the sorted kinds of its `missing` refs.

### 6.3 Status model, review carry-forward and launch gate (deterministic)

- `conclusion`: `satisfied | potential_violation | insufficient_evidence | not_applicable | uncertain`
- `severity`: `blocker | high | medium | low`. It always comes from the requirement, never from the model.
- **Applicable review** for a finding: the latest non-revoked `Review` on that finding. Otherwise, the latest non-revoked review for the same product and `requirement_id` whose `evidence_fingerprint` equals the finding's (**carried**, shown as "carried from vX by <name>") (B1).
- **Effective conclusion:** the applicable review's override (`not_applicable` → not_applicable; `confirm` → the AI value), otherwise the AI value. AI values are immutable.
- `uncertain` covers both the model's own uncertainty and validation failure or limit exhaustion (§6.4).

```
gate(release) =
  NOT_READY        if any effective (potential_violation ∧ blocker)
                   or any mandatory requirement effectively insufficient_evidence
  REVIEW_REQUIRED  else if any effective (potential_violation ∧ high)
                   or any uncertain finding with no applicable review
  READY            otherwise
```

**Labels (M8):** every gate surface (UI, PR comment, MCP) shows "AI pre-assessment, not legal advice" and "counsel-reviewed n/m". READY with no applicable review on any finding is labelled **"Ready (AI)"**.

**Changes since previous** (m2): readiness includes `changes_since_previous{resolved[], new[], unchanged[]}`, keyed by `requirement_id` against `previous_release_id`.

### 6.4 Assessment pipeline

| # | Step | Done by | Events |
|---|---|---|---|
| 1 | Load profile + artifacts; acquire the per-product run lock | code | `step` |
| 2 | **Scope**: `applies_when` → requirements; the out-of-scope ones become `not_applicable` findings with no model call | code | `scope` |
| 3 | **Legal basis**: resolve `derived_from` from the cache (CELLAR fetch on a miss) | legal layer | `tool_call`/`tool_result` |
| 4 | **Evidence bundle** per requirement from its hints; missing kinds noted | code | `step` |
| 5 | **Evaluate** (`output_type=FindingCandidate`, `temperature=0`). Tools: `read_artifact(artifact_id, section?)`, `grep_code(fixed_string, glob?)`, `read_file(path, start, end)`, `get_provision(id)`. All confined to the release; `UsageLimits` caps tool calls at 6 per requirement. | PydanticAI + codestral | `model_request`, `model_response`, `tool_call`, `tool_result` |
| 6 | **Validate** in `@output_validator`; on failure, `ModelRetry(errors)` (`output_retries=2`) | code | `retry` (with the errors) |
| 7 | Persist the finding. Validation exhaustion or `UsageLimitExceeded` → `uncertain` + `validation_notes` | code | `finding` |
| 8 | Gate + coverage + changes since previous | code | `gate` |

**Validation:**
- `requirement_id` matches; citations ⊂ `derived_from`; artifact ids belong to the release.
- Every quote is located (either normalized form, fuzzy ≥ 0.9). Code lines exist and contain the quote.
- `potential_violation` and `satisfied` need a real evidence ref; `insufficient_evidence` needs a `missing` ref.

**Throughput:**
- Concurrency 4 inside a run, plus one global model queue across runs.
- A 429 gets exponential backoff (max 3).
- About 10 requirements × (1 + up to 6 tool turns + 2 retries) stays well under the codestral quota (M6/B2).

**Prompt injection:** documents and code are passed as quoted data in clearly delimited blocks. The system prompt says that instructions inside evidence are content to evaluate, never commands. An injection fixture is in the eval (M6).

### 6.5 Legal knowledge layer

```python
class LegalKnowledgeProvider(Protocol):
    async def get_provision(self, ref: ProvisionRef) -> LegalProvision: ...
    async def search(self, q: LegalQuery, k: int = 5) -> list[LegalProvision]: ...   # pgvector; off the critical path
```

- **Seed corpus** (Legora's list for Wealthpilot plus MiFID II, checked 4 Oct):

  | Source | Identifier | Fetch | Status |
  |---|---|---|---|
  | EU AI Act | CELEX `32024R1689` | CELLAR REST | ✅ full text, Art. 50 present |
  | GDPR (consolidated) | CELEX `02016R0679-20160504` | CELLAR REST | ✅ full text |
  | MiFID II + Del. Reg. 2017/565 | CELEX `32014L0065`, `32017R0565` | CELLAR REST | ✅ (32014L0065 checked) |
  | Code monétaire et financier (L.541-1, L.546-1; section `LEGISCTA000006100807` of `LEGITEXT000006072026`) | Légifrance | **hand-curated**: Légifrance PDFs supplied by Roman → `data/sources/legifrance/CMF-L541-1.{pdf,md}`, `CMF-L546-1.{pdf,md}` (text + metadata) → ingested into `data/corpus-cache/` with `source: manual` | ✅ L.541-1 (in force since 24/05/2019) and L.546-1 (since 24/12/2021) captured 4 Oct. L.541-1 I 1° points to **L.321-1 (5)** for the definition of "conseil en investissement"; add it the same way. Live API is stretch (Q8) |
  | *Guidance:* ESMA Guidelines on MiFID II suitability (ESMA35-43-3172) | ESMA PDF | curated excerpts, `kind: guidance` (W2, W4, W7) | ✅ PDF reachable (310 KB) |
  | *Guidance:* AMF doctrine on CIF status and investment advice | amf-france.org | curated excerpts, `kind: guidance` (W1) | ✅ site reachable; pages to pick |
  | *Guidance:* CNIL guidance (information notices, right to erasure) | cnil.fr | curated excerpts, `kind: guidance` (W3, W5) | ✅ site reachable; pages to pick |
  | *Check:* ORIAS registration number | rule | deterministic format check (8 digits) as an evaluator tool; live register lookup off | ✅ |

  Del. Reg. 2017/565 Art. 54 was also checked (CELLAR 200).

- **Ingest script** (`python -m cco.ingest`): for each provision ref in the pack, fetch it from CELLAR, split by article and paragraph, embed with `mistral-embed`, and store. Its output is committed to `data/corpus-cache/` so the demo runs offline. Official sources are the citation authority. Legora documents aren't used in V1 (Q5).
- **Pack** `data/packs/fintech-eu-fr.yaml`: **W1–W8 plus 2 controls** (§6.9), each with a remediation template. There's no sign-off gate (D18): findings are reviewed in the app by the **legal counsel role**. The pack grows only after AC4 passes (B2). The first candidates are storage limitation (indefinite retention) and access-log IPs, from `PRODUCT_GUIDE.md:226-227`.
- **pgvector search** backs the legal-basis drawer's "related provisions" and nothing on the audit path (T7).

### 6.6 Evidence ingestion: one path (M5)

**The bundle:** a ZIP of the code plus `compliance/*.md`, sent with an artifact-kind map. CI, the UI upload ("New release") and the seed all use the same service.

**Hardening:**
- Limits: ≤ 50 MB compressed, ≤ 200 MB uncompressed, ≤ 5 000 files, compression ratio ≤ 1:100.
- Reject absolute paths, `..`, symlinks and device files. Extract to a temp directory. **Nothing is ever executed or installed.**
- Always excluded server-side: `.env*`, `*.pem`, `*.key`, `id_*`, `node_modules/`, `.git/`, binaries.
- A **secret redactor** (key-shaped regexes + an entropy check) runs on all stored artifact text and on every activity preview.

**Code globs and the document list** are configured **per product in CCOmmit's own repo** (`data/products/wealthpilot.yaml`), never taken from the upload (M6). A bundle missing a file that a requirement's hints point to is still assessed, and that requirement becomes `insufficient_evidence`.

**Demo upload folder** (Roman's request): `demo/wealthpilot/{v0.9.0,v1.0.0}/upload/` holds ready-to-upload bundles, `code.zip` plus `compliance/*.md`. They're generated by `make demo-bundles` from the FinTechProto tags with `git archive` (tracked files only), so the UI demo uploads exactly what CI sends.

### 6.7 Frontend

**User journeys → pages**

| Journey | Persona | Path |
|---|---|---|
| A. Confirm what we're launching | Founder | `/profile`: one form, seeded values, Confirm |
| B. Can I launch? | Founder | Overview → **Run assessment** → **live activity panel** → gate + blockers |
| C. Investigate a blocker | Founder | Finding workspace: document highlight ↔ code lines ↔ legal-basis drawer ↔ "How this was produced" |
| D. Counsel review | Counsel (toggle) | Finding workspace → inline Confirm / Override / Not applicable / Need evidence → gate updates |
| G. Fix and re-release | Founder → developer | Overview → **Fix plan** (preview, copy, download) → fixes → New release (upload bundle) → Run → "What changed" |
| H. Release gate in CI | Developer | Push to `dev` → release PR → the CCOmmit check (on GitHub runners) posts the gate + blockers → red → fixes → green → merge + tag → **Import CI run** → the release appears in the local CCOmmit |
| F. Developer check | Developer | Claude Code → MCP (4 tools) |

**Routes** (flattened, one seeded org and product, M10):

| Route | Page |
|---|---|
| `/profile` | Profile confirm form |
| `/r/:release/overview` | Gate card + labels, coverage by domain, blockers, "What changed", latest run (opens the activity panel), Fix plan button |
| `/r/:release/evidence`, `/r/:release/evidence/:artifactId` | Bundle contents; document or code viewer with highlights |
| `/r/:release/findings`, `/r/:release/findings/:findingId` | List with status chips; three-pane workspace with tabs *Finding · Legal basis · How this was produced* and an inline review panel |
| `/releases` | Release list (seed, ui, ci badges), New release (upload), **Import CI run** |

**Global elements:**
- Header: release switcher, stage pill (Operating and Scaling "coming soon"), **Run assessment**, persona toggle (Founder ⇄ Counsel).
- Legal-basis drawer.
- Activity panel (slide-over).
- A one-time deploy-token prompt, stored in `localStorage`.

**Design:** restrained (Linear/Stripe feel). One accent color; everything else colored by status meaning. Effort goes on the release-switch transition, the live activity timeline, highlight ↔ finding linking, and the drawers. Design tokens go into `docs/design.md` in T01.

### 6.8 Surfaces

**REST** (`/api`, OpenAPI from FastAPI, frontend types via `openapi-typescript`, **deploy token** `Authorization: Bearer $CCO_DEPLOY_TOKEN`, B3):
- Profile: `GET /product`, `PUT /product/profile`
- Releases and evidence: `GET /releases`, `POST /releases` (multipart bundle, `version`), `GET /releases/{id}`, `GET /artifacts/{id}`
- Assessment: `POST /releases/{id}/assessments` → 202 (409 if a run is in flight), `GET /assessments/{id}`, `GET /releases/{id}/readiness` (gate, labels, coverage, `changes_since_previous`), `GET /assessments/{id}/findings`, `GET /findings/{id}`, `POST /findings/{id}/reviews`, `POST /reviews/{id}/revoke`
- Activity: `GET /runs/{id}/events?requirement_id=&after_seq=` (SSE: replays from the table, then follows live; live and replay share this path)
- Fix plan: `GET /assessments/{id}/fix-plan.md`
- Legal: `GET /provisions/{id}`, `GET /provisions/{id}/related`
- Ops: `GET /healthz` (no auth)

**CLI** (`uv run cco …`, the same services in-process, used by CI and the eval):
- `cco audit --bundle <dir|zip> --version <v> --sha <sha> [--previous <result.json>] --out <dir>` writes `result.json` (release, assessment, findings, readiness, events), `comment.md` and `fix-plan.md`, and exits with the CI exit code (§6.12).
- `cco import <result.json|artifact.zip>` loads a CI result into the local app as a release with `source: ci`.

**Import over REST:** `POST /releases/import` (deploy token) is the UI's "Import CI run" button.

**MCP** (`/mcp`, Streamable HTTP, `CCO_MCP_TOKEN` env only, constant-time compare, m4): `get_release_readiness(version?)`, `list_findings(version?, severity?, conclusion?)`, `get_finding(id)`, `get_remediation_plan(version?)`. Each returns the same data as REST, and the plan is the same rendered Markdown. Each call writes `agent_events` with `run_kind=mcp` and the client name (never the token). Stretch: `run_assessment`, which shares the run lock and queue.

### 6.9 Demo dataset: Wealthpilot (FinTechProto)

**Wealthpilot:** a French startup giving retail investors AI-generated, personalised portfolio recommendations (Mistral), from a risk questionnaire and holdings they enter by hand. No trade execution. Pre-launch in France.

**Releases and branches (M1):**

**`v0.9.0`** = `dbb8e64` + **one docs-only commit** on `main`, done by a human gate:
- It adds `compliance/business-plan.md`, `compliance/cco-baseline.json` (empty: no prior release or reviews) and a `version` file.
- Per the product guide, v0.9.0 has **no terms and no privacy notice**.
- `PRODUCT_GUIDE.md` and `TECHNICAL_ARCHITECTURE.md` are already on `main`.
- `git diff dbb8e64 v0.9.0 -- backend frontend` is empty, so every line reference holds.

**`dev`** accumulates the fix-plan commits in two pushes:
1. **Partial:** items 3–6 + A2 (privacy policy) + A3 (publish terms). Still red with W1 and W2 open.
2. **Full:** items 1–2 + A1 (CIF registration). Green.

Before the full push, counsel's W8 decision is exported with `cco export-baseline 0.9.0` into `compliance/cco-baseline.json` on `dev`, so CI can carry it forward. A human merges the release PR and tags `v1.0.0` (gate tasks).

**Prep:** a pytest scaffold for FinTechProto, needed by the fix plan's tests, is committed on `dev` first (M2).

**Fiction markers (M8):** every `compliance/*.md` starts with a "FICTIONAL DEMO DOCUMENT" banner. The ORIAS number is `00000000`.

**Pack and golden expectations:** `demo/wealthpilot/expected.yaml` gives **every** requirement's expected conclusion for v0.9.0, the partial-fix rc and v1.0.0 (B2). Legal references are reviewed in the app by the counsel role; there is no project sign-off gate (D18).

| ID | Requirement (legal basis) | Evidence at v0.9.0 | Severity | v0.9.0 | partial rc | v1.0.0 |
|---|---|---|---|---|---|---|
| W1 | Personalised investment advice requires CIF status registered with ORIAS (MiFID II Art. 4(1)(4); CMF L.541-1, L.546-1) | `config.py:10-14` says "not financial advice"; `advisor.py:17-26` asks for tickers and percentages | blocker | 🔴 potential_violation | 🔴 | 🟢 satisfied |
| W2 | Suitability: knowledge/experience, financial situation incl. loss capacity, objectives (MiFID II Art. 25(2); Del. Reg. 2017/565 Art. 54) | Only 6 profile fields | blocker | 🔴 | 🔴 | 🟢 |
| W3 | Information on processing (GDPR Art. 13), **mandatory** | No privacy policy; the guide states "no … privacy notice" (`PRODUCT_GUIDE.md:225`) | high | 🔵 insufficient_evidence → NOT_READY | 🟢 | 🟢 |
| W4 | Advice on up-to-date client information (Del. Reg. 2017/565 Art. 54(7)) | `profile.py:12-20` overwrites; the analysis isn't invalidated | high | 🟠 | 🟢 | 🟢 |
| W5 | Right to erasure (GDPR Art. 17) | No deletion; recommendations aren't cascaded | high | 🟠 | 🟢 | 🟢 |
| W6 | Security of processing (GDPR Art. 32) | `config.py:4` default secret | high | 🟠 | 🟢 | 🟢 |
| W7 | Suitability report to the client (MiFID II Art. 25(6)) | `advice.py:31-38` latest only | medium | 🟡 | 🟢 | 🟢 |
| W8 | AI transparency (AI Act Art. 50) | AI output labelled; no chatbot | medium | ◌ uncertain → counsel "not applicable" on stage | ◌ carried (fingerprint unchanged) | ◌ carried |
| C1 | No trade execution or holding of client funds; payment-services authorisation not triggered (control) | README/product.md: read and advise only | high | ⚪ not_applicable | ⚪ | ⚪ |
| C2 | Passwords stored hashed (GDPR Art. 32, control) | bcrypt in `auth.py` | medium | 🟢 satisfied | 🟢 | 🟢 |

**Expected gates:**
- **v0.9.0:** NOT_READY (2 blockers, 1 mandatory missing evidence, 3 high).
- **Partial rc:** NOT_READY (2 blockers).
- **v1.0.0:** READY with W8 carried, so it shows "counsel-reviewed 1/10" rather than "Ready (AI)".

**W8 carry-forward (B1):** carry-forward applies only while W8's fingerprint is unchanged. W8's evidence cites the UI labels, and items 1–2 touch `config.py` and `advisor.py`, not the labels, so the fingerprint should hold. The eval checks this. If the fingerprint changes, counsel re-reviews on stage, which is a valid fallback.

### 6.10 Agent-activity layer (slimmed, M9)

**Event types:**
- `step`, `scope`
- `model_request`, `model_response`
- `tool_call`, `tool_result`
- `retry` (with the validator errors)
- `finding`, `gate`
- `run_end` (ok or failed)

**Storage and streaming:** one `agent_events` table. The recorder inserts rows. SSE reads by `seq` with `after_seq`, polling at 250 ms, so live and replay share one code path and there's no pub/sub. **Replay** paces stored events by their recorded `ts` gaps.

**Capture:**
- The PydanticAI run is iterated with `agent.iter()`, and nodes and tool calls are mapped to events.
- MCP handlers record their calls through a decorator.
- Previews are redacted (§6.6) and capped at 2 KB.

**UI:**
- **Live panel:** grouped by step, then by requirement. Tool rows expand to input/output; retries show in amber with the validator's errors. A header shows counters and a progress bar.
- **"How this was produced":** the same component, filtered by `requirement_id`.

### 6.11 Fix plan: deterministic (M3)

**Template:** each requirement in the pack carries `remediation.parts[]`. Each part has:
- `kind`: `code`, `document` or `organisational`
- `title`, `required_change`
- `locations`: globs or `path:line` anchors, resolved against the release
- `boundaries`: the files it may touch
- `done_when[]`
- `depends_on?` (part ids)

**Render:** `GET /assessments/{id}/fix-plan.md` renders the parts of every requirement whose effective conclusion is open (not satisfied or not applicable).
- **Problem, locations and legal basis** come from the validated finding.
- **Required change, boundaries and done_when** come from the template.
- **No LLM call.** The output is identical across UI, CI and MCP.

**Layout:**
1. Context: product, release, gate and labels.
2. Rules for the coding agent.
3. One section per `code` part, ordered blocker → medium, with dependencies noted.
4. An appendix with the `document` and `organisational` parts, for the founder.
5. How to verify.

**Golden example:** `demo/wealthpilot/v0.9.0/remediation-plan.md`. AC12 asserts the rendered plan against it, item for item: ids, kinds, locations and boundaries.

### 6.12 CI release gate: runs on GitHub-hosted runners (M6, Q3)

**Idea:** CCOmmit is hosted locally for the demo, so GitHub can't call it. Instead, **the CI job runs CCOmmit itself** on a GitHub-hosted runner, in headless CLI mode, against the checked-out product. The result goes to the PR, and the local app imports it.

**Baseline that travels with the product:** `compliance/cco-baseline.json` is written by `cco export-baseline <release>` and committed with each release by a human. It holds:
- the released version;
- each requirement's effective conclusion;
- the **counsel reviews** with their evidence fingerprints.

CI uses it for **review carry-forward** (B1: the W8 decision) and for **changes since the previous release**. Counsel decisions are then versioned with the product they cover.

**In FinTechProto:**
- `compliance/cco.yaml`: only `product_id`. The evidence config (globs, document list) comes from **CCOmmit's own repo** (`data/products/wealthpilot.yaml`), never from the PR.
- `.github/workflows/compliance.yml`:
  - **Triggers:** `pull_request` to `main` (never `pull_request_target`), `push` of tags `v*`, `workflow_dispatch`.
  - `permissions: {contents: read, pull-requests: write}`.
  - Runs on `ubuntu-latest` with a `services: postgres` container (`pgvector/pgvector:pg16`).
  - **Steps:**
    1. Check out the product at `head.sha`.
    2. Check out CCOmmit (`sri-ram-swaminathan/llm_law_hackathon`, a pinned tag) with `CCOMMIT_REPO_TOKEN`.
    3. `uv sync`.
    4. `git archive HEAD` → bundle.
    5. `uv run cco audit --bundle … --version $(cat version) --sha $HEAD_SHA --baseline compliance/cco-baseline.json --out out/`.
       - The legal layer reads only the committed corpus cache.
       - The model calls go to Mistral with `MISTRAL_API_KEY`.
    6. Write `out/comment.md` to `$GITHUB_STEP_SUMMARY`.
    7. **Upsert one PR comment** by the hidden marker `<!-- ccommit-check -->` (`gh`).
    8. Upload `out/` (result, fix plan, events) as the artifact `ccommit-result`.
  - **Exit codes** (from `cco audit`):

    | Code | Meaning | Check shows |
    |---|---|---|
    | 1 | NOT_READY | failure |
    | 0 | READY or REVIEW_REQUIRED | success; REVIEW_REQUIRED adds a warning annotation |
    | **2** | engine error (Mistral unavailable after retries, timeout, bad config) | a neutral "CCOmmit could not run" summary, **never** "NOT READY" |

- **Secrets in FinTechProto (human gate):**
  - `MISTRAL_API_KEY`: the key now also lives in GitHub secrets. This replaces "the key never leaves the server". Rotate it after the demo.
  - `CCOMMIT_REPO_TOKEN`: a fine-grained, read-only token for the private CCOmmit repo.

**Human gate tasks:**
- Add the two secrets.
- Branch protection on FinTechProto `main`, with `compliance` as a required check. The repo was transferred to RomanGrebnev/FinTechProto on 4 Oct; Roman is admin, so he can do this himself.
- CODEOWNERS for `.github/` and `compliance/`.
- Commit the docs-only `v0.9.0` change and `cco-baseline.json`.
- The tags and the release-PR merge.

**Release naming** (computed by `cco audit`):
- PR run → `<version>-rc.<github.run_number>`.
- Tag run → `<version>`, with `previous` = the baseline's version.

**Into the local app:** run `cco import <artifact.zip>`, or use **Import CI run** on `/releases`, to load the result as a release with `source: ci`, `pr_number` and `ci_run_url`. It then shows up in the release switcher, readiness and activity replay. On stage: download the artifact with `gh run download` and import it.

**PR comment example:** generated from `expected.yaml` for the partial state (m5). It's also the AC13 snapshot:

```
<!-- ccommit-check -->
CCOmmit compliance check · 1.0.0-rc.12 (a1b2c3d) · ❌ NOT READY · AI pre-assessment, not legal advice
2 blockers · 0 missing evidence · 0 high · 10 requirements evaluated · counsel-reviewed 1/10
🔴 W2 Suitability assessment incomplete      backend/app/schemas.py:19
🔴 W1 Product wording contradicts advice     backend/app/config.py:10
Changes since 0.9.0: 5 resolved · 0 new
→ Fix plan: see artifact ccommit-result/fix-plan.md
```

### 6.13 Security and operability (B3, M5, m3, m4)

**Tokens** (all from env, never committed; rotate after the demo):

| Token | Scope |
|---|---|
| `CCO_DEPLOY_TOKEN` | all `/api` routes (the local app binds to `127.0.0.1` by default) |
| `CCO_MCP_TOKEN` | `/mcp` |
| GitHub secrets `MISTRAL_API_KEY`, `CCOMMIT_REPO_TOKEN` | the FinTechProto CI job (§6.12) |

`/healthz` is the only route without auth. **Hosting (Q3):** local only, for the hackathon.

**Abuse limits:**
- One in-flight assessment per product (409 otherwise).
- A global model queue.
- Upload limits (§6.6).
- No server-side path or URL ingestion.

**Demo ops:**
- `make demo-reset` drops the database and re-seeds it from `contracts/fixtures`, including the recorded event streams and the W8 review.
- `make demo-export` dumps runs and reviews to JSON.
- `make demo-bundles` builds the upload folder.
- The replay streams are committed under `contracts/fixtures/`.

**Runtime:** one uvicorn worker. The MCP session manager runs in the lifespan. SSE reads the database.

## 7. Interfaces and contracts (frozen by T01)

| Contract | Location | Consumers |
|---|---|---|
| Domain + API models (Pydantic) | `backend/app/contracts/*.py` | API, workflow, MCP, CI |
| OpenAPI (exported) + TS types | `contracts/openapi.json`, `frontend/src/api/types.ts` | web, `cco_check.py` |
| `FindingCandidate` (agent output) | `backend/app/contracts/ai.py` | evaluator |
| `AgentEvent` + SSE envelope | `backend/app/contracts/activity.py` | recorder, web, MCP |
| Readiness (gate, labels, coverage, `changes_since_previous`) | `backend/app/contracts/readiness.py` | web, CI comment, MCP |
| `LegalKnowledgeProvider` protocol + cache format | `backend/app/legal/base.py`, `data/corpus-cache/README.md` | providers, ingest |
| Requirement pack schema (incl. `remediation.parts`) | `data/packs/schema.json` | pack, scoper, renderer |
| Bundle format + per-product evidence config | `backend/app/contracts/bundle.py` | ingestion, CI, demo bundles |
| CI exit codes, comment marker, `result.json` and `cco-baseline.json` formats | `backend/app/contracts/ci.py` | `cco audit`, `cco import`, `cco export-baseline`, workflow |
| Product evidence config | `data/products/wealthpilot.yaml` | ingestion, CI |
| MCP tool signatures | `backend/app/mcp/tools.py` | MCP server |
| Fixtures: assessments + event streams (v0.9.0, partial rc, v1.0.0) | `contracts/fixtures/*.json` | web (slice 1), replay, demo-reset, tests |
| Golden expectations (all requirements × 3 releases) | `demo/wealthpilot/expected.yaml` | eval, ACs, comment snapshot |
| Design tokens | `docs/design.md` | web |

Layout: `backend/`, `frontend/`, `contracts/`, `data/packs/`, `data/corpus-cache/`, `demo/wealthpilot/`, `scripts/`, `docs/`.

## 8. Decisions

| # | Decision | Rationale | Status |
|---|---|---|---|
| D1 | Python: FastAPI + PydanticAI + `mcp` SDK; no Mastra | One runtime; typed outputs with retry; activity events | decided |
| D2 | EU + France, fintech; **~10 requirements** (W1–W8 + C1–C2) | Controlled demo; grows after AC4 (B2) | decided |
| D3 | One finding per scoped requirement × assessment | Coverage and changes come straight from the data | decided |
| D4 | Quote-based evidence location with a tolerant locator | LLM offsets are unreliable | decided |
| D5 | Deterministic gate; the human review takes precedence and **carries forward** by evidence fingerprint; AI values immutable | Trust; reachable READY (B1) | decided |
| D6 | Official sources are the citation authority; CMF texts hand-curated with their Légifrance URLs | Provenance without a working API (M7) | decided |
| D7 | One codebase: the app serves REST and `/mcp`; the `cco` CLI runs the same services for CI and the eval | One engine, several surfaces | decided |
| D8 | Persona toggle + **one deploy token**, no accounts | Demo story + basic protection (B3) | decided |
| D9 | Live run with event replay from the same table | Stage safety, same code path (M9) | decided |
| D10 | React + Vite + TS + Tailwind + shadcn; **no chat** in V1 | Scope (M4) | decided |
| D11 | Agent-activity layer is first-class but slim | Core demo (M9) | decided |
| D12 | Wealthpilot; **v1.0.0 accumulates on `dev`**; v0.9.0 = dbb8e64 + a docs-only commit; base-branch actions are human gates | Consistent anchors (M1) | decided |
| D13 | Fix plan **rendered deterministically** from pack templates; one format for UI, CI and MCP | Testable, identical everywhere (M3) | decided |
| D14 | CI release gate in V1, **run on GitHub-hosted runners** with `cco audit`; evidence config in CCOmmit's repo; reviews and baseline travel in `compliance/cco-baseline.json`; exit 2 = engine error; results imported locally | Local hosting (Q3), hardened (M6) | decided |
| D15 | One ingestion path: ZIP + `compliance/*.md`; hardened; redacted | Simplicity + safety (M5) | decided |
| D16 | Models: codestral (evaluation), ministral-8b (light), mistral-embed; severity from rules | Our quota (§3) | decided |
| D17 | MCP = 4 read tools; `run_assessment` is stretch | Scope (M4) | decided |
| D18 | "AI pre-assessment, not legal advice" labels; fictional demo docs; **no legal sign-off gate**: legal counsel is a reviewer role in the app, not a project gate | Liability (M8), Q2 | decided |
| D19 | Product name **CCOmmit**; hosting local for the hackathon | Q7, Q3 | decided |
| D20 | Regulator guidance (ESMA suitability guidelines, AMF CIF doctrine, CNIL guidance) is cached as `kind: guidance` and shown next to the law; findings cite the law and may add guidance. An ORIAS check validates the registration number's format deterministically; a live register lookup is off (the demo number is fictional) | Q5 | decided |

## 9. Acceptance criteria

- **AC1 Contracts:** models import; OpenAPI exports; all fixtures validate; generated TS types show no diff. · verify: `make contracts-check`
- **AC2 Golden path on fixtures:** v0.9.0 overview shows **Not ready**, 2 blockers, 1 needs-evidence and the AI label; click-through to W1 shows the highlight, the code lines and the legal drawer. · verify: `pnpm -C frontend exec playwright test golden-path.spec.ts`
- **AC3 Traceability:** every `potential_violation`/`satisfied` finding has an evidence ref that resolves to existing text or lines, and a citation with a `source_url`. · verify: `uv run pytest tests/test_traceability.py`
- **AC4 Golden eval:** live runs match `expected.yaml` for **all** requirements in ≥ 4 of 5 runs, for v0.9.0, the partial rc and v1.0.0 (with the W8 review seeded). The injection fixture doesn't change any conclusion. A run budget of ≤ 15 min in total is logged. · verify: `uv run python -m cco.eval wealthpilot --runs 5`
- **AC5 Validation and retry:** a scripted `FunctionModel`:
  - a bad quote, then valid output → persisted after one retry, with a `retry` event;
  - 3 bad outputs → `uncertain` with no dangling references;
  - tool-limit exhaustion → `uncertain`.
  - · verify: `uv run pytest tests/test_validation.py`
- **AC6 Review and carry-forward:**
  - counsel `not_applicable` on W8 changes the effective conclusion and the gate, and the AI value is kept;
  - a new assessment with the same fingerprint shows W8 "carried";
  - a changed fingerprint doesn't carry it;
  - revoking it restores REVIEW_REQUIRED.
  - · verify: `uv run pytest tests/test_review.py`
- **AC7 Changes since previous:** v1.0.0 readiness lists W1–W7 as resolved against the rc, and the rc lists W3–W7 as resolved against v0.9.0. The UI shows them. · verify: `uv run pytest tests/test_readiness.py` + Playwright
- **AC8a Legal layer:** CELLAR returns GDPR Art. 5 for `32016R0679`; with the network off, the cache serves every `derived_from` provision of the pack, including the manual CMF texts with Légifrance URLs. · verify: `uv run pytest tests/test_legal.py` (the network part is marked `integration`)
- **AC8b (stretch, can be waived at a gate):** live Légifrance returns CMF L.541-1. · verify: `uv run pytest -m legifrance`
- **AC9 MCP:**
  - a client lists exactly 4 tools;
  - `list_findings(severity="blocker")` on v0.9.0 returns W1 and W2;
  - `get_remediation_plan` equals `fix-plan.md` byte for byte;
  - a wrong token is rejected;
  - calls are recorded with `run_kind=mcp`.
  - · verify: `uv run pytest tests/test_mcp.py`
- **AC10 Activity:**
  - an assessment produces ordered events covering every step;
  - findings that had a model call have ≥ 1 `model_request` and 1 `finding`;
  - scoped-out findings have a `scope` event and no model call;
  - SSE delivers live and replays a finished run identically.
  - · verify: `uv run pytest tests/test_activity.py` + Playwright
- **AC11 Ingestion:** the bundle in `demo/wealthpilot/v0.9.0/upload/` uploads through the UI. Markdown documents and code files render with highlights after assessment. · verify: Playwright `upload.spec.ts`
- **AC12 Fix plan:** the rendered v0.9.0 plan matches `remediation-plan.md` item for item:
  - code items 1–6 with their ids, kinds and dependencies, and appendix A1–A4;
  - every `path:line` exists at tag `v0.9.0`;
  - the render is deterministic (two renders are byte-identical).
  - · verify: `uv run pytest tests/test_fix_plan.py`
- **AC13 CI gate:**
  - **(a) scripted:**
    - `cco audit` with a scripted model on the fixture bundles exits 1 for v0.9.0, 1 for the partial state, 0 for v1.0.0 (with the baseline carrying W8), and 2 when Mistral is unavailable.
    - `comment.md` equals the snapshot.
    - `cco import` of the result shows the release with `source: ci`.
    - · verify: `uv run pytest tests/test_ci.py`
  - **(b) live:**
    - on FinTechProto (GitHub-hosted runner), the release PR is red after push 1 and green after push 2, with one upserted comment;
    - the tag run produces `1.0.0` READY;
    - its artifact imports into the local app.
    - Run links are recorded in `evidence/`. · verify: gate task with links
- **AC14 Security:**
  - missing or wrong deploy and MCP tokens → 401;
  - a zip-slip, zip-bomb or symlink bundle → 400;
  - `.env` and `*.pem` in a bundle are dropped;
  - a planted fake key is redacted in artifact text and in previews;
  - a second concurrent run → 409.
  - · verify: `uv run pytest tests/test_security.py`

## 10. Risks and rollback

| Risk | Mitigation |
|---|---|
| Small models miss a golden finding | W1 spike at the midpoint (B4); severity from rules; one requirement per prompt; sharp gaps in the demo data; AC4; switch to medium if quota arrives |
| Model variance on stage | `temperature=0`; replay from the same events table; `make demo-reset` |
| Rate limits (CI, web and eval overlapping) | Global queue, backoff, ~10 requirements, rehearsal with concurrent runs |
| W8 fingerprint changes between releases | AC4 checks it; counsel re-reviews on stage as the fallback |
| CI job fails to run CCOmmit (setup, Mistral outage) | Pinned CCOmmit tag; committed corpus cache (no legal network calls); exit 2 is neutral; `uv` cache; recorded run links + local `cco audit` fallback |
| Mistral key in GitHub secrets | Private repo; `pull_request` only (no fork secrets); rotate after the demo |
| Légifrance unavailable | Hand-curated CMF cache (D6); AC8b is stretch |
| Prompt injection via uploaded docs | Delimited evidence, system rule, injection fixture in AC4 |
| Secrets in uploaded repos | Server-side excludes + redactor (AC14) |
| Legal claims taken as advice | Labels everywhere; counsel review in the app; fictional docs |
| Too much time on SDD documents | One SPEC + task files; contracts are code |

**Rollback:** the CCO is new code on `ft/cco-mvp`, so rollback means not merging it. In FinTechProto, the CI workflow is removed by reverting one commit on `dev`, and branch protection is a human setting, reverted at the same gate.

## 11. Open questions

1. **Q6 Owners:** who owns contracts, web, pipeline, legal pack, demo documents and FinTechProto prep? (Deferred to `/roman-plan`.)
2. **Q8 Légifrance:** the PISTE Client ID and environment. Only AC8b depends on it. (Deferred: stretch.)
3. ~~Admin on FinTechProto~~ → resolved: the repo moved to RomanGrebnev/FinTechProto (private, Roman is admin). Secrets and branch protection stay W4 gate tasks for Roman.

Resolved:
- Q1 runtime → D1.
- Q2 → no sign-off gate; counsel is an in-app role (D18).
- Q3 → local hosting; CI on GitHub runners (D14, D19).
- Q4 → D9.
- Q5 → Legora's API isn't available; other sources added (D20).
- Q7 → **CCOmmit** (D19).

## 12. Plan

<!-- Filled by /roman-plan. The sketch below is input to planning, not the plan. -->

| Wave | Work | Gate after |
|---|---|---|
| W0 | **T01 contracts:** Pydantic models, OpenAPI + TS types, pack schema with remediation templates, `expected.yaml`, fixtures + event streams, design tokens | Opus review of the contracts |
| W1 | Web shell + Overview + Findings on fixtures · FastAPI skeleton + DB + seed + tokens · **model spike: CLI evaluator on W1–W3 against v0.9.0** · pack + CELLAR ingest + curated CMF and guidance cache · Wealthpilot compliance docs + FinTechProto prep (human: docs-only commit, `v0.9.0` tag) · `cco audit` CLI skeleton emitting fixture results + a workflow stub on a GitHub runner | **Midpoint:** AC2 + ≥ 2/3 golden findings live from the spike |
| W2 | Finding workspace + viewers + legal drawer + inline review · evaluator + validation/retry in the pipeline · activity events + SSE + live panel · bundle ingestion + hardening + demo bundles | AC3, AC5, AC10, AC11, AC14 |
| W3 | Carry-forward + readiness changes · fix-plan renderer · MCP (4 tools) · `cco audit` / `import` / `export-baseline` + comment rendering · live wiring | AC4, AC6, AC7, AC9, AC12, AC13a |
| W4 | FinTechProto `dev` pushes (fix-plan items) + workflow; human gates: secrets, branch protection, release-PR merge, `v1.0.0` tag · polish, replay, demo-reset, rehearsal | AC13b, final verify |

**Cut order if time runs short:**
1. pgvector "related provisions"
2. AC8b live Légifrance
3. The UI "New release" upload (the seed and CI still work)
4. The persona toggle (inline review stays)

**The activity panel, the fix plan and the CI gate aren't cut.** If live CI fails on the day, show the recorded runs and run AC13a locally.
