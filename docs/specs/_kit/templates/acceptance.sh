#!/usr/bin/env bash
# Acceptance checks for this work folder: one `check` line per criterion in SPEC §9.
# Run from the repo root on the integration branch. Exits non-zero if any criterion fails.
# Follow docs/specs/README.md "Sharing the machine" when a check starts containers.
set -u
fail=0
check() {
  local id="$1"; shift
  if bash -c "$*"; then echo "PASS $id"; else echo "FAIL $id"; fail=1; fi
}

# check AC1 'command that exits 0 only when AC1 holds'

exit "$fail"
