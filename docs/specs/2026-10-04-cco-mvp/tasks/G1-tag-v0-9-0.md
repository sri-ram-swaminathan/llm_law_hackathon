---
id: G1
title: Human — FinTechProto v0.9.0 on main + tag
kind: gate
deps: []
owns: []
repo: ../FinTechProto
needs: [gh]
verify: git -C ../FinTechProto rev-parse -q --verify refs/tags/v0.9.0
review: none
status: todo
---

# G1 — Human: FinTechProto v0.9.0 on `main` + tag

## Goal

Roman publishes the non-compliant baseline release, so the eval, the demo bundles and CI have a fixed anchor.

## Context

SPEC §6.9 and D12. Agents never commit to FinTechProto's `main` or tag it.

## Definition of done

- [ ] `81bbbbe` (business plan + `version`) is cherry-picked onto `main` and pushed. · `git -C ../FinTechProto log origin/main --oneline -1`
- [ ] `git diff dbb8e64 v0.9.0 -- backend frontend` is empty. · that command
- [ ] Tag `v0.9.0` is pushed. · the verify command

## Notes

Commands for Roman:

```bash
cd ../FinTechProto
git switch main && git pull
git cherry-pick 81bbbbe
git push origin main
git tag v0.9.0 && git push origin v0.9.0
```
