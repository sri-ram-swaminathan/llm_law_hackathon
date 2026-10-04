---
title: AI Chief Compliance Officer MVP
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

# AI Chief Compliance Officer MVP

> **Inputs:** `docs/product-brief.md`, the frontend and legal-sources brainstorm, and the alignment decisions of 4 Oct 2026 (this file began as `docs/spec-outline.md`).
> **Decision status:** _agreed_ / _decided_ means locked with Roman; _proposed_ means still open (see §8 and §11).
> **Team brief:** https://claude.ai/artifact/EnnazLhd2cNqiAKS3jxLMA

## 0. Background: brainstorm review

### What holds up and should be locked

- **Product claim:** *"Can this company launch this release? What blocks it, why, and what has to change?"* It's a launch gate, not a legal chatbot.
- **The Finding is the atomic unit.** It links law → obligation → company claim → implementation → remediation. Documents and code are evidence.
- **LegalProvision ≠ Requirement.** We audit requirements, which are derived from provisions.
- **More states than red/green.** The key one is *insufficient evidence*: not finding a problem isn't proof of compliance.
- **Curated scoping, not RAG-based applicability.** Live legal sources supply the official text and citations.
- **One engine, three surfaces:** web UI, MCP and REST/CLI.
- **One company, two releases:** non-compliant → compliant.
- **Vertical slices, starting on fixtures.**

### What changed after review

| # | Change | Why | Status |
|---|---|---|---|
| R1 | **Python backend: FastAPI + PydanticAI, no Mastra.** | Mastra only runs on TypeScript. PydanticAI supports Mistral, returns typed Pydantic output, retries automatically when an output validator raises `ModelRetry`, and streams agent events for the activity layer. One runtime. | agreed |
| R2 | The model returns a **verbatim quote**. The server finds the offsets and line numbers. | LLMs get offsets wrong. A quote can be checked and retried. | proposed |
| R3 | pgvector is used **only for legal provision search**. The audit uses per-requirement *evidence hints*. | Reproducible on stage, one less component on the critical path. | proposed |
| R4 | **One Finding per (requirement × assessment)**, satisfied ones included. | Coverage and the release comparison come straight from the data. | proposed |
| R5 | **Three confidence levels.** Applicability and evidence are computed by rules; only finding confidence comes from the model. | Fewer invented numbers. | proposed |
| R6 | Founder and counsel personas with a **toggle and no authentication**. | Auth never shows in a demo. | proposed |
| R7 | **Fetch a single URL and extract its readable text.** No crawler. | Scope. | proposed |
| R8 | **Live assessment with a replay fallback** of a stored run. | Stage safety. | proposed |
| R9 | **Agent-activity layer:** a live, persisted trace of every agent step, tool call, model call, retry and validation error, linked to the findings it produced. | Shows the agent at work and makes every finding auditable. | agreed |
| R10 | **Demo company = Wealthpilot** (the `FinTechProto` repo), an AI investment advisor for French retail investors. It replaces AcmePay. | It's real code with real, natural compliance gaps. | agreed |
| R12 | **CI release gate moves into V1:** a GitHub Action in FinTechProto runs a CCO assessment on the release PR (`dev → main`) and on `v*` tags. It posts the gate and blockers as a PR comment and a job summary, and fails the check on NOT_READY. | The "red PR turns green" moment is the clearest way to show continuous compliance. It reuses the same REST API, so it's cheap. | agreed |
| R11 | **Fix plan (remediation spec):** after an assessment, generate a Markdown spec from the selected findings. A coding agent can execute it; Claude Code can also pull it over MCP. Then a new release is assessed against it. | Closes the loop between "you're not compliant" and the next release. Wealthpilot v1.0.0 is built from this plan. | agreed |

---

## 1. Problem

Founders launching a regulated product, fintech in particular, don't know which obligations apply to them or whether their policies and code actually meet those obligations. Compliance advice is expensive, generic, and disconnected from what the product actually does.

## 2. Goals / non-goals

**Goals (V1, hackathon)**
- A founder sets up a company, product and release, confirms a regulatory profile, and adds evidence (documents, a URL and code).
- A pre-launch assessment produces a **launch gate** (Not ready / Review required / Ready) from requirements scoped to **EU + France, fintech**.
- Every finding can be traced to **company evidence** (a document span or code lines) and an **official legal citation** (EUR-Lex/CELLAR or Légifrance).
- **Agent activity is visible:** live during a run, and afterwards for each finding.
- Counsel can confirm, override or ask for evidence. The human decision drives the gate.
- Wealthpilot v0.9.0 → v1.0.0 shows blockers resolved.
- A remote MCP endpoint with about six tools, usable from Claude Code (demo extension).
- **CI release gate:** a GitHub Action checks every release PR and tag of the product and blocks the merge when the release is NOT_READY.

**Non-goals (V1):** a GitHub App or OAuth (the Action uploads the code itself), per-commit or per-PR delta analysis for non-release PRs, generalized delta analysis, Operating/Scaling stage workflows ("coming soon" only), a regulator persona, auth/RBAC, countries other than FR, exhaustive legal coverage, chat as a primary surface, and data-room integrations.

## 3. Constraints

