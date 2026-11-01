#!/bin/bash
# Grades the change against tests/grader/grader.yaml and tests/grader/rubric.toml.
set -uo pipefail
V=/logs/verifier
RUNTIME=/opt/judge
log() { echo "[verifier] $*"; }
mkdir -p "$V"

trap 'if [ ! -f "$V/reward.json" ] && [ ! -f "$V/reward.txt" ] && [ ! -f "$V/ungraded.json" ]; then echo -1 > "$V/reward.txt"; fi' EXIT
rm -f "$V/reward.json" "$V/reward.txt" "$V/ungraded.json" "$V/grade.json"
cd /app || exit 6
"$RUNTIME/python/bin/python3" -I "$RUNTIME/run_criteria.py" verify
_rc=$?
log "reward.json=$(cat "$V/reward.json" 2>/dev/null)"
exit "$_rc"
