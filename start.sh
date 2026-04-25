#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start.sh — one-command production startup for Ubuntu
#
# What it does:
#   1. Installs all dependencies (root + frontend)
#   2. Builds the React frontend into frontend/dist/
#   3. Starts the Express API server on PORT (default 3001)
#      The server also serves the built frontend at the same port.
#
# Usage:
#   chmod +x start.sh
#   ./start.sh            # starts on port 3001
#   PORT=8080 ./start.sh  # starts on custom port
# ─────────────────────────────────────────────────────────────────────────────
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-3001}"
VENV="$ROOT_DIR/.venv"

# Activate Python venv if present (created by install.sh)
if [ -d "$VENV" ]; then
    source "$VENV/bin/activate"
fi

echo ""
echo "  Insurance Platform — Production Start"
echo "  ──────────────────────────────────────"

# 1. Root dependencies
echo "  [1/3] Installing dependencies..."
cd "$ROOT_DIR"
pnpm install --silent

# 2. Build frontend
echo "  [2/3] Building frontend..."
cd "$ROOT_DIR/frontend"
pnpm install --silent
pnpm build
cd "$ROOT_DIR"

# 3. Start server
echo "  [3/3] Starting server on port $PORT..."
echo ""
PORT=$PORT node --import tsx/esm server/index.ts