- Hackathon timeline: the golden path must be demoable by the halfway point.
- **Backend:** Python 3.12, FastAPI, PydanticAI (Mistral), SQLAlchemy + Postgres + pgvector, official `mcp` Python SDK.
- **LLM:** Mistral only.
  - **Only the models our key has quota for** (checked 4 Oct; medium, small, magistral, large and OCR are at 0 or not in our tier):

    | Role | Model | Quota (req/min) | Checked |
    |---|---|---|---|
    | Evaluator agent (code + documents) | `codestral-latest` | 125 | strict JSON schema ✓, tool calls ✓, CIF finding correct and identical across 2 runs, ~2.5 s |
    | Profile suggestion, remediation wording, chat | `ministral-8b-latest` | 188 | strict JSON schema ✓, tool calls ✓, ~3–4 s |
    | Fallback for either | `open-mistral-nemo` | 188 | same results as ministral |
    | Embeddings | `mistral-embed` | 60 | 1024 dims → `vector(1024)` |

  - **Upgrade path:** all model ids are config values (`CCO_MODEL_EVAL`, `CCO_MODEL_LIGHT`, `CCO_MODEL_EMBED`). If `mistral-medium-latest` gets quota, switching is a one-line change, and the golden eval (AC4) decides whether to keep it.
  - **Consequences of using smaller models, built into the design:**
    - The **model never sets severity**. Severity comes from `Requirement.default_severity`. The small models said "high" for the CIF blocker.
    - The model only chooses the conclusion, the evidence and the reasoning. Prompts are one requirement at a time, with the evidence bundle preloaded.
    - The **quote locator must be tolerant.** About a third of the test quotes joined a Python string that's split across lines (`"…only. " "This is…"`), so they weren't exact substrings. The locator compares against two normalized forms: whitespace collapsed, and string-literal joins and quote characters removed. On no match, it retries the item.
  - **No OCR:** PDFs are converted to text locally (`pymupdf`), and the demo documents are Markdown.
  - The key is in `.env`.
- **Frontend:** React + Vite + TypeScript + Tailwind + shadcn/ui, with a custom design (not the default shadcn look).
- **Process:** SDD. **Opus** plans, specs and verifies; **Sonnet** implements.
- **Legal sources:**
  - CELLAR: public, no key. **Checked 4 Oct:** SPARQL resolves CELEX → work; REST by CELEX returns full XHTML (GDPR Art. 5, MiFID II Art. 4(1)(4) found). The eur-lex.europa.eu web pages return an empty HTTP 202 bot challenge to scripts, so use CELLAR, not EUR-Lex HTML.
  - Légifrance through PISTE OAuth2: credentials in `.env`, but **authentication currently fails**; we need the Client ID and environment (Q8).
  - Legora: downloaded documents are supplementary only, subject to their terms (Q5).

## 4. Current state (grounded @ 05897a0; FinTechProto @ ae1c4e5)

**This repo:** there is no application code. It contains:
- `docs/product-brief.md` and this spec;
- `demo/wealthpilot/v0.9.0/remediation-plan.md`, the golden fix plan;
- the SDD kit (`docs/specs/_kit`) and the six `roman-*` skills under `.claude/skills/`.

So the CCO is built from scratch.

**Demo target `../FinTechProto` (Wealthpilot Phase 1)** is a FastAPI + SQLAlchemy backend with a React (JSX) + Tailwind frontend. It has Mistral JSON-mode recommendations, yfinance prices and JWT auth. The claims this spec relies on, checked against `ae1c4e5`:

| Claim | Where | Status |
|---|---|---|
| Disclaimer says "This is not financial advice" | `backend/app/config.py:10-14 @ ae1c4e5` | verified |
| The system prompt asks for personalised analysis with concrete tickers and percentages | `backend/app/advisor.py:17-26 @ ae1c4e5` | verified |
| The JWT secret falls back to `"dev-secret-change-me"` | `backend/app/config.py:4 @ ae1c4e5` | verified |
| The risk profile has 6 fields, with no knowledge/experience or loss capacity | `backend/app/models.py:29-40`, `backend/app/schemas.py:19-25`, `frontend/src/pages/Onboarding.jsx:26-31 @ ae1c4e5` | verified |
| Profile upsert overwrites in place, with no link to existing analyses | `backend/app/routers/profile.py:12-20 @ ae1c4e5` | verified |
| Only the latest analysis is exposed | `backend/app/routers/advice.py:31-38 @ ae1c4e5` | verified |
| No account deletion endpoint | `backend/app/routers/auth.py @ ae1c4e5` (signup, login, me only) | verified |
| The JWT is stored in `localStorage` | `frontend/src/lib/api.js:3-4 @ ae1c4e5` | verified (not a golden finding) |
| `docs/product.md` describes behaviour and gaps (§9 compliance posture, §10 gaps) | `docs/product.md` | **untracked**: not in `ae1c4e5`; it must be committed before `v0.9.0` |
| No privacy policy, terms or business plan | whole repo | verified; they're written as demo content (§6.9) |
| No CI | no `.github/` | verified |

**External services, checked 4 Oct:** CELLAR works; Légifrance auth fails; the Mistral key only covers the models in §3.

