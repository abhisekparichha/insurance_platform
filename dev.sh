#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# dev.sh — development mode with hot-reload
#
# Runs two processes side by side:
#   • API server  on port 3001  (tsx watch — restarts on any .ts change)
#   • Vite dev UI on port 5173  (HMR — instant browser refresh)
#
# Usage:
#   chmod +x dev.sh
#   ./dev.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo ""
echo "  Insurance Platform — Dev Mode"
echo "  ────────────────────────────────"
echo "  API  →  http://localhost:3001"
echo "  UI   →  http://localhost:5173"
echo ""

pnpm install --silent
cd "$ROOT_DIR/frontend" && pnpm install --silent && cd "$ROOT_DIR"

pnpm dev
