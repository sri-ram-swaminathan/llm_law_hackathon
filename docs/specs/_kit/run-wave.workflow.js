export const meta = {
  name: 'sdd-run-wave',
  description: 'Run one wave of spec tasks: implement in task worktrees, re-verify, critique, bounded fixes, cross-task review',
  whenToUse: 'Called by /roman:run with args built from `sdd next --json` after `sdd worktree` created each task worktree',
  phases: [
    { title: 'Implement', detail: 'one agent per task, in its own worktree, editing only owned files', model: 'sonnet' },
    { title: 'Verify', detail: 'sdd verify re-runs each task verify command and records evidence', model: 'opus' },
    { title: 'Critique', detail: 'independent fresh-context review of each task diff', model: 'opus' },
    { title: 'Fix', detail: 'bounded fix rounds for failed verification or serious findings', model: 'sonnet' },
    { title: 'Cross-review', detail: 'interactions between tasks of this wave, or the whole wave at once (batch_review)', model: 'opus' },
  ],
}

// args: { slug, folder, checkout, sdd, spec, readme, integration_branch,
//         fix_rounds, docker_parallel, cross_review, review_rule (optional text appended to the critique brief),
//         review_after_fix (false: one review, then only re-verify), tasks[].review (false: verify only),
//         batch_review (true: no per-task critique; ONE reviewer reads every reviewed task's diff together,
//                       covering each task's DoD and bugs plus the interactions, then one fix round per affected task),
//         impl_model (model for implement and fix agents, e.g. 'sonnet'; omitted = the session model),
//         check_model (model for verify, critique, wave review and cross-review, e.g. 'opus'; omitted = the session model),
//         tasks: [{ id, title, file, worktree, branch, owns, needs, verify, deps }] }
const A = args
const FIX_ROUNDS = A.fix_rounds === undefined ? 2 : A.fix_rounds
// Builders run on impl_model; everything that judges their work runs on check_model.
const IMPL = A.impl_model ? { model: A.impl_model } : {}
const CHECK = A.check_model ? { model: A.check_model } : {}

const TASK_RESULT = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    status: { type: 'string', enum: ['done', 'blocked'] },
    commit: { type: 'string' },
    verify_exit: { type: 'integer' },
    deviations: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['id', 'status', 'verify_exit', 'deviations', 'notes'],
}
const VERIFY_RESULT = {
  type: 'object',
  properties: {
    exit: { type: 'integer' },
    tail: { type: 'string' },
    uncommitted: { type: 'boolean' },
    outside_owns: { type: 'array', items: { type: 'string' } },
  },
  required: ['exit', 'tail', 'uncommitted', 'outside_owns'],
}
const FINDING = {
  type: 'object',
  properties: {
    severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
    title: { type: 'string' },
    evidence: { type: 'string' },
    fix: { type: 'string' },
    tasks: { type: 'array', items: { type: 'string' } },
  },
  required: ['severity', 'title', 'evidence', 'fix'],
}
const CRITIQUE = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['ACCEPT', 'ACCEPT_WITH_CHANGES', 'REWORK'] },
    dod_unmet: { type: 'array', items: { type: 'string' } },
    findings: { type: 'array', items: FINDING },
    plan_notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'dod_unmet', 'findings'],
}
const CROSS = {
  type: 'object',
  properties: { findings: { type: 'array', items: FINDING } },
  required: ['findings'],
}

// Docker-using tasks share a small number of slots so parallel agents don't compete for the machine.
function semaphore(n) {
  let active = 0
  const queue = []
  return async (fn) => {
    if (active >= n) await new Promise((resolve) => queue.push(resolve))
    active++
    try { return await fn() } finally {
      active--
      const next = queue.shift()
      if (next) next()
    }
  }
}
const dockerSlot = semaphore(A.docker_parallel || 1)
const usesDocker = (t) => (t.needs || []).some((n) => n === 'docker' || n.startsWith('registry:'))
const guarded = (t, fn) => (usesDocker(t) ? dockerSlot(fn) : fn())

const project = (t) => `sdd-${A.slug}-${t.id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

const rules = (t) => `
Rules (from ${A.readme} — read it first):
- Work only in the worktree ${t.worktree} on branch ${t.branch}. Never touch other worktrees, other branches, or the integration checkout ${A.checkout}.
- Edit only files matching your task's owns: ${JSON.stringify(t.owns)}. If you need anything else, don't edit it — report it in "deviations".
- Don't edit anything under docs/specs/. The orchestrator owns status, evidence and the log.
- Commit atomically with Conventional Commits ending in "(${t.id})", e.g. "feat(scope): what (${t.id})". Follow the repo's rules for commit trailers. Never commit .env, *.pem, *.key, kubeconfig files, secrets/, venv/ or .venv/.
- Never print or log secret values. If a secret is missing, stop and report the need.
- Docker: run \`${A.sdd} resources --slug ${A.slug}\` first. Use compose project "${project(t)}", label containers sdd.slug=${A.slug}, use the suggested free ports through env overrides, and cap memory and CPU. Never stop, remove or prune containers, volumes or networks you didn't create. Clean up with \`docker compose -p ${project(t)} down\` (no -v on anything shared).
- Don't push, merge, rebase, tag or open PRs.`