Nothing found contradicts the problem statement.

## 5. Options considered

| Topic | Option | Pick |
|---|---|---|
| Backend runtime | **A. Python + PydanticAI** · B. Python + Mastra sidecar (two runtimes) · C. TS + Mastra (no Python) | **A** (agreed) |
| Applicability | **Curated regulatory map + requirement packs** · vector search over the corpus | Curated |
| Evidence selection | **Evidence hints + bounded agent tools** · embedding search over artifacts | Hints + tools |
| Highlight location | **Quote → server-side lookup** · model returns offsets | Quote |
| Agent shape | **Fixed workflow; one evaluator agent per requirement with a few read-only tools** · free-roaming multi-agent | Workflow |

## 6. Design

### 6.1 Architecture

```
React/Vite web ──REST + SSE──┐
Claude Code ─────MCP─────────┤──▶ FastAPI app (one deployable)
GitHub Action ───REST────────┘      ├─ Assessment workflow (plain async Python)
                                    │    └─ Evaluator agent (PydanticAI + Mistral, read-only tools)
                                    ├─ Activity recorder ── AgentEvent stream (SSE + Postgres)
                                    ├─ LegalKnowledgeProvider
                                    │    ├─ CellarProvider (SPARQL + REST)
                                    │    ├─ LegifranceProvider (PISTE OAuth2)
                                    │    └─ CorpusProvider (cached official texts [+ Legora])
                                    ├─ MCP server (mcp SDK, Streamable HTTP, mounted at /mcp)
                                    └─ Postgres + pgvector
```

### 6.2 Domain model

```
Organization ─┬─ Product ─┬─ RegulatoryProfile
              │           └─ Release ─┬─ Artifact[]
              │                       └─ Assessment[] ─┬─ Finding[] (one per Requirement)
              │                                        │    ├─ EvidenceRef[] · citations → LegalProvision[]
              │                                        │    ├─ Confidence · Remediation[] · Review[]
              │                                        │    └─ produced_by → AgentEvent[]
              │                                        └─ AgentRun ─ AgentEvent[]
LegalSource ─ LegalDocument ─ LegalProvision ◀─ derived_from ─ Requirement (RequirementPack)
```

| Entity | Key fields |
|---|---|
| `RegulatoryProfile` | `jurisdictions`, `industry`, `activities[]` (e.g. `investment_advice`, `portfolio_analytics`), `customer_types[]` (`retail`), `data_categories[]` (`identity`, `financial`), `ai_uses[]` (`personalised_recommendations`), `stage`, `confirmed_at` |
| `Release` | `version`, `stage`, `source_ref` (git commit for code), `previous_release_id?` |
| `Artifact` | `kind` (`business_plan\|product_spec\|privacy_policy\|terms\|security_policy\|regulatory_registration\|website\|code_repo\|other`), `source` (`upload\|url\|repo_path`), `text`, `files[]`, `status` |
| `LegalProvision` | `id`, `source`, `jurisdiction`, `act_title`, `celex\|legi_id`, `article`, `paragraph?`, `text`, `source_url`, `retrieved_at` |
| `Requirement` | `id`, `domain`, `statement`, `derived_from[]`, `applies_when`, `mandatory`, `default_severity`, `evidence_hints{artifact_kinds[], code_globs[]}`, `evidence_needed` |
| `Assessment` | `release_id`, `status`, `pack_version`, `model`, `run_id`, timestamps |
| `Finding` | `requirement_id`, `conclusion`, `severity`, `title`, `reasoning_summary`, `evidence[]`, `citations[]`, `confidence{applicability, evidence, finding}`, `remediation[]`, `attempts`, `validation_notes[]` |
| `EvidenceRef` | `document_span{artifact_id, quote, start, end}` · `code{artifact_id, path, start_line, end_line, quote}` · `missing{artifact_kind}` |
| `Review` | `finding_id`, `reviewer_name`, `decision` (`confirm\|override\|need_evidence\|not_applicable`), `override_conclusion?`, `override_severity?`, `comment`, `created_at` |
| `AgentRun` | `id`, `kind` (`assessment\|profile_suggest\|mcp\|chat`), `subject_id`, `status`, `started_at`, `finished_at`, `totals{model_calls, tool_calls, retries, tokens_in, tokens_out}` |
| `AgentEvent` | `run_id`, `seq`, `ts`, `type` (see §6.10), `step`, `requirement_id?`, `agent?`, `tool?`, `attempt?`, `summary`, `input_preview?`, `output_preview?`, `tokens?`, `latency_ms?`, `error?` |

### 6.3 Status model and launch gate (deterministic)

- `conclusion`: `satisfied | potential_violation | insufficient_evidence | not_applicable | uncertain`
- `severity`: `blocker | high | medium | low`
- **Effective value:** the latest review override if there is one, otherwise the AI value. The AI's values are never changed after the fact.

```
gate(release) =
  NOT_READY        if any effective (potential_violation ∧ blocker)
                   or any mandatory requirement effectively insufficient_evidence
  REVIEW_REQUIRED  else if any effective (potential_violation ∧ high) or any unreviewed uncertain finding
  READY            otherwise
```

### 6.4 Assessment pipeline

