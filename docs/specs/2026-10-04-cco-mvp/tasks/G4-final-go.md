---
id: G4
title: Human — final go for the demo and PR to dev
kind: gate
deps: [VA]
owns: []
repo: .
needs: [gh]
verify: test -f docs/specs/2026-10-04-cco-mvp/gates/G4-final-go.md
review: none
status: todo
---

# G4 — Human: final go for the demo and PR to `dev`

## Definition of done

- [ ] `/roman-verify` writes the gate file with the measured results.
- [ ] Roman decides go / no-go.
- [ ] On go, the PR `ft/cco-mvp → dev` is opened (not merged by an agent).
