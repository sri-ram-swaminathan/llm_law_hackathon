---
name: roman-plan
description: Turn an approved SPEC.md into a task graph. Shows an outline of task groups and waves for the user to confirm before detailing. Puts a contract task first; writes one file per task with owned files, a definition of done, a verify command and declared needs; adds verify tasks at the end of each wave, an acceptance task, and gate tasks for human or cross-repo decisions. Then runs the readiness check and the full access preflight. Use after /roman-spec is signed off.
argument-hint: "[slug]"
---

# /roman-plan

Outcome: `tasks/*.md` that pass `sdd check`, an acceptance script, the graph in SPEC §12, a full `PREFLIGHT.md`, and the user's go-ahead.

Arguments: $ARGUMENTS

## 0. Set up

```bash
REPO=$(git rev-parse --show-toplevel); SDD="$REPO/docs/specs/_kit/sdd"
```

- Read `docs/specs/README.md`.
- Resolve the folder: `$SDD --folder <slug> settings --json`, or the current folder.
  - At `draft`: stop and point to `/roman-spec`.
  - At `planned`: show `$SDD status` and ask whether to revise the plan.
- Make sure you're on the integration branch.

## 1. Design the graph

Read SPEC §6–§10 and re-ground: fetch every repo involved and check each change the spec lists against the current code (`path:line @ sha`). Note anything that no longer holds, such as a change that's already done or a seam that moved.

**Outline first.** Before writing any task file, show the user:
- what each repo needs, grounded in the current code, and what the spec got wrong;
- the task groups as a table of waves (wave → the groups that run in parallel), with the gates where the user acts;
- the critical path, and the task count split into work, verify and gate tasks.

Detail the tasks only after the user confirms the outline.

**Release trains.** When later work builds on a change that must first be merged to a protected branch or released, and PRs are squash-merged, one integration branch can't carry work past that merge. Plan up to the end of that release chain in this folder, and give later milestones their own folders.

Then design the graph:

- **Contract first.** If two or more tasks touch anything in §7 (interfaces and contracts), the first task freezes it: the schemas, config keys, API signatures, event or file formats, and tests that pin them. Every task that touches them depends on it.
- **Work tasks:**
  - One logical change each, small enough to review as a single PR (about 400 changed lines at most), and verifiable on its own.
  - `owns` lists the exact files or globs the task may edit. Tasks that don't depend on each other must own disjoint files. If two of them need the same file, sequence them or merge them.
- **Verify tasks:** one after each batch of parallel work. Build it, boot what the change affects, exercise the changed path, and run the relevant suites. If the change is visible at runtime, the verify command must hit the real running system, not just unit tests. Declare `docker` and any other needs.
- **Acceptance task `VA`:** kind `verify`. It depends on every other work and verify task. Its verify command is `bash docs/specs/<folder>/acceptance.sh`.
  - Copy `docs/specs/_kit/templates/acceptance.sh` into the folder.
  - Add one `check ACn '…'` line per criterion in SPEC §9.
- **Gate tasks** (kind `gate`, named after the decision) for:
  - a go/no-go after measured results;
  - destructive or irreversible steps;
  - rollout;
  - **any dependency on another repo's change being merged to a protected branch or released.** Name that gate after the PR. Tasks that need the released change depend on the gate.
  - A final gate `G<n>` depends on `VA`.
- **Needs:** every task declares what it requires:
  - `env:NAME` or `env:NAME@path/.env`;
  - `kube:<context>[/<namespace>]`;
  - `registry:<host>[/<image:tag>]`;
  - `docker`, `gh`, `git-push`, `cmd:<tool>`;
  - `check:"<command>"` for anything else.