| # | Step | Done by | Activity events |
|---|---|---|---|
| 1 | Load the profile and artifacts | code | `step_*` |
| 2 | **Scope:** `applies_when` predicates → requirements | code | `scope_result` (n requirements, per domain) |
| 3 | **Resolve the legal basis** (`derived_from` provisions) | LegalKnowledgeProvider | `tool_call`/`tool_result` per fetch (source, cache hit/miss) |
| 4 | **Collect evidence** by hints | code | `evidence_bundle` (artifacts, files, missing kinds) |
| 5 | **Evaluate** each requirement | **PydanticAI evaluator agent** (`output_type=FindingCandidate`) with read-only tools: `read_artifact(artifact_id, section?)`, `grep_code(pattern, glob?)`, `read_file(path, start, end)`, `get_provision(id)`. **Max 6 tool calls per requirement.** | `model_request`, `tool_call`, `tool_result`, `model_response` |
| 6 | **Validate** in the `@output_validator`. On failure, raise `ModelRetry(errors)` so PydanticAI retries with the errors (`output_retries=2`). | code | `validation_failed`, `retry` |
| 7 | On final failure, persist `uncertain` with `validation_notes` | code | `finding_emitted` |
| 8 | **Synthesize** the gate and coverage | code | `gate_computed` |

**Validation rules:** the schema is enforced by PydanticAI and Mistral structured output. In addition: `requirement_id` matches; citations ⊂ `derived_from`; artifact ids belong to the release; every quote is found in its artifact (two normalized forms, see §3; fuzzy match ≥ 0.9); code lines exist and contain the quote; `potential_violation`/`satisfied` need at least one real evidence ref; `insufficient_evidence` needs a `missing` ref.

**Run settings:** requirements are evaluated with bounded concurrency (4), `temperature=0`, and the model id comes from config.

### 6.5 Legal knowledge layer

```python
class LegalKnowledgeProvider(Protocol):
    async def get_provision(self, ref: ProvisionRef) -> LegalProvision: ...
    async def get_document(self, doc_id: str) -> LegalDocument: ...
    async def search(self, q: LegalQuery) -> list[LegalProvision]: ...   # corpus + pgvector
```

- **Pack:** `data/packs/fintech-eu-fr.yaml`, about 25 requirements across data protection, investment services, AI transparency, ICT security and consumer disclosures. Authored by us and reviewed by a legal teammate.
- **Ingest script:** for each provision ref in the pack, fetch it from CELLAR or Légifrance → split it by article and paragraph → embed it → store it. A cached copy is committed to `data/corpus-cache/` so the demo works offline.
- Official sources are the citation authority.

### 6.6 Evidence ingestion

| Input | Handling |
|---|---|
| PDF | local text extraction (`pymupdf`) → markdown; scanned PDFs are out of scope (no OCR quota) |
| MD / TXT | stored as-is |
| URL | single fetch + readability extraction |
| Code | ZIP upload, or a server-side `repo_path` + git ref (used for the demo: `FinTechProto@<sha>`) |

Out of scope: images, spreadsheets, Drive, Notion, data rooms, GitHub OAuth.

### 6.7 Frontend

**User journeys → pages**

| Journey | Persona | Path through the pages |
|---|---|---|
| A. Define what we're launching | Founder | Onboarding: Company → Product → Profile (AI suggests, user confirms) → Evidence |
| B. Can I launch? | Founder | Overview → **Run assessment** → **live agent activity** → gate + blockers |
| C. Investigate a blocker | Founder | Finding workspace → document highlight ↔ code lines ↔ legal drawer ↔ **"How this was produced"** |
| D. Counsel review | Counsel | Reviews queue → Finding → decision → gate updates |
| H. Release gate in CI | Developer | Push fixes to `dev` → open release PR `dev → main` → **CCO check** runs → PR comment shows gate, blockers and a link to the CCO → fix → check turns green → merge + tag `v1.0.0` → the release appears in the CCO with `source: ci` |
| G. Fix and re-release | Founder → Developer | Findings (multi-select) → **Generate fix plan** → copy as a Claude Code prompt / download `.md` / MCP `get_remediation_plan` → code fixed → **New release** (git ref) → Run assessment → "What changed" |
| E. Show progress | Founder | Release switcher v0.9.0 → v1.0.0 → "What changed" |
| F. Developer check | Developer | Claude Code → MCP; the calls show up in Activity |

**Routes** (everything under `/o/:org/p/:product/r/:release`):

| Route | Page |
|---|---|
| `/onboarding` | Stepper |
| `…/overview` | Gate card, coverage by domain, top blockers, "What changed", latest run summary |
| `…/evidence`, `…/evidence/:artifactId` | Evidence room; document or code viewer with highlights |
| `…/findings`, `…/findings/:findingId` | List with filters; **three-pane workspace** with tabs: *Finding · Legal basis · How this was produced* |
| `…/reviews` | Counsel queue |
| `…/fix-plan` | Fix-plan builder: chosen findings, preview, target switch (*Coding agent* / *Founder checklist*), copy / download |
| `…/activity`, `…/activity/:runId` | **Agent activity:** runs list (assessment, MCP, chat) and the run timeline |
| `…/releases` | Release list and compare |

