#!/bin/bash
# Captures every change in the working tree, committed or not, against the starting commit.
set -euo pipefail
out=/logs/artifacts/model.patch
mkdir -p /logs/artifacts
rm -f "$out"
cd /app
git config --global --add safe.directory /app 2>/dev/null || true
if ! git rev-parse --verify --quiet "a879adb037d7177449b75ea7304f05bfe1960b77^{commit}" >/dev/null; then
  echo "[pre_artifacts] error: the starting commit a879adb037d7177449b75ea7304f05bfe1960b77 is not in this repository; nothing captured" >&2
  exit 1
fi
git add -u
git add -A -- . ':(exclude,glob)**/__pycache__/**' ':(exclude,glob)**/*.pyc' ':(exclude,glob)**/*.pyo' ':(exclude,glob)**/node_modules/**' ':(exclude,glob)**/target/**' ':(exclude,glob)**/dist/**' ':(exclude,glob)**/.venv/**' ':(exclude,glob)**/venv/**' ':(exclude,glob)**/.pytest_cache/**' ':(exclude,glob)**/.mypy_cache/**' ':(exclude,glob)**/.ruff_cache/**' ':(exclude,glob)**/.tox/**' ':(exclude,glob)**/.coverage' ':(exclude,glob)**/.coverage.*' ':(exclude,glob)**/coverage/**' ':(exclude,glob)**/htmlcov/**' ':(exclude,glob)**/.nyc_output/**' ':(exclude,glob)**/coverage.xml' ':(exclude,glob)**/lcov.info'
git diff --binary --cached a879adb037d7177449b75ea7304f05bfe1960b77 > "$out.tmp"
if [ ! -s "$out.tmp" ]; then
  rm -f "$out.tmp"
  echo "[pre_artifacts] error: the working tree has no changes against a879adb037d7177449b75ea7304f05bfe1960b77; nothing captured" >&2
  exit 2
fi
mv "$out.tmp" "$out"
echo "[pre_artifacts] captured $(wc -c < "$out") bytes"
