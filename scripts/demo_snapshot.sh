#!/usr/bin/env bash
# Capture the demo snapshot from real live runs: `cco audit` on the three Wealthpilot bundles (live Mistral),
# each accepted only if it matches demo/wealthpilot/expected.yaml with evidence on every blocker/high finding
# (python -m cco.demo accept); a release is retried at most 2 times. The W8 counsel review (not_applicable)
# travels from 0.9.0 to rc and 1.0.0 in the baseline. Writes demo/snapshot/<release>/result.json + MANIFEST.json.
# Needs MISTRAL_API_KEY (from .env) and the FinTechProto checkout (FINTECHPROTO, default ../FinTechProto).
set -euo pipefail
export PYDANTIC_AI_NO_BANNER=1
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SNAP="$ROOT/demo/snapshot"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/cco-snapshot.XXXXXX")"
MAX_ATTEMPTS=3   # first try + 2 retries
cd "$ROOT/backend"
py() { uv run --quiet python -m cco.demo "$@"; }

# key  snapshot-dir  bundle-folder  version  FinTechProto-ref
RELEASES=(
  "0.9.0 0.9.0 v0.9.0 0.9.0 v0.9.0"
  "rc 1.0.0-rc rc 1.0.0-rc.12 demo/rc"
  "1.0.0 1.0.0 v1.0.0 1.0.0 demo/v1"
)
baseline=()
for line in "${RELEASES[@]}"; do
  read -r key dir folder version ref <<<"$line"
  sha="$(py commit "$ref")"
  ok=0
  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    out="$WORK/$dir"
    rm -rf "$out"
    echo "== $version ($ref @ ${sha:0:7}) attempt $attempt"
    uv run --quiet cco audit --bundle "$ROOT/demo/wealthpilot/$folder/upload" --version "$version" --sha "$sha" \
      --branch "$ref" --out "$out" ${baseline[@]+"${baseline[@]}"} || true   # exit 1 = NOT_READY is a valid verdict
    if py accept "$out/result.json" "$key" --attempt "$attempt"; then ok=1; break; fi
  done
  [[ $ok == 1 ]] || { echo "release $version not accepted after $MAX_ATTEMPTS attempts; snapshot unchanged" >&2; exit 1; }
  py baseline "$out/result.json" "$WORK/baseline.json"
  baseline=(--baseline "$WORK/baseline.json")
done

rm -rf "$SNAP"
for line in "${RELEASES[@]}"; do
  read -r key dir _ <<<"$line"
  mkdir -p "$SNAP/$dir"
  cp "$WORK/$dir/result.json" "$SNAP/$dir/result.json"
done
py manifest --snapshot "$SNAP" --work "$WORK"
echo "snapshot written to $SNAP (work dir $WORK)"