**Global elements:** context header with the release switcher, stage pill, **Run assessment** button and persona toggle; legal-basis drawer; ⌘K palette; stretch **Ask CCO** drawer (assistant-ui → `/api/assistant`).

**Design language:** restrained (Linear/Stripe feel). One accent color; everything else colored by status meaning. Effort goes on the release-switch transition, the live activity timeline, highlight ↔ finding linking, and the drawers. A short design-tokens spec (`docs/design.md`) gets written before any UI task.

### 6.8 Surfaces

- **REST** (`/api`, OpenAPI generated by FastAPI; frontend types generated with `openapi-typescript`):
  - Setup: `POST /organizations` · `POST /organizations/{id}/products` · `PUT /products/{id}/profile` · `POST /products/{id}/profile/suggest` · `POST /products/{id}/releases` · `GET /releases/{id}`
  - Evidence: `POST /releases/{id}/artifacts` (multipart) · `POST /releases/{id}/artifacts/url` · `POST /releases/{id}/artifacts/repo` · `GET /artifacts/{id}`
  - Assessment: `POST /releases/{id}/assessments` → 202 · `GET /assessments/{id}` · `GET /releases/{id}/readiness` · `GET /assessments/{id}/findings` · `GET /findings/{id}` · `POST /findings/{id}/reviews`
  - Activity: `GET /runs?release_id=` · `GET /runs/{id}` · `GET /runs/{id}/events` (SSE, replays persisted events and then streams live ones) · `GET /findings/{id}/trace`
  - Fix plan: `POST /assessments/{id}/remediation-plans` (body: `finding_ids?`, `min_severity?`, `target: coding_agent|founder`) → `{id, markdown, items[]}` · `GET /remediation-plans/{id}` · `GET /remediation-plans/{id}.md`
  - Other: `GET /provisions/{id}` · `GET /releases/{a}/compare/{b}` · `POST /assistant/messages` (stretch)
- **MCP** (`/mcp`, Streamable HTTP, static bearer token): `get_product_profile`, `get_release_readiness`, `list_findings`, `get_finding`, `get_legal_basis`, `run_assessment`, `get_remediation_plan(release_id, min_severity?, scope?)`. Stretch: `assess_change`. Every call is recorded as an `AgentRun(kind=mcp)`.
- **CI** (see §6.12): `POST /ci/assessments` (multipart: repo ZIP, compliance documents, metadata) → `{assessment_id, release_id, url}`; then poll `GET /assessments/{id}`. Authenticated with a per-product **CI token** (`Authorization: Bearer`), which is the only real auth in V1.

### 6.9 Demo dataset: Wealthpilot (FinTechProto)

**Wealthpilot:** a French startup giving retail investors AI-generated, personalised portfolio recommendations (Mistral), from a risk questionnaire and holdings they enter by hand. No trade execution. Pre-launch in France.

**Releases** (branch model in §6.12):
- **v0.9.0** = `main`, tagged `v0.9.0`. It includes `compliance/business-plan.md` and `compliance/terms.md`, and has no privacy policy on purpose.
- **v1.0.0** = `dev`, which accumulates the fix-plan commits, merged through the release PR and tagged `v1.0.0`. It adds `compliance/privacy-policy.md` and `compliance/cif-registration.md` and updates `terms.md`.

**Demo documents** live **in the FinTechProto repo** under `compliance/`, so CI sees the code and documents together. `README.md` and `docs/product.md` are also evidence. `docs/product.md` is currently untracked and has to be committed to `main` before tagging `v0.9.0`.

**Golden findings** (legal references to be verified by a legal teammate):

| ID | Requirement (legal basis) | Evidence in v0.9.0 | v0.9.0 expected | v1.0.0 fix → expected |
|---|---|---|---|---|
| W1 | Personalised investment advice requires an authorised status: CIF registered with ORIAS (MiFID II Art. 4(1)(4); CMF L.541-1, L.546-1) | `config.py` disclaimer says "not financial advice", while the `advisor.py:17-26` system prompt asks for personalised buy/sell calls with tickers and percentages; README "check whether CIF is required" | 🔴 blocker | CIF registration doc + accurate status wording in UI and terms → 🟢 |
| W2 | Suitability assessment covers knowledge and experience, financial situation including ability to bear losses, and objectives (MiFID II Art. 25(2); Del. Reg. 2017/565 Art. 54) | The onboarding questionnaire (6 questions) has no knowledge/experience or loss-capacity questions | 🔴 blocker | Questions added and passed to the advisor, which refuses advice when the product isn't suitable → 🟢 |
| W3 | Pre-contractual information on processing (GDPR Art. 13) | No privacy policy provided | 🔵 insufficient_evidence (mandatory → NOT_READY) | Privacy policy added → 🟢 |
| W4 | Advice based on up-to-date client information (Del. Reg. 2017/565 Art. 54(7)) | Profile edits don't invalidate the existing analysis (`product.md` §3, §10) | 🟠 high | Analysis flagged outdated on profile change → 🟢 |
| W5 | Right to erasure (GDPR Art. 17) | No account deletion (`product.md` §10) | 🟠 high | `DELETE /api/account` + UI → 🟢 |
| W6 | Security of processing (GDPR Art. 32) | `config.py` falls back to `JWT_SECRET="dev-secret-change-me"` | 🟠 high | App refuses to start without a secret → 🟢 |
| W7 | Suitability report given to the client (MiFID II Art. 25(6)) | Past analyses are stored but can't be viewed | 🟡 medium | Analysis history page → 🟢 |
| W8 | Transparency for AI interacting with people (AI Act Art. 50) | AI-generated content is labelled in the UI, but this is no chatbot | ◌ uncertain → counsel decides on stage | carried forward |

