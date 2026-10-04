---
name: roman-run
description: Execute a planned spec folder wave by wave. Each wave gets task worktrees off the integration branch; tasks are implemented in parallel with ultracode, re-verified, reviewed once at the level each task sets (none or light) with at most one fix round, then merged --no-ff and checked by integration tasks. Step mode stops after every wave; auto mode stops only at gates and blockers. With no argument, or "status", it shows progress. Use after /roman-plan.
argument-hint: "[step | auto | status] [slug]"
---

# /roman-run

Outcome: verified tasks merged into the integration branch, evidence and statuses recorded, branches pushed per policy, a stop at every gate.

Arguments: $ARGUMENTS

```bash
REPO=$(git rev-parse --show-toplevel); SDD="$REPO/docs/specs/_kit/sdd"
```

## Status (no argument, or `status`)

Run `$SDD status`. Show the output, plus `$SDD graph` if the user asks. Stop there.

## 0. Before the first wave

1. Read `docs/specs/README.md`. Every rule in it applies to you and to every agent you start.
2. Resolve the folder, which must be at `planned` or `executing`. The mode comes from the argument, else SPEC `run_mode`.
3. Check out the integration branch in `$REPO`. If the checkout has changes outside the work folder, ask the user; never stash or discard them.
4. Run `$SDD check`. Stop if it reports errors.
5. Run `$SDD preflight --write`. Any `missing` or `fail` that isn't waived in `PREFLIGHT.md` → stop and say what's needed. Credentials expire, so re-run this before every wave.
6. **Drift check:** `git fetch origin <base>`, then compare the base with the integration branch's merge base. If the base has moved:
   - **step mode:** show the new commits and ask whether to merge the base into the integration branch;
   - **auto mode:** merge it when that's conflict-free, otherwise stop.
   Never rebase the integration branch.
7. If the folder is at `planned`, run `$SDD spec-status executing`.

## 1. One wave

1. **What's runnable:** `$SDD next --json`.
   - Anything under `gates` → go to **Gates** below.
   - Nothing runnable and not done → report the blocked tasks and stop.
   - `done` is true → run `$SDD spec-status verifying`, tell the user to run `/roman-verify`, and stop.
2. **Resources:** run `$SDD resources`. If it reports low headroom, run Docker-using tasks one at a time (`docker_parallel` = 1) and say so.
3. **Prepare the work tasks.** For each runnable `work` task:
   - `WT=$($SDD worktree <id>)` creates it on `ft/<slug>-<id>` off the integration branch;
   - `$SDD set <id> doing`.