const implementPrompt = (t) => `You are implementing one task of a spec-driven plan.
Task file: ${t.file}
Spec: ${A.spec}
Read the task file and the spec sections it references, then read the code you will change.
Implement the task so that every "Definition of done" item holds, add or update the tests it lists, and commit.
Then run the task's verify command in your worktree and make it pass: ${t.verify}
${rules(t)}
Return: id "${t.id}", status "done" (verify passes and all DoD items hold) or "blocked" (explain why in notes), the last commit sha, the verify exit code, deviations (empty list if none), and notes (what you did, anything the reviewer should look at).`

const verifyPrompt = (t) => `Run these commands exactly and report the results. Don't change any files.
1. cd ${A.checkout} && ${A.sdd} --folder ${A.folder} verify ${t.id} --cwd ${t.worktree} --tail 40
2. git -C ${t.worktree} status --porcelain
3. git -C ${t.worktree} diff --name-only ${A.integration_branch}...HEAD
Return exit = the exit code of command 1, tail = its last 40 lines, uncommitted = whether command 2 printed anything, outside_owns = the files from command 3 that don't match any of ${JSON.stringify(t.owns)} (glob semantics; empty list if all match).`

const critiquePrompt = (t) => `You are an independent, skeptical reviewer with no stake in this change. Don't edit anything.
Task file: ${t.file}   Spec: ${A.spec}   Conventions: ${A.readme}
The change: git -C ${t.worktree} diff ${A.integration_branch}...HEAD  (and git -C ${t.worktree} log --oneline ${A.integration_branch}..HEAD)
Check:
1. Every Definition of done item is actually met by the code and tests (list unmet ones in dod_unmet).
2. Correctness: bugs, edge cases, error handling that matters, broken contracts from the spec's interfaces section.
3. Tests prove the behaviour. They must not be tautological, mocked into meaninglessness, or skipped.
4. Scope: only owned files changed (${JSON.stringify(t.owns)}); nothing beyond the task.
5. Simplicity: no speculative abstraction or dead code.
6. Safety: no secrets, no blocked files, no destructive operations.
Grade each finding blocker (must fix before merge), major (should fix before merge) or minor (can wait). Cite evidence as file:line. Give a concrete fix. At most 10 findings; no style nitpicks unless they hide a bug.${A.review_rule ? `\nReview rule: ${A.review_rule}` : ''}`

const fixPrompt = (t, problems, round) => `Fix round ${round} for task ${t.id}. Task file: ${t.file}. Spec: ${A.spec}.
Problems to fix:
${JSON.stringify(problems, null, 2)}
Fix them in the worktree with new commits ("fix(scope): what (${t.id})"). Don't rewrite pushed history. Then run the verify command and make it pass: ${t.verify}
${rules(t)}
Return the same result object as before for id "${t.id}".`

async function reviewLoop(impl, t) {
  if (!impl || impl.status === 'blocked') return { id: t.id, state: 'blocked', impl }
  let round = 0
  let lastCritique = null
  while (true) {
    const verify = await guarded(t, () => agent(verifyPrompt(t), {
      phase: 'Verify', label: `verify ${t.id} #${round}`, schema: VERIFY_RESULT, effort: 'low', ...CHECK,
    }))
    const verifyOk = verify && verify.exit === 0 && !verify.uncommitted
    // review: false on a task skips the reviewer; review_after_fix: false reviews once and only re-verifies after a fix.
    const reviewNow = !A.batch_review && t.review !== false && !(round > 0 && A.review_after_fix === false)
    const critique = verifyOk && reviewNow ? await agent(critiquePrompt(t), {
      phase: 'Critique', label: `critique ${t.id} #${round}`, schema: CRITIQUE, ...CHECK,
    }) : null
    if (critique) lastCritique = critique
    const serious = critique ? critique.findings.filter((f) => f.severity !== 'minor') : []
    const unmet = critique ? critique.dod_unmet : []
    if (verifyOk && serious.length === 0 && unmet.length === 0) {
      return { id: t.id, state: 'passed', rounds: round, impl, verify, critique: lastCritique }
    }
    if (round >= FIX_ROUNDS) {
      log(`${t.id}: still failing after ${round} fix round(s) — leaving it for the orchestrator`)
      return { id: t.id, state: 'failed', rounds: round, impl, verify, critique }
    }
    round++
    impl = await guarded(t, () => agent(fixPrompt(t, {
      verify_failed: verifyOk ? null : verify,
      dod_unmet: unmet,
      findings: serious,
    }, round), { phase: 'Fix', label: `fix ${t.id} #${round}`, schema: TASK_RESULT, ...IMPL }))
    if (!impl || impl.status === 'blocked') return { id: t.id, state: 'blocked', rounds: round, impl, verify, critique }
  }
}

