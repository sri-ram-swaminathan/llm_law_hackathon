---
id: G2
title: Human — short UI demo and feedback before wave 3
kind: gate
deps: [V2]
owns: []
repo: .
needs: []
verify: test -f docs/specs/2026-10-04-cco-mvp/gates/G2-ui-demo.md
review: none
status: done
---

# G2 — Human: short UI demo and feedback before wave 3

## Goal

Roman clicks through the product as it stands (Overview → Run → live activity → Finding workspace → legal drawer → counsel review). He decides go/no-go and lists UI changes before more features land.

## Definition of done

- [ ] The orchestrator runs `make dev` and shares the URL, deploy token and a 2-minute walkthrough script.
- [ ] Roman's feedback is recorded in `gates/G2-ui-demo.md`. Accepted changes become tasks in wave 3 (`sdd add`) or join T19 (polish).
- [ ] Decision: go / adjust.