- **Tasks that run fast.** Past runs lost their hours to review rounds and to mismatches between tasks' plans, not to verification. So:
  - Every Definition of done item names the test (`file::name`) or the command that proves it. Nothing on it needs judging.
  - The contract task also ships sample data and the tests that pin the contract, and later tasks import them. That's what keeps two tasks from each assuming a different interface.
  - Each task's Context lists the SPEC decisions it implements as settled, so reviewers don't reopen them.
  - Set `review:` per task. Use `none` (merge once verify passes) for config, docs, version pins, eval suites, and SQL or packs covered by their tests. Use `light` (one review, at most one fix round, blocking only on a bug, a leak, an unintended write or a spec contradiction in the task's own files) for code.
  - A task's verify runs only its own tests and finishes in about 2 minutes. Docker boots, full suites and live checks belong in verify tasks.
  - Prefer wide waves. Avoid single-task waves except for the contract and release gates; fold a small task into its neighbour rather than adding a wave.
  - Fold release-chain steps into the gate that triggers them. A version pin, image bump or tag swap that only follows a gate is an agent step in that gate's Notes, not its own task and wave.
  - A verify task depends only on the work it checks, so it can share a wave with work that doesn't feed it. The acceptance script may run inside the final gate when its last criteria need staging.
  - Reviews are batched per wave by default (one reviewer for all `light` tasks of the wave, see `/roman-run`), so don't split work to keep reviews small.
- **Size:** typically 5–20 tasks. Past 25, split the work into phases separated by gates, or into separate folders.
- **Multiple repos:**
  - List the repos in the SPEC `repos` setting (the lead repo first) and set `repo:` on each task.
  - Ask for each extra repo's base (main or dev).
  - Create the same integration branch in each: `git -C <repo> switch -c ft/<slug> origin/<base>`.
  - Install the kit only in the lead repo.

## 2. Write the tasks

- Create each task with `$SDD add <id> "<title>" --kind … --deps … --owns … --needs … --verify "…" --review none|light`. IDs: `T01`, `T02` … for work, `V1` … for verify, `VA` for acceptance, `G1` … for gates.
- Then fill in each task's body:
  - **Goal:** one sentence.
  - **Context:** the SPEC sections it implements, the settled decisions (D-numbers), and the current code as `path:line @ sha`.
  - **Definition of done:** states of the world, each one naming the test or command that proves it.
  - **Tests:** which tests are added or changed.
  - **Out of scope.**
- A verify command is one command that exits non-zero on failure. Put anything longer in a script under the task's `owns`.

## 3. Readiness check

- Run `$SDD check` until there are 0 errors. Fix each warning, or add a line to the task's Notes explaining why it stays.
- Critique the plan with `/roman-critique plan`, focused on:
  - missing tasks;
  - wrong or missing dependencies;
  - parallel tasks that would conflict;
  - weak definitions of done or verify commands;
  - missing gates, especially cross-repo ones.
- Triage the findings with the user and apply the accepted ones.

## 4. Record the plan in SPEC §12

Write:
- the number of tasks, the waves and their tasks (from `$SDD status`), the gates and what each one decides, and the critical path;
- the `$SDD graph` output in a `mermaid` block.

## 5. Full preflight and resources

1. Run `$SDD preflight --write` and show the table.
2. For each `missing` or `fail`, say what's needed and how the user can fix it. For example: `docker login <host>`, a kube context, a variable to export, a `gh auth login`. Never look for secrets yourself.
3. The user either fixes it (re-run the preflight) or explicitly waives it. Record waivers under "Blockers and waivers" in `PREFLIGHT.md`.
4. Run `$SDD resources`. If headroom is low, set `docker_parallel: 1` and say so.

## 6. Go

- Ask for the run mode, `step` (stop after every wave) or `auto` (stop only at gates and blockers), and confirm the `push` setting. Write both into the SPEC settings.
- On the user's go:
  - run `$SDD spec-status planned --note "go from <name>"`;
  - commit `docs(<slug>): plan — <n> tasks, <w> waves, <g> gates`;
  - run `$SDD push`.
- Next step: `/roman-run`.
