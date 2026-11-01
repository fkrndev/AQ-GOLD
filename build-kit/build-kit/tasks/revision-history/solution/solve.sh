#!/bin/bash
# Applies the reference change to the working tree and commits it.
set -euo pipefail
cd /app
git apply --whitespace=nowarn /solution/patch.diff
git checkout -q -b feature/solution 2>/dev/null || true
git add -A
git diff --cached --quiet || git -c user.name="oracle" -c user.email="oracle@local" commit -q --no-verify -m "Apply reference change"
