# docs/specs — how work is specified, planned and run here

Read this before touching anything under `docs/specs/`. It applies to every agent, including subagents that were given a single task.

## Layout

```
docs/specs/
  README.md            this file
  _kit/                sdd CLI, templates, VERSION — don't edit by hand; upgraded by the skills
  YYYY-MM-DD-<slug>/   one folder per piece of work (date = start; slug = the work's ID)
    SPEC.md            settings block + problem, design, decisions, acceptance criteria
    PREFLIGHT.md       branching restatement and access checks
    LOG.md             timeline, one line per event: "- YYYY-MM-DD HH:MM · <phase> · <event>"
    critique/          independent reviews: NN-<target>.md
    tasks/             one file per task: <id>-<slug>.md with a header
    evidence/          <id>.md — verify runs (written by `sdd verify`) and the DoD audit
    gates/             G<n>-<slug>.md — results, decisions needed, the human's decision
```

The slug is shared by the folder, the integration branch `ft/<slug>` and the final PR. Run `docs/specs/_kit/sdd list` to see every folder and its status.

## Tasks

The header of every task file:

```yaml
id: T03                # unique in the folder; the file name starts with it
title: Add config schema
kind: work             # work | verify | gate
deps: [T01]            # task ids this waits for
owns: [src/config/schema.py, tests/test_schema.py]   # work: the only files it may edit
repo: .                # one of the SPEC `repos`
needs: [env:OPENAI_API_KEY, docker]                  # checked by `sdd preflight`
verify: uv run pytest tests/test_schema.py -q        # the command that proves it
review: light          # none: merged on verify alone | light: one review, only bugs in own files block
status: todo           # todo | doing | review | done | blocked | skipped
```

- **work** tasks change code. **verify** tasks are integration checks on the integration branch (build, boot, smoke, eval). **gate** tasks are human decisions: nothing runs past them without one.
- A task's wave is one more than the highest wave of its dependencies. Tasks that don't depend on each other may run in parallel, so their `owns` must not overlap (`sdd check` enforces this).
- Every Definition of done item names the test or command that proves it. A task's verify runs only its own tests; Docker boots and full suites belong in verify tasks.
- A task is **done** only when its verify command passes when re-run by the orchestrator (`sdd verify <id>`) and every Definition of done item is shown in `evidence/<id>.md`.
- Put `"…"` around a verify command that contains ` #`.

## If you are a subagent given one task

1. Work only in the worktree you were given, on its task branch. Edit only files matched by your task's `owns`. If you must touch anything else, stop and report it as a deviation instead of editing.
2. Don't edit anything under `docs/specs/`. The orchestrator owns status, evidence and the log.
3. Commit atomically with Conventional Commits and the task id: `feat(config): add schema (T03)`. Follow the repo's rules for commit trailers. Never commit `.env`, `*.pem`, `*.key`, kubeconfig files, `secrets/`, `venv/` or `.venv/`.
4. Run your verify command before you finish. Return a JSON object: `{"id", "status": "done"|"blocked", "commit", "verify_exit", "deviations": [], "notes"}`.
5. Don't push, merge, rebase other branches, tag, or open PRs. The orchestrator does that.

## Branching

- The **base** (`main` or `dev`, asked at the start) is never pushed to, merged into or tagged by an agent.
- The **integration branch** `ft/<slug>` comes off the base. **Task branches** `ft/<slug>-<id>` come off the integration branch, one worktree each, under `$(git rev-parse --git-common-dir)/sdd-worktrees/<slug>/<id>`.
- **Feature-branch merges** (task into integration) are done by the orchestrator with `sdd merge <id>` (`--no-ff`, in dependency order, only after verification).
- **Protected-branch merges** (main, dev, staging, or anything with required reviews) happen only through a PR that other people approve. Agents open the PR and stop. They never merge it, use admin bypass, or tag.
- A task that needs another repo's change merged or released first depends on a **gate** task for that PR.
- **Pushing:** `sdd push` follows the SPEC `push` setting and refuses protected branches. Tidy a task branch's history only before its first push. After that, add new commits. The integration branch is never force-pushed.

## Secrets and access

- `sdd preflight` checks access and prints only statuses: variables present, context reachable, registry login present. Never print, cat, echo or log secret values, `.env` contents, kube secrets or `~/.docker/config.json`.
- If a secret is missing, report the need (`env:NAME`) and stop. Don't search the disk for it.
- Treat a secret that appears in chat or in output as compromised, and say so.

## Sharing the machine

- Run `sdd resources` before starting containers. Every container, volume, network and port you didn't create belongs to someone else. Don't stop, restart, remove or prune it.
- Name your compose project `sdd-<slug>` (or `sdd-<slug>-<id>` per parallel task), label everything `sdd.slug=<slug>`, and use the free ports it suggests through env overrides.
- Never run `docker system prune`, `docker volume prune`, or `down -v` on anything shared. Clean up with `docker compose -p sdd-<slug> down`.
- Cap CPU and memory for heavy services. Run at most `docker_parallel` Docker-using tasks at once. Give each test suite that needs a database its own database or container.
- If `sdd resources` reports low headroom, run serially and say so.

## sdd commands

| Command | Use |
|---|---|
| `sdd list` · `sdd status` · `sdd next --json` · `sdd graph` | Read state |
| `sdd check` | Validate the folder (exit 1 on errors) |
| `sdd new <slug> --base <b>` · `sdd add <id> "<title>" …` | Create a folder or task |
| `sdd set <id> <status> [--note]` · `sdd spec-status <status>` · `sdd log "<event>"` | Record state (orchestrator) |
| `sdd verify <id>` | Run the verify command, append evidence (orchestrator) |
| `sdd worktree <id>` · `sdd merge <id> [--cleanup]` · `sdd push [<id>]` | Branch operations (orchestrator) |
| `sdd preflight [--basic] [--write]` · `sdd resources` | Access and machine checks |
