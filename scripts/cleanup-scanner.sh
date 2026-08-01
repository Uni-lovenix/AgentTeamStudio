#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ISSUES=0

check_file() {
  if [ -f "$1" ]; then
    echo "[OK] $1"
  else
    echo "[MISSING] $1"
    ISSUES=$((ISSUES + 1))
  fi
}

echo "=== Agent Team Studio Cleanup Scanner ==="
for file in README.md AGENTS.md CLAUDE.md feature_list.json clean-state-checklist.md session-handoff.md evaluator-rubric.md docs/quality-document.md docs/ARCHITECTURE.md docs/PRODUCT.md docs/RELIABILITY.md scripts/dev.js scripts/benchmark.sh scripts/cleanup-scanner.sh init.sh; do
  check_file "$file"
done

if [ -d dist ]; then
  echo "[WARN] dist/ exists (build artifact)"
else
  echo "[OK] dist/ absent"
fi

STALE=$(find src test scripts -name '*.tmp' -o -name '*.bak' 2>/dev/null | wc -l | tr -d ' ')
if [ "$STALE" -eq 0 ]; then
  echo "[OK] No temporary or backup files"
else
  echo "[STALE] $STALE temporary/backup files found"
  ISSUES=$((ISSUES + 1))
fi

if [ "$ISSUES" -eq 0 ]; then
  echo "=== Result: CLEAN (0 issues) ==="
else
  echo "=== Result: $ISSUES issue(s) found ==="
  exit 1
fi
