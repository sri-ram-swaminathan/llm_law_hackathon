# Preflight — cco-mvp

## Branching (restated by the agent, confirmed by a human)

- Base branch: `dev` (created 4 Oct as a copy of `main` @ e6dd44c, at Roman's request), taken from origin, never pushed to, merged into or tagged by the agent.
- Integration branch: `ft/cco-mvp`, created off `dev` (it already descends from it). Task branches `ft/cco-mvp-<id>` come off it and merge back with `--no-ff` after verification.
- Final step: a PR from `ft/cco-mvp` to `dev`, merged by a human per the repo's review rules.
- Pushing: per the SPEC `push` setting; never `--force` on the integration branch.
- Repo-specific rules:
  - **This repo** (`sri-ram-swaminathan/llm_law_hackathon`): has no `CLAUDE.md`, so there are no extra branch, PR-target or reviewer rules. PRs go to `dev` (then `dev` → `main` by a human), and a human reviews and merges them. `ft/cco-mvp` has no upstream set, so a plain `git push` can't reach `main`.
  - **Commit trailer** (from the session's attribution rule): `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR bodies end with the Claude Code line.
  - **Second repo** `../FinTechProto` (`RomanGrebnev/FinTechProto`): base `main`, same integration branch `ft/cco-mvp`, added in `/roman-plan`.
    - The demo flow needs a `v0.9.0` tag on its `main`, a `dev` branch, a release PR `dev → main`, and a `v1.0.0` tag.
    - Those touch FinTechProto's base, so each is a **gate task done by a human**, never by an agent.
  - **Never committed:** `.env` (holds the Mistral and PISTE secrets).
- Confirmed by: Roman Grebnev, 2026-10-04

## Access and environment

<!-- sdd:access:start -->
_Checked 2026-10-04 14:46 by `sdd preflight`. Values are never shown._

| Need | Status | Detail | Tasks |
|---|---|---|---|
| `git-clean` | warn | uncommitted changes in . | — |
| `gh` | ok | gh authenticated | G1, G3, G4 |
| `docker` | ok | docker 28.4.0, 4 containers running (not ours unless labelled) | V2, VA |
| `disk` | ok | 67.6 GiB free | — |
| `env:MISTRAL_API_KEY@.env` | ok | MISTRAL_API_KEY set in .env (value not shown) | T04, T06, V2, VA |
| `cmd:uv` | ok | uv on PATH | T01, T03, T04, T05, T06, T07, T10, T11, T12, T13, T14, T15, T16, T18, V2, VA |
| `cmd:pnpm` | ok | pnpm on PATH | T01, T02, T08, T09, T17, T19, V2, VA |
<!-- sdd:access:end -->

## Blockers and waivers

- `env:LEGIFRANCE_CLIENT_ID` / `env:LEGIFRANCE_CLIENT_SECRET`: present, but PISTE OAuth returns `invalid_client` (both servers, both orders). The Client ID is still needed from Roman. **Waived for the start:** French provisions are served from the corpus cache.
- `env:MISTRAL_API_KEY`: works for `codestral-latest`, `ministral-8b-latest`, `open-mistral-nemo` and `mistral-embed`. Medium, small, large and OCR have no quota. **Waived:** the spec uses the available models (§3).
- `../FinTechProto`: transferred to `RomanGrebnev/FinTechProto` (private; Roman is **admin**); the local remote is updated. `main` = `dbb8e64`. The untracked local `docs/product.md` is superseded and not committed.
