---
name: roman-close
description: Close a verified spec folder. Turns architectural decisions into ADRs in the repo's own ADR folder, updates project docs, prepares and opens the PRs from the integration branch to the base with the right reviewers (never merging protected branches), writes the handoff and a short retro. Use after /roman-verify records a go.
argument-hint: "[slug]"
---

# /roman-close

Outcome: ADRs and docs committed, PRs open and waiting for reviewers, a handoff written, the folder `closed`.

Arguments: $ARGUMENTS

```bash
REPO=$(git rev-parse --show-toplevel); SDD="$REPO/docs/specs/_kit/sdd"
```

## 1. Preconditions

- Resolve the folder, and check out the integration branch.
- The final gate must be `done` with a go recorded in its gate file. If it isn't, ask whether the user wants to close without one, and record their answer in `LOG.md`.

## 2. ADRs

- From SPEC §8, take each `decided` decision that is architectural:
  - hard to reverse;
  - affects other modules, repos or teams;
  - sets or breaks a pattern.
  Everything else stays in the spec.
- Find the repo's ADR convention: look for `docs/adr/`, `docs/adrs/`, `docs/ADR/`, or `services/*/docs/adr/`, and for an existing template (`ADR-000*`, `template*`). Follow its numbering, file naming, fields and index file.
  - If there's none, create `docs/adr/` and use `docs/specs/_kit/templates/ADR.md`, numbering from `0001`.
- Each ADR links back to the spec folder. Update the ADR index if the repo keeps one.

## 3. Docs

Update only what this work changed, following the repo's conventions:
- README;
- ARCHITECTURE.md (required in product-mode service repos);
- service docs and runbooks;
- CHANGELOG;
- the handoff docs consulting repos keep for the client.

Commit them as `docs(<scope>): …` on the integration branch, outside the work folder.

## 4. Client repos

If the repo builds a delivery bundle or package with an allow-list, make sure `docs/specs/` isn't shipped. Check the allow-list, or build the bundle and list its contents. If it would ship, fix the allow-list in its own commit.

## 5. PRs (other people approve them)

1. For each repo in the SPEC `repos` setting, in dependency order:
   - Find the target branch (the base), the required approvals, the merge method and the review rules. Sources: the repo's `CLAUDE.md`, `gh api repos/{owner}/{repo}/rulesets`, and branch protection.
   - Draft the PR:
     - **Title:** `<type>(<scope>): <title> [<slug>]`.
     - **Body:** a summary (2–4 bullets); a test plan taken from the evidence and the gate; impact; the spec folder path; ADR links. For cross-repo work, add "must merge after/before …".
2. Show the drafts, the reviewers you intend to request, and the target branches. **Ask before opening.** Opening a PR is visible to other people.
3. Open them with `gh pr create --base <base> --head ft/<slug> --title … --body … --reviewer …`.
4. **Never** merge them, use admin bypass, approve your own PR, or tag. Merging to protected branches is the reviewers' and maintainers' call.

## 6. Handoff and retro

- **Handoff:** write it with `/team:session-handoff` if available, or follow its conventions. Point it at the spec folder, the PR links, open follow-ups, and who has to act.
- **Retro:** add three short lines to `LOG.md` with `$SDD log --phase close`:
  - what worked;
  - what cost time;
  - what to change next time.
  If a kit or skill change would help, note it as a suggestion in the handoff. Don't edit `docs/specs/_kit/` in the project repo.

## 7. Close

- Remove any leftover worktrees of ours (`git worktree list`, then `git worktree remove` for this slug's paths). Stop any containers of ours.
- Run `$SDD spec-status closed --note "PRs open: <links>; awaiting review"`.
- Commit `docs(<slug>): close`, then run `$SDD push`.
- Don't delete remote branches. They belong to the open PRs.