v0.9.0 → **Not ready** (2 blockers, 1 mandatory requirement missing evidence, 3 high). v1.0.0 → **Ready**.

### 6.10 Agent-activity layer

**Event types:** `run_started`, `step_started`, `step_finished`, `scope_result`, `evidence_bundle`, `model_request`, `model_response`, `tool_call`, `tool_result`, `validation_failed`, `retry`, `finding_emitted`, `gate_computed`, `run_finished`, `run_failed`.

**How events are recorded:** a single `ActivityRecorder` writes events to Postgres and publishes them to an in-process pub/sub that feeds the SSE stream.
- The workflow emits step events.
- PydanticAI agent runs are wrapped by iterating the agent graph (`agent.iter()`) and mapping each node and tool call to events.
- MCP handlers emit events through a decorator.

**Data hygiene:** previews are capped at 2 KB, and secrets and `.env` values are never logged.

**UI:**
- **Live run panel:** opens when Run assessment is clicked. A vertical timeline grouped by step, then by requirement. Each tool call is a row with tool name, short args, latency and status, and it expands to show the input and output JSON. Retries show in amber with the validator's errors. A header shows counters (requirements done / total, model calls, tool calls, retries, tokens, elapsed) and a step progress bar.
- **Finding → "How this was produced":** the same timeline, filtered to the finding's `requirement_id`, so you can follow the evidence the agent read and the provision it pulled.
- **Activity page:** the history of runs, including MCP calls from Claude Code.
- **Replay mode:** plays back a stored run's events at their recorded timing. This is the same stream, which is why the fallback stays honest.

### 6.11 Fix plan (remediation spec)

**Purpose:** turn the open findings of an assessment into a spec that a coding agent or a developer can act on without re-reading the whole assessment. It's the bridge from one release to the next.

**Model:** `RemediationPlan{id, assessment_id, release_id, target, created_at, items[], markdown}`. Each `RemediationItem` has:
- `finding_id`, `requirement_id`, `severity`
- `kind`: `code | document | organisational`
- `problem`
- `legal_basis`: citations with `source_url`
- `locations`: `path:line` ranges and document quotes
- `required_change`
- `done_when`: observable checks; the last one is always "re-assessment marks `<requirement_id>` satisfied"
- `boundaries`: files the change may touch, and what must not change

**Generation:** mostly deterministic. The plan is templated from the findings (problem, locations, legal basis and done-when come straight from validated data). One PydanticAI call per item writes `required_change`, with typed output (`RemediationDraft`) and the same validator: it may only reference the finding's locations. No new legal claims are made in the plan.

**Markdown layout** (target `coding_agent`):
1. Context: product, release, assessment id, gate.
2. Rules for the agent:
   - Fix only the listed items.
   - Touch only the files under each item's boundaries.
   - Add or adjust tests.
   - Don't change unrelated behaviour.
3. One section per `code` item, ordered blocker → high → medium.
4. An appendix listing the `document` and `organisational` items, for information only; the agent doesn't do these.
5. How to verify: create a new release in the CCO and run an assessment, or call MCP `run_assessment`.

**Target `founder`:** a plain checklist of the same items, grouped by kind.

**Golden example:** `demo/wealthpilot/v0.9.0/remediation-plan.md`. It's what the v1.0.0 branch of FinTechProto is built from.

### 6.12 CI release gate

**Idea:** compliance documents live in the product repo next to the code (`compliance/` folder: business plan, terms, privacy policy, registrations). Every release candidate is assessed as a whole, code and documents together, and the result gates the merge.

**In the product repo (FinTechProto):**
- `compliance/cco.yaml`: `product_id`, `api_url`, the list of document paths and their artifact kinds, code include/exclude globs.
- `.github/workflows/compliance.yml`:
  - **Triggers:** `pull_request` to `main` (the release PR from `dev`), `push` of tags `v*`, and `workflow_dispatch`.
  - **Steps:**
    1. Check out the code.
    2. Zip the code (respecting the globs).
    3. Run `scripts/cco_check.py` (stdlib only, ~100 lines). It uploads the ZIP, the documents, the version (tag, or the `version` file on a PR) and the git SHA.
    4. The script polls the assessment until it finishes (timeout 10 min), writes `$GITHUB_STEP_SUMMARY`, and posts or updates a single PR comment with `gh`.
    5. The script exits: `NOT_READY` → 1 (check fails); `REVIEW_REQUIRED` → 0 with a warning annotation; `READY` → 0.
- **Secrets:** `CCO_API_URL` and `CCO_CI_TOKEN`. The Mistral key stays on the CCO server and never goes to CI.

