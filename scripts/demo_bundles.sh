#!/usr/bin/env bash
# Build demo/wealthpilot/{v0.9.0,rc,v1.0.0}/upload/ (code.zip + compliance/*.md) from FinTechProto refs.
# Read-only on the FinTechProto checkout (git archive only). Code only: no node_modules, lockfiles, .env.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FTP="${FINTECHPROTO_DIR:-$HOME/Documents/projects/FinTechProto}"
DOCS_REF="${DOCS_REF:-dbd5d3c}"   # ft/cco-mvp commit that carries privacy-policy/terms/cif-registration
OUT="$ROOT/demo/wealthpilot"

build() { # <name> <ref> <compliance files...>
  local name="$1" ref="$2"; shift 2
  local up="$OUT/$name/upload" tmp; tmp="$(mktemp -d)"
  git -C "$FTP" rev-parse --verify -q "$ref^{commit}" >/dev/null || { echo "missing ref $ref in $FTP" >&2; exit 1; }
  git -C "$FTP" archive "$ref" | tar -x -C "$tmp"
  mkdir -p "$tmp/compliance"
  for f in "$@"; do   # overlay docs the ref lacks
    [ -f "$tmp/compliance/$f" ] || git -C "$FTP" show "$DOCS_REF:compliance/$f" > "$tmp/compliance/$f"
  done
  for f in "$tmp"/compliance/*.md; do
    case " $* " in *" $(basename "$f") "*) ;; *) rm -f "$f";; esac
  done
  rm -rf "$up"; mkdir -p "$up/compliance"
  cp "$tmp"/compliance/*.md "$up/compliance/"
  (cd "$tmp" && find . -type f ! -path './compliance/*' ! -path '*/node_modules/*' ! -path './.git/*' \
      ! -name '*.lock' ! -name 'package-lock.json' ! -name '.env' ! -name '*.pem' ! -name '*.key' \
      | sed 's|^\./||' | LC_ALL=C sort | zip -q -X -@ "$up/code.zip")
  rm -rf "$tmp"
  echo "$name: $(du -sh "$up/code.zip" | cut -f1) code.zip, $(ls "$up/compliance" | wc -l | tr -d ' ') compliance docs"
}

build v0.9.0 v0.9.0 business-plan.md
build rc demo/rc business-plan.md privacy-policy.md terms.md
build v1.0.0 demo/v1 business-plan.md privacy-policy.md terms.md cif-registration.md
