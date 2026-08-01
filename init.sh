#!/usr/bin/env bash
set -euo pipefail

echo "=== Agent Team Studio Init ==="
echo ""
echo "[1/6] Installing dependencies..."
npm install
echo ""
echo "[2/6] Running type checks..."
npm run check
echo ""
echo "[3/6] Running tests..."
npm test
echo ""
echo "[4/6] Building project..."
npm run build
echo ""
echo "[5/6] Verifying harness files..."
FILES_OK=true
for file in README.md AGENTS.md CLAUDE.md feature_list.json clean-state-checklist.md session-handoff.md evaluator-rubric.md docs/quality-document.md docs/ARCHITECTURE.md docs/PRODUCT.md docs/RELIABILITY.md scripts/dev.js scripts/benchmark.sh scripts/cleanup-scanner.sh init.sh; do
  if [ ! -f "$file" ]; then
    echo "  MISSING: $file"
    FILES_OK=false
  else
    echo "  OK: $file"
  fi
done
echo ""
echo "[6/6] Running cleanup scanner..."
bash scripts/cleanup-scanner.sh
echo ""
if [ "$FILES_OK" = true ]; then
  echo "=== Init complete. All checks passed. ==="
else
  echo "=== Init complete with warnings. Some harness files are missing. ==="
  exit 1
fi
