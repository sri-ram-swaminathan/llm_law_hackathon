# Preflight — ${slug}

## Branching (restated by the agent, confirmed by a human)

- Base branch: `${base}`, taken from origin, never pushed to, merged into or tagged by the agent.
- Integration branch: `ft/${slug}`, created off `${base}`. Task branches `ft/${slug}-<id>` come off it and merge back with `--no-ff` after verification.
- Final step: a PR from `ft/${slug}` to `${base}`, merged by a human per the repo's review rules.
- Pushing: per the SPEC `push` setting; never `--force` on the integration branch.
- Confirmed by: <!-- name, date -->

## Access and environment

<!-- sdd:access:start -->
_Not checked yet. Run `sdd preflight --basic --write` (spec) or `sdd preflight --write` (plan)._
<!-- sdd:access:end -->

## Blockers and waivers

<!-- Anything missing, and who waived it and why. -->