const results = await pipeline(
  A.tasks,
  (t) => guarded(t, () => agent(implementPrompt(t), { phase: 'Implement', label: `implement ${t.id}`, schema: TASK_RESULT, ...IMPL })),
  (impl, t) => reviewLoop(impl, t),
)

// Barrier on purpose: interaction bugs only show up when all of the wave's diffs are compared together.
const passed = results.filter((r) => r && r.state === 'passed')
let cross = null
const byId = Object.fromEntries(A.tasks.map((t) => [t.id, t]))
const reviewed = passed.filter((r) => byId[r.id].review !== false)
if (A.batch_review && reviewed.length >= 1) {
  // One reviewer for the whole wave: per-task DoD and bugs, plus how the changes fit together.
  phase('Cross-review')
  const list = reviewed.map((r) => `- ${r.id}: task file ${byId[r.id].file}; owns ${JSON.stringify(byId[r.id].owns)}; diff: git -C ${byId[r.id].worktree} diff ${A.integration_branch}...HEAD`).join('\n')
  cross = await agent(`You are an independent, skeptical reviewer with no stake in these changes. Don't edit anything.
Spec (especially its interfaces and contracts section): ${A.spec}   Conventions: ${A.readme}
This wave's changes, reviewed together in one pass (one worktree per task):
${list}
For each task: are its Definition of done items met by the code and tests (an unmet item is a finding naming that task), and are there bugs, broken spec contracts, edits outside its owns, secrets or destructive operations?
Across tasks: names, keys, schemas or config fields one task writes and another reads differently; duplicated or conflicting logic; ordering or migration assumptions; merges that would conflict semantically.
For each finding, list the affected task ids in "tasks", cite evidence as file:line, and give a concrete fix. At most 12 findings; no style nitpicks.${A.review_rule ? `\nReview rule: ${A.review_rule}` : ''}`, { phase: 'Cross-review', label: 'wave review', schema: CROSS, ...CHECK })
} else if (A.cross_review !== false && passed.length >= 2) {
  phase('Cross-review')
  const diffs = passed.map((r) => `- ${r.id}: git -C ${byId[r.id].worktree} diff ${A.integration_branch}...HEAD`).join('\n')
  cross = await agent(`You are reviewing how several parallel changes fit together. Don't edit anything.
Spec (especially its interfaces and contracts section): ${A.spec}
Changes in this wave (one worktree per task):
${diffs}
Each change was already reviewed on its own. Look only for problems BETWEEN them, for example:
- names, keys, schemas, config fields or events that one task writes and another reads differently;
- duplicated or conflicting logic;
- ordering or migration assumptions;
- merges that would conflict semantically even where git merges cleanly;
- interfaces from the spec implemented inconsistently.
For each finding, list the affected task ids in "tasks", cite evidence as file:line, and give a concrete fix. Only blocker or major findings matter here.`, { phase: 'Cross-review', label: 'cross-review', schema: CROSS, ...CHECK })
}
if (cross) {
  const serious = cross ? cross.findings.filter((f) => f.severity !== 'minor') : []
  if (serious.length) {
    const affected = [...new Set(serious.flatMap((f) => f.tasks || []))].filter((id) => byId[id])
    log(`cross-review: ${serious.length} finding(s) affecting ${affected.join(', ') || 'no specific task'}`)
    const refixed = await pipeline(
      affected,
      (id) => guarded(byId[id], () => agent(fixPrompt(byId[id], { cross_task_findings: serious.filter((f) => (f.tasks || []).includes(id)) }, 'cross'),
        { phase: 'Fix', label: `cross-fix ${id}`, schema: TASK_RESULT, ...IMPL })),
      (impl, id) => guarded(byId[id], () => agent(verifyPrompt(byId[id]), { phase: 'Verify', label: `re-verify ${id}`, schema: VERIFY_RESULT, effort: 'low', ...CHECK }))
        .then((verify) => ({ id, impl, verify })),
    )
    for (const r of refixed.filter(Boolean)) {
      const entry = results.find((x) => x && x.id === r.id)
      const ok = r.verify && r.verify.exit === 0 && !r.verify.uncommitted
      if (entry) Object.assign(entry, { state: ok ? 'passed' : 'failed', cross_fix: r })
    }
  }
}

return {
  wave: A.tasks.map((t) => t.id),
  results: results.map((r, i) => r || { id: A.tasks[i].id, state: 'blocked', impl: null }),
  cross,
}
