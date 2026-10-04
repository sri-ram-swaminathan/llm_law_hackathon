---
name: roman-spec
description: Start or continue spec-driven work. Sizes it, confirms branching and access, frames the problem, grounds it in the code (or a provided analysis file), shapes and critiques a solution, and writes a SPEC.md for sign-off in a dated folder on the work's integration branch. Use before building anything non-trivial.
argument-hint: "[slug | problem statement | path to an analysis file]"
---

# /roman-spec

Outcome: a signed-off `SPEC.md` in `docs/specs/YYYY-MM-DD-<slug>/` on the integration branch `ft/<slug>`, with a basic `PREFLIGHT.md` and a `LOG.md` timeline.

Arguments: $ARGUMENTS

## 0. Set up

```bash
REPO=$(git rev-parse --show-toplevel)
KIT_SRC="$REPO/.claude/roman-kit"
SDD="$REPO/docs/specs/_kit/sdd"   # after install; before that use: python3 "$KIT_SRC/sdd"
```

- Read `$KIT_SRC/README.md`. Its rules on branching, secrets and sharing the machine bind you and every agent you start.
- If the argument matches an existing folder (`python3 "$KIT_SRC/sdd" --specs "$REPO/docs/specs" list`), continue that folder. At `draft`, resume at the first section still holding template text. At `approved` or later, say it's signed off and point to `/roman-plan`.
- Otherwise, treat the argument as the problem statement or the path to an analysis file. If there's no argument, ask what the problem is.

## 1. Size

Decide between **lite** and **full**, and say why in one line; the user can override.
- **lite:** at most 4 tasks, one repo, no interface shared between tasks, low risk.
- **full:** anything else.

Lite keeps every step but shortens it: one critique pass, options only when there's a real choice.

## 2. Branch and basic preflight

1. **Ask** which base to branch from, `main` or `dev`, using AskUserQuestion. Never assume. Also ask whether other repos are involved; each gets the same integration branch later, in `/roman-plan`.
2. Propose a slug: lowercase with hyphens, at most 40 characters, and not already used according to `sdd list`. It's the work's ID.
3. Read the repo's `CLAUDE.md` for branch rules, PR targets, required reviewers and commit-trailer rules. Note anything specific for step 6.
4. Check `git status`. If there are uncommitted changes, ask the user what to do. Never stash or discard someone else's work.
5. Create the integration branch: `git fetch origin <base> && git switch -c ft/<slug> origin/<base>`. If it already exists, switch to it.
6. Install the kit: `python3 "$KIT_SRC/sdd" install "$REPO"`.
7. Create the folder: `$SDD new <slug> --base <base> --title "<title>" --size <lite|full>`.
8. In `PREFLIGHT.md` → "Branching", keep the template's restatement and add the repo-specific rules from step 3. Show it to the user and ask them to confirm. Record "Confirmed by: <name>, <date>".
9. Run `$SDD preflight --basic --write` and show the table. Fix or discuss anything `missing` or `fail` before going further.
10. Commit: `docs(<slug>): start spec`, including `docs/specs/_kit` and `docs/specs/README.md` if you just installed them. Then `$SDD push` (it follows the `push` setting and refuses protected branches).

## 3. Frame

Fill SPEC §1–3 with the user: problem, goals and non-goals, constraints. Ask only what you can't infer. The problem fits in two paragraphs, and success is observable.

## 4. Ground

Record the commit you grounded against in the §4 heading: `git rev-parse --short HEAD`.

- **Analysis file given:** read all of it. Summarise it in §4 with its path, and spot-check its key claims against the code. Mark each claim verified (`path:line @ sha`) or unverified.
- **Otherwise:** research the current state in the code (Grep/Glob, and the rakam-devkit MCP tools if available) and cite `path:line @ sha`. Describe what the code does, not what it's meant to do. If the work spans more than 3 subsystems, send parallel read-only Explore agents (one per subsystem) and merge their maps.
- Note anything that contradicts the problem statement and raise it with the user.

## 5. Shape

1. **Options (§5):** list at least two when there's a real choice, each with pros and cons. Recommend one.
2. **Draft:**
   - §6 design;
   - §7 interfaces and contracts: every schema, config key, API, event or file format that two or more tasks will touch;
   - §9 acceptance criteria: observable behaviour, each with a `verify:` command;
   - §10 risks and rollback.
3. **Critique:** run `/roman-critique` on `SPEC.md` (an independent agent with fresh context; if the skill isn't available, spawn a general-purpose Agent with the same brief). Triage the findings with the user, update the spec, and keep the critique file.
4. **Decisions (§8):** record every choice with its rationale and a status (`proposed` or `decided`). Put open ones to the user in batches of at most 4 via AskUserQuestion, with a recommended option each.
5. **Alignment check:** restate in five lines: the problem, what will be built, what won't, how we'll know it worked, and the biggest risk. Ask "anything off?"
6. Repeat until no blocker or major finding is open and §11 is empty or explicitly deferred.

## 6. Sign-off

- Run `$SDD check`. Fix the errors; a "no tasks yet" warning is expected.
- Ask for sign-off. On yes:
  - run `$SDD spec-status approved --note "signed off by <name>"`;
  - commit `docs(<slug>): approve spec`;
  - run `$SDD push`.
- End with the folder path, the branch, and the next step: `/roman-plan`.

## Rules

- Commit only on `ft/<slug>`. Never commit to, merge into or tag the base.
- Refer to secrets by need (`env:NAME`), never by value. Never read `.env` contents into the conversation.
- Log milestones with `$SDD log --phase spec "<event>"`: framed, grounded @ sha, critique n, decisions locked.
- The SPEC is the single source of truth. Link to Notion or ClickUp; don't copy from them.
