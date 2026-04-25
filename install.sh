#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# install.sh — first-time setup for Ubuntu/Debian Linux
#
# Run once on a fresh machine. Safe to re-run; each step is idempotent.
#
# Usage:
#   chmod +x install.sh
#   ./install.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

REPO_URL="https://github.com/abhisekparichha/insurance_platform.git"
INSTALL_DIR="$HOME/insurance_platform"
NODE_VERSION="20"
PORT="${PORT:-3001}"

log() { echo ""; echo "  ▶  $1"; }
ok()  { echo "  ✓  $1"; }

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   Insurance Platform — Installer     ║"
echo "  ╚══════════════════════════════════════╝"

# ── 1. System packages ─────────────────────────────────────────────────────────
log "Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
    curl git build-essential python3 python3-pip python3-venv \
    python3-dev ca-certificates gnupg lsb-release
ok "System packages ready"

# ── 2. Node.js ─────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -e 'process.stdout.write(process.version.slice(1).split(".")[0])')" -lt "$NODE_VERSION" ]]; then
    log "Installing Node.js $NODE_VERSION..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | sudo -E bash - -qq
    sudo apt-get install -y -qq nodejs
fi
ok "Node.js $(node --version)"

# ── 3. pnpm ────────────────────────────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
    log "Installing pnpm..."
    npm install -g pnpm --silent
fi
ok "pnpm $(pnpm --version)"

# ── 4. Python dependencies ─────────────────────────────────────────────────────
log "Installing Python dependencies..."
if [ ! -d "$INSTALL_DIR" ]; then
    git clone "$REPO_URL" "$INSTALL_DIR" -q
fi
cd "$INSTALL_DIR"
pip install -r requirements.txt -q
ok "Python dependencies installed"

# ── 5. Build & start ───────────────────────────────────────────────────────────
log "Building frontend and starting server..."
chmod +x start.sh

# ── 6. Systemd service (optional, asks user) ───────────────────────────────────
echo ""
read -r -p "  Install as a systemd service (auto-start on boot)? [y/N] " INSTALL_SERVICE
if [[ "$INSTALL_SERVICE" =~ ^[Yy]$ ]]; then
    SERVICE_FILE="/etc/systemd/system/insurance-platform.service"
    sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Insurance Platform
After=network.target

[Service]
WorkingDirectory=$INSTALL_DIR
ExecStart=/bin/bash $INSTALL_DIR/start.sh
Restart=on-failure
RestartSec=5
User=$USER
Environment=PORT=$PORT

[Install]
WantedBy=multi-user.target
EOF
    sudo systemctl daemon-reload
    sudo systemctl enable insurance-platform
    sudo systemctl start insurance-platform
    ok "Service installed and started"
    echo ""
    echo "  Manage with:"
    echo "    sudo systemctl status insurance-platform"
    echo "    sudo systemctl restart insurance-platform"
    echo "    sudo journalctl -u insurance-platform -f"
else
    PORT=$PORT ./start.sh
fi

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║  App running at http://localhost:$PORT  ║"
echo "  ╚══════════════════════════════════════╝"
echo ""
