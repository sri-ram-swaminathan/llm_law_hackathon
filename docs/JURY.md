# CCOmmit: guide for the jury

CCOmmit is an AI Chief Compliance Officer for startups. It reads a company's documents and its code, checks both against EU and French law, and returns a launch gate: **Not ready**, **Review required** or **Ready**. Every finding quotes the company's own text or code lines next to the official legal text.

The demo company is **Wealthpilot**, a fictional French robo-adviser. Its code and documents live in a separate public repo, [RomanGrebnev/FinTechProto](https://github.com/RomanGrebnev/FinTechProto). Release v0.9.0 has real compliance flaws; v1.0.0 fixes them.

> AI pre-assessment, not legal advice. Every company detail in the demo is invented.

## What you can do without installing anything

| What | Where |
|---|---|
| See the release check on GitHub: a PR that fails with inline review comments on the faulty code lines | [PR #4](https://github.com/RomanGrebnev/FinTechProto/pull/4) and its [CI run](https://github.com/RomanGrebnev/FinTechProto/actions/runs/37211428322) |
| See the same check pass after the fixes ("7 resolved · 0 new") | [green run](https://github.com/RomanGrebnev/FinTechProto/actions/runs/37211288280) |
| Browse every compliance run | [Actions → compliance](https://github.com/RomanGrebnev/FinTechProto/actions/workflows/compliance.yml) |
| Read the code | this repo: `backend/` (Python engine, API, CLI, MCP) and `frontend/` (React app) |
| Read how it was specified and built | `docs/specs/2026-10-04-cco-mvp/`: spec, design, tasks, evidence for each task |

## Run it locally (about 5 minutes)

**You need:** Docker Desktop, git, and ports 20000–20002 free. A [Mistral API key](https://console.mistral.ai/) is optional; it's only needed for the live runs.

```bash
git clone https://github.com/sri-ram-swaminathan/llm_law_hackathon.git
cd llm_law_hackathon
cp .env.example .env          # then put your key in MISTRAL_API_KEY= (optional)
make up                       # or: docker compose -p sdd-cco-mvp up -d --build --wait
```

Open **http://127.0.0.1:20001**. The app asks for an access token once: enter `dev-token`.

The API runs at http://127.0.0.1:20000, with its interactive docs at `/docs`. Stop everything with `make down`.

On start, the app loads a **recorded snapshot of three real runs** (v0.9.0, 1.0.0-rc, v1.0.0), so every screen has data right away.

## A 3-minute tour

1. **Home.** Wealthpilot SAS → the Wealthpilot product card. Click **Start demo** to run a live analysis of v0.9.0. It needs a Mistral key; see below.
2. **Summary of v0.9.0.** The gate is **Not ready**. The value line says what was checked, against which laws and how fast. Risks are grouped by category: licensing, suitability, data protection, AI transparency.
3. **Risks → W1.** The compliance check view: the company's own words and code on the left, the verdict in the middle, the law (MiFID II, Code monétaire et financier) with official links on the right.
4. **Documents.** The business plan and product guide shown in full, with every risk highlighted and explained in the margin. Missing documents (terms, privacy policy, CIF registration) are listed, with **Add** to upload one and re-assess.
5. **Fix plan.** A deterministic list of fixes, with "Copy as Claude Code prompt" for a coding agent.
6. **Counsel** (top-right switch). A separate review mode: a queue of unreviewed findings, then confirm, override or not applicable with a note, plus a preview of how each decision changes the gate.
7. **Version picker → v1.0.0.** **Ready**, and "What changed" against v0.9.0.

## What works for you, and what doesn't

| Feature | Works for you? | Notes |
|---|---|---|
| Browse the recorded runs, documents, law texts, fix plans | ✅ always | No key needed. |
| Counsel review: decisions change the gate and carry to later releases | ✅ always | |
| **Start demo / Re-run / Add document** (a live AI run) | ✅ with `MISTRAL_API_KEY` | About 15–60 s on `codestral-latest`. Without a key the run fails, and the app offers "Show the recorded run". |
| **Reset demo** (the small link under Start demo) | ✅ always | Restores the recorded snapshot. Restarting the API also restores it. |
| Upload your own release (a zip of code plus `compliance/*.md`) | ✅ with a key for the assessment | Releases page in the product home. Bundles live in `demo/wealthpilot/*/upload/`. |
| **Run on GitHub** button | ❌ for most jurors | It re-runs the check on FinTechProto through the GitHub API, so it needs `GITHUB_TOKEN` with write access to that repo (collaborators only). The button stays hidden without it. Use the public run links above instead. |
| The GitHub check on your own fork | ⚠️ possible | Fork FinTechProto, enable Actions, add secrets `MISTRAL_API_KEY` and `CCOMMIT_REPO_TOKEN` (any GitHub token works, because this repo is public), then open a PR from `demo/step1` to `demo/base`. Commands are in FinTechProto's `docs/g3-commands.md`. |
| MCP server for Claude Code (4 read tools) | ✅ | See `docs/mcp.md`. |
| Live Légifrance API | ❌ | The French articles (CMF L541-1, L546-1) are curated from Légifrance and cached. EU texts come from EUR-Lex / CELLAR and are cached too. |

## How it works

The short version:

- **Six-step pipeline:** ingest → index → scope → evaluate → validate → gate. Only the evaluate step uses a model.
- **Severity never comes from the model.** It comes from a hand-written requirement pack (10 requirements derived from 18 legal provisions).
- **The gate rule is plain code.** The model never decides it.
- **Quotes are checked against the files.** Every quote the model returns must be found in the company's files, or it is rejected and retried.
- **Two search indexes, both built with `mistral-embed`:** a legal index of 704 chunks (GDPR, MiFID II, Delegated Reg. 2017/565, the AI Act, the CMF and regulator guidance) and a per-release company index.

There's a diagram version: [Inside CCOmmit](https://claude.ai/artifact/Lq6HfpkzW2F6eqthXMvxAb).

## Known limits

- **Model variance:** the model can flip about 1 requirement in 10 between runs. The recorded snapshot holds runs that matched the expected results 10/10.
- **One run at a time per product.** A second click while a run is going gets "a run is already in progress".
- **Scope of the demo:** one organisation and one product, EU + France, fintech only. There are no user accounts; one shared access token.

## Troubleshooting

- **Port already in use.** Free ports 20000–20002, or change them in `docker-compose.yml`.
- **The app shows no data.** Click **Reset demo to recorded snapshot** on the home page.
- **Without Docker:** `make dev` runs the API with uv and the web app with pnpm. See `docs/run.md`.
