#!/usr/bin/env bash
set -euo pipefail

echo "=== Agent Team Studio Benchmark ==="
echo "[1/2] Building project..."
npm run build
echo ""
echo "[2/2] Running service benchmarks..."
node scripts/benchmark.cjs