**PR comment / summary format:**
```
CCO compliance check · v1.0.0-rc (a1b2c3d) · ❌ NOT READY
2 blockers · 1 missing evidence · 3 high · 27 requirements evaluated
🔴 FR-SUITABILITY-01  Suitability assessment incomplete   backend/app/schemas.py:19
🔴 FR-CIF-STATUS-01   Wording contradicts advice given     backend/app/config.py:10
🔵 GDPR-INFO-01       No privacy policy in compliance/
Changes since v0.9.0: 3 resolved · 0 new
→ Full report · Fix plan (.md)   [links to the CCO UI]
```
The fix plan for the failing release is attached as a workflow artifact, so a developer or Claude Code can pick it up right away.

**In the CCO:**
- CI runs create a `Release` with `source: ci`, `git_sha`, `branch`, `pr_number` and `ci_run_url`.
  - A run for a PR creates a release candidate (`v1.0.0-rc.N`).
  - A tag promotes the candidate to `v1.0.0`.
- The release list shows the CI badge and its history.
- The activity page shows the CI runs like any other run.

**Demo branch model (FinTechProto):**
- `main` @ `ae1c4e5`, tagged `v0.9.0`.
- `dev` accumulates the fix-plan commits in two batches:
  1. Items 3–6 and A2–A3 → the release PR is still **red** (the two blockers remain).
  2. Items 1–2 and A1 → **green**.
- Merge, then tag `v1.0.0`.
- Recorded run URLs of both checks are kept as a stage fallback.

**Requirement:** the CCO API has to be reachable from GitHub. Either deploy it (Q3), or use a tunnel (`cloudflared`) during the demo.

## 7. Interfaces and contracts (frozen by the first task, T01)

| Contract | Location | Consumers |
|---|---|---|
| Domain + API models (Pydantic) | `backend/app/contracts/*.py` | API, workflow, MCP |
| OpenAPI document (exported) | `contracts/openapi.json` | frontend types (`openapi-typescript`), CLI |
| Agent output models (`ProfileSuggestion`, `FindingCandidate`) | `backend/app/contracts/ai.py` | evaluator agent |
| `AgentEvent` schema + SSE envelope | `backend/app/contracts/activity.py` | recorder, web, MCP |
| `LegalKnowledgeProvider` protocol | `backend/app/legal/base.py` | providers, workflow, MCP |
| MCP tool signatures | `backend/app/mcp/tools.py` (typed) | MCP server |
| Requirement pack schema | `data/packs/schema.json` | pack, scoper |
| Fixtures: Wealthpilot v0.9/v1.0 assessments **+ recorded event streams** | `contracts/fixtures/*.json` | web (slice 1), replay, tests |
| Golden expectations | `demo/wealthpilot/expected.yaml` | eval, acceptance |

Layout: `backend/`, `frontend/`, `contracts/`, `data/packs/`, `data/corpus-cache/`, `demo/wealthpilot/`, `docs/specs/`.

## 8. Decisions

| # | Decision | Status |
|---|---|---|
| D1 | Python: FastAPI + PydanticAI + `mcp` SDK; no Mastra | agreed |
| D2 | EU + France, fintech, ~25 curated requirements | agreed |
| D3 | Finding = one per requirement × assessment | proposed |
| D4 | Quote-based evidence location | proposed |
| D5 | Deterministic gate; the human review decides, the AI result is kept for provenance | proposed |
| D6 | Official sources are the citation authority | proposed |
| D7 | MCP mounted on the same app; CI via REST | agreed |
| D14 | CI release gate in V1: a GitHub Action uploads code + `compliance/` documents; per-product CI token; `dev → main` release PR flow | agreed |
| D8 | Persona toggle, no auth | proposed |
| D9 | Live run with an event-replay fallback | proposed |
| D10 | React + Vite + TS + Tailwind + shadcn; assistant-ui only for the stretch chat | agreed |
| D11 | Agent-activity layer as a first-class feature | agreed |
| D12 | Demo company Wealthpilot; v1.0.0 on the `release/v1.0.0` branch | agreed |
| D13 | Fix plan as a first-class output (UI, REST, MCP); v1.0.0 built from it | agreed |

## 9. Acceptance criteria

