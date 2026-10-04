# Preflight — cco-mvp

## Branching (restated by the agent, confirmed by a human)

- Base branch: `main`, taken from origin, never pushed to, merged into or tagged by the agent.
- Integration branch: `ft/cco-mvp`, created off `main`. Task branches `ft/cco-mvp-<id>` come off it and merge back with `--no-ff` after verification.
- Final step: a PR from `ft/cco-mvp` to `main`, merged by a human per the repo's review rules.
- Pushing: per the SPEC `push` setting; never `--force` on the integration branch.
- Repo-specific rules:
  - **This repo** (`sri-ram-swaminathan/llm_law_hackathon`): has no `CLAUDE.md`, so there are no extra branch, PR-target or reviewer rules. PRs go to `main`, and a human reviews and merges them. `ft/cco-mvp` has no upstream set, so a plain `git push` can't reach `main`.
  - **Commit trailer** (from the session's attribution rule): `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR bodies end with the Claude Code line.
  - **Second repo** `../FinTechProto` (`RomanGrebnev/FinTechProto`): base `main`, same integration branch `ft/cco-mvp`, added in `/roman-plan`.
    - The demo flow needs a `v0.9.0` tag on its `main`, a `dev` branch, a release PR `dev → main`, and a `v1.0.0` tag.
    - Those touch FinTechProto's base, so each is a **gate task done by a human**, never by an agent.
  - **Never committed:** `.env` (holds the Mistral and PISTE secrets).
- Confirmed by: Roman Grebnev, 2026-10-04

## Access and environment

<!-- sdd:access:start -->
_Checked 2026-10-04 14:00 by `sdd preflight --basic`. Values are never shown._

| Need | Status | Detail | Tasks |
|---|---|---|---|
| `git-clean` | ok | working trees clean | — |
| `gh` | ok | gh authenticated | — |
| `docker` | ok | docker 28.4.0, 4 containers running (not ours unless labelled) | — |
| `disk` | ok | 71.4 GiB free | — |
<!-- sdd:access:end -->

## Blockers and waivers

- `env:LEGIFRANCE_CLIENT_ID` / `env:LEGIFRANCE_CLIENT_SECRET`: present, but PISTE OAuth returns `invalid_client` (both servers, both orders). The Client ID is still needed from Roman. **Waived for the start:** French provisions are served from the corpus cache.
- `env:MISTRAL_API_KEY`: works for `codestral-latest`, `ministral-8b-latest`, `open-mistral-nemo` and `mistral-embed`. Medium, small, large and OCR have no quota. **Waived:** the spec uses the available models (§3).
- `../FinTechProto`: transferred to `RomanGrebnev/FinTechProto` (private; Roman is **admin**); the local remote is updated. `main` = `dbb8e64`. The untracked local `docs/product.md` is superseded and not committed.