4. **Fan out with ultracode.** Call the Workflow tool (these instructions count as the user's opt-in) with:
   - `scriptPath`: `$REPO/docs/specs/_kit/run-wave.workflow.js`
   - `args` (a JSON object, not a string):

     ```json
     {"slug": "...", "folder": "<abs folder path>", "checkout": "<abs $REPO>", "sdd": "<abs $SDD>",
      "spec": "<abs SPEC.md>", "readme": "<abs docs/specs/README.md>", "integration_branch": "ft/<slug>",
      "fix_rounds": 1, "review_after_fix": false, "docker_parallel": <from SPEC, default 1>,
      "batch_review": <true unless the SPEC sets review_mode: per-task>,
      "impl_model": <SPEC impl_model, default "sonnet">, "check_model": <SPEC check_model, default "opus">,
      "cross_review": <per-task mode only: true when two of the wave's tasks touch the same SPEC §7 contract>,
      "review_rule": "Grade blocker or major ONLY for a bug, a secret leak, an unintended write, or a contradiction with the approved spec, in this task's own files; unmet Definition of done items still go in dod_unmet. Anything that lives in another task's plan or files goes in plan_notes (one line each, naming the task), never in findings or dod_unmet. Everything else is minor.",
      "tasks": [{"id", "title", "file", "worktree", "branch", "owns", "needs", "verify", "deps",
                 "review": <false when the task's review is none>}]}
     ```

   Per task, the script:
   1. implements the task in its worktree;
   2. re-runs verification with `sdd verify`, which writes the evidence;
   3. fixes verify failures in at most `fix_rounds` rounds;
   4. **batch review (default):** once the wave's tasks pass verify, ONE independent reviewer reads every `light` task's diff together, against each task's definition of done, its owned files and the spec, plus how the changes fit together, under `review_rule`. `none` tasks merge on verify alone. Each task with a blocking finding gets one fix round, then only a re-verify. One review per wave of 5–6 tasks is the point: per-task reviews were the slowest part of past runs;
   5. **per-task mode** (`review_mode: per-task` in the SPEC): each `light` task gets its own critic before merge, and `cross_review` adds the between-tasks pass.
   6. **Models:** implement and fix agents run on `impl_model` (Sonnet by default); every check (the verify runs, the per-task or batch review, the cross-review) runs on `check_model` (Opus by default), so a cheaper builder is always judged by the stronger model. A SPEC sets either key to override, e.g. `impl_model: opus` for a delicate contract task's folder.

   Wait for the completion notification. If the Workflow tool isn't available, run the same stages yourself: one Agent per task in parallel with the script's implement prompt, then verify, critique and fix per task, then one cross-review agent.
5. **Merge in dependency order** (dependencies first, then by id). For each task the workflow reports as `passed`:
   - Check scope: `git diff --name-only ft/<slug>...ft/<slug>-<id>` must fall within `owns`. A file outside it is a deviation. Step mode: show it and ask. Auto mode: stop.
   - Run `$SDD push <id>`. It pushes the task branch if the policy allows.
   - Run `$SDD merge <id> --cleanup`. It does a `--no-ff` merge, then removes the worktree and the local branch.
   - A conflict (exit 2) → stop and report the files.
   - Add a "Definition of done audit" to `evidence/<id>.md`: one line per item, showing where it's proven (test name, output, `file:line`). Add any deviations from the workflow result.
   - Apply the reviewer's `plan_notes` to the task files they name (Definition of done, Notes). Fix small leftover bugs yourself and re-run `$SDD verify <id>`, rather than starting another round.
   - Run `$SDD set <id> done --note "merged"`.
6. **Tasks that didn't pass:** `failed` or `blocked` → `$SDD set <id> blocked --note "<why, in one line>"`. Keep the worktree for inspection.
7. **Integration checks.** For each `verify` task that is now runnable:
   - `$SDD set <V> doing`, then `$SDD resources`.
   - `$SDD verify <V>`. It runs on the integration checkout. Boot what's needed under compose project `sdd-<slug>`, using the free ports it suggests and following the machine-sharing rules.
   - **Passes** → audit its definition of done in the evidence, then `$SDD set <V> done`.
   - **Fails** → spawn one diagnosis agent. It reads the evidence and logs, and returns the root cause plus a fix task (id `T<n>f`, deps, owns, verify). Add the fix with `$SDD add`.
     - Auto mode: continue with it in the next wave.
     - Step mode: show it and stop.
   - Stop the containers this wave started: `docker compose -p sdd-<slug> down`. Only ours.
8. **Record the wave:**
   - One bookkeeping commit on the integration branch: `docs(<slug>): wave <n> — <ids> done`. It covers the task files, `LOG.md` and `evidence/`.
   - Then `$SDD push` for the integration branch.
   - Keep code commits and bookkeeping commits separate.
9. **Report:** what merged, deviations, failures, the evidence files, timings (`$SDD status`), and what's next. Send a PushNotification if the tool is available.
10. **Step mode:** stop here. **Auto mode:** go back to step 1 (re-run preflight and the drift check first).

## Gates

- Show each gate: what it decides, what feeds it, and the evidence so far. For a cross-repo gate, show that PR's state (`gh pr view <url> --json state,reviewDecision,mergedAt`).
- Write `gates/G<n>-<slug>.md` from `docs/specs/_kit/templates/GATE.md`.
- Ask the user for the decision. Record it verbatim with their name and the date in the gate file's section 7.
- Mark the gate:
  - go → `$SDD set <G> done --note "<decision>"`;
  - skip → `$SDD set <G> skipped --note "skipped by <name>: <reason>"`.
- Nothing continues past a gate without the user's explicit words, in either mode.

## Stop conditions in auto mode

Stop and report when any of these happens:
- a gate;
- a need that's missing or failing;
- a task still failing after its fix rounds;
- a merge conflict;
- an edit outside `owns`;
- base drift that doesn't merge cleanly;
- anything destructive or irreversible;
- a decision only the user can make.

## Never

- Never push to, merge into or tag `main`, `dev` or `staging`, and never merge a PR or use admin bypass.
- Never force-push the integration branch.
- Never touch containers, volumes, networks or worktrees you didn't create.
- Never remove a worktree that is some session's current directory.
- Never let subagents edit `docs/specs/`.