- **AC1 Contracts:** models import, OpenAPI is exported, fixtures validate, and frontend types are generated without diff. · `make contracts-check`
- **AC2 Golden path on fixtures:** Wealthpilot v0.9.0 shows **Not ready** with 2 blockers and 1 needs-evidence item, and you can click through to a finding. · Playwright `golden-path.spec.ts`
- **AC3 Traceability:** every `potential_violation`/`satisfied` finding has an evidence ref that resolves and a citation with a `source_url`. · `pytest tests/test_traceability.py`
- **AC4 Golden eval:** a live v0.9.0 run matches W1–W7 in ≥ 4 of 5 runs; v1.0.0 is Ready in ≥ 4 of 5. · `python -m cco.eval wealthpilot --runs 5`
- **AC5 Validation and retry:** with a scripted model (PydanticAI `FunctionModel`) returning a bad quote and then valid output, the finding is persisted after one retry, with a `retry` event. Three bad outputs → `uncertain` with no dangling references. · `pytest tests/test_validation.py`
- **AC6 Human review:** counsel `not_applicable` on W8 changes the effective conclusion and the gate, and the AI result is still kept. · `pytest tests/test_review.py`
- **AC7 Release compare:** v0.9.0 → v1.0.0 lists W1–W7 as resolved. · API test + Playwright
- **AC8 Legal providers:** CELLAR returns GDPR Art. 5 for CELEX `32016R0679`; Légifrance returns CMF L.541-1 once credentials work; the cache serves both offline. · `pytest -m integration`
- **AC9 MCP:** an MCP client lists 6 tools; `list_findings(severity="blocker")` on v0.9.0 returns W1–W2; the call appears as an `AgentRun(kind=mcp)`. · `pytest tests/test_mcp.py`
- **AC10 Agent activity:** an assessment produces ordered events covering every step. The SSE stream delivers them live and replays them for a finished run. Every finding's trace has at least one `model_request` and one `finding_emitted`. · `pytest tests/test_activity.py` + Playwright
- **AC12 Fix plan:**
  - For v0.9.0, the coding-agent plan contains one item per open code finding (W2, W4, W5, W6, W7), plus W1's dependent code item. Each has ≥ 1 `path:line` location that exists at the release's commit, a legal citation, and a `done_when`.
  - W1's organisational part and W3 appear in the appendix only.
  - MCP `get_remediation_plan` returns the same Markdown.
  - · `pytest tests/test_remediation.py`
- **AC13 CI gate:**
  - On a release PR `dev → main` in FinTechProto, the `compliance` check fails for the partial-fix state and passes for the full-fix state.
  - Each run posts one updated PR comment listing the open blockers with `path:line`.
  - The run appears in the CCO as a `source: ci` release with the PR link.
  - A `v1.0.0` tag produces release `v1.0.0` with gate READY.
  - · GitHub run links recorded in `evidence/`, plus `pytest tests/test_ci_api.py` (CI endpoint with the token, ZIP + documents ingestion)
- **AC11 Ingestion:** PDF, MD, URL and repo-path inputs produce viewable text with highlights. · Playwright

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Légifrance auth not working | Fix the credentials (Q8); the corpus cache serves French provisions behind the same interface |
| Model variance on stage | `temperature=0`, sharp gaps in the demo data, golden eval, event replay |
| Small models (Codestral, Ministral 8B) miss subtle findings | Severity set by rules; one requirement per prompt; evidence preloaded; the golden eval gates the demo; switch to medium if quota arrives |
| Agent tools make runs slow or unpredictable | Evidence bundle preloaded; max 6 tool calls; concurrency 4 |
| Quote matching on OCR'd PDFs | Demo documents in MD; normalization; fuzzy threshold |
| Mistral rate limits | Concurrency cap, stored runs, replay |
| Too much time on SDD documents | One SPEC + task files; contracts are code (Pydantic), not prose |

## 11. Open questions

1. ~~Q1 Backend runtime~~ → Python + PydanticAI (agreed).
2. ~~Q2 Demo company~~ → Wealthpilot (agreed). Who verifies the legal references in §6.9?
3. **Q3 Deployment (now blocking for CI):** GitHub has to reach the CCO API. Deploy the app (Railway, Fly or Render, with Neon or Supabase Postgres + pgvector), or run it locally behind a `cloudflared` tunnel for the demo?
4. **Q4 Stage mode:** live by default with a replay toggle?
5. **Q5 Legora:** do their terms allow indexing the downloaded documents?
6. **Q6 Owners:** who owns contracts, web, pipeline, legal pack and demo documents?
7. **Q7 Product name.**
8. **Q8 Légifrance:** the PISTE **Client ID**, the environment (sandbox or production), and confirmation that the Légifrance API is subscribed on that app.

## 12. Plan

<!-- Filled by /roman-plan. The sketch below is input to planning, not the plan. -->

| Wave | Tasks (parallel within a wave) | Gate after |
|---|---|---|
| W0 | **T01 contracts:** Pydantic models, OpenAPI export, TS types, fixtures + recorded event streams, pack schema, `expected.yaml` | Opus review |
| W1 | Web shell + Overview + Findings on fixtures · FastAPI skeleton + DB + seed · Wealthpilot demo documents + v1.0 branch · pack + CELLAR/Légifrance providers + cache | **Midpoint:** golden path clickable on fixtures (AC2) |
| W2 | Finding workspace + viewers + legal drawer · evaluator agent + validation/retry · activity recorder + SSE + live run panel · ingestion | AC3, AC5, AC10 |
| W3 | Reviews + persona toggle · fix plan (API, UI, MCP) · release compare · MCP · live wiring | AC4, AC6, AC7, AC9, AC12 |
| W4 | CI endpoint + token · FinTechProto `compliance/` folder + workflow + `cco_check.py` · `dev` branch in two batches · deploy or tunnel · polish, replay, rehearsal | AC13 · final verify |

Cut order if time runs short: Ask CCO chat → `assess_change` → ZIP upload → live Légifrance (keep the cache) → compare view (keep the switcher). **The activity panel isn't cut.** It is part of the core demo. If live CI is at risk on the day, show the recorded red and green GitHub runs, and run `cco_check.py` locally against the CCO.
