#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SKIP_PYTHON_INSTALL=0
SKIP_NODE_INSTALL=0
SKIP_NODE_TASKS=0
SKIP_PIPELINE=0
PIPELINE_ARGS=()

usage() {
  cat <<'EOF'
Usage: scripts/install_and_run.sh [options] [-- <pipeline args>]

Installs Python + Node dependencies, then runs the data pipeline and TypeScript quality gates.

Options:
  --skip-python-install   Skip creating/updating the Python virtual environment.
  --skip-node-install     Skip installing Node.js dependencies via pnpm.
  --skip-node-tasks       Skip pnpm lint/typecheck/test.
  --skip-pipeline         Skip running the Python ingestion pipeline.
  --help                  Show this message.

Any arguments after `--` are forwarded to `python -m src.pipeline`.

Environment overrides:
  PYTHON_BIN   Python executable to use (default: python3)
  VENV_DIR     Virtual environment directory (default: .venv)
  PNPM_BIN     pnpm executable to use (default: pnpm)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-python-install)
      SKIP_PYTHON_INSTALL=1
      shift
      ;;
    --skip-node-install)
      SKIP_NODE_INSTALL=1
      shift
      ;;
    --skip-node-tasks)
      SKIP_NODE_TASKS=1
      shift
      ;;
    --skip-pipeline)
      SKIP_PIPELINE=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --)
      shift
      PIPELINE_ARGS=("$@")
      break
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

log() {
  echo "[setup] $*"
}

fail() {
  echo "[error] $*" >&2
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required command '$1' is not available on PATH."
  fi
}

PYTHON_BIN="${PYTHON_BIN:-python3}"
PNPM_BIN="${PNPM_BIN:-pnpm}"
VENV_DIR="${VENV_DIR:-.venv}"

require_cmd "$PYTHON_BIN"

if [[ $SKIP_PYTHON_INSTALL -eq 0 ]]; then
  if [[ ! -d "$VENV_DIR" ]]; then
    log "Creating virtual environment in $VENV_DIR"
    "$PYTHON_BIN" -m venv "$VENV_DIR"
  fi
  # shellcheck disable=SC1090
  source "$VENV_DIR/bin/activate"
  log "Upgrading pip inside $VENV_DIR"
  python -m pip install --upgrade pip
  log "Installing Python requirements"
  python -m pip install -r requirements.txt
else
  if [[ -d "$VENV_DIR" ]]; then
    # shellcheck disable=SC1090
    source "$VENV_DIR/bin/activate"
  fi
fi

PYTHON_RUNNER="${PYTHON_BIN}"
if [[ -n "${VIRTUAL_ENV:-}" ]]; then
  PYTHON_RUNNER="python"
fi

if [[ $SKIP_NODE_INSTALL -eq 0 || $SKIP_NODE_TASKS -eq 0 ]]; then
  require_cmd "$PNPM_BIN"
fi

if [[ $SKIP_NODE_INSTALL -eq 0 ]]; then
  log "Installing Node dependencies via pnpm"
  "$PNPM_BIN" install --frozen-lockfile
fi

if [[ $SKIP_PIPELINE -eq 0 ]]; then
  log "Running insurance data pipeline ${PIPELINE_ARGS[*]:-}"
  "$PYTHON_RUNNER" -m src.pipeline "${PIPELINE_ARGS[@]}"
else
  log "Skipping pipeline execution"
fi

if [[ $SKIP_NODE_TASKS -eq 0 ]]; then
  require_cmd "$PNPM_BIN"
  log "Running pnpm lint"
  "$PNPM_BIN" lint
  log "Running pnpm typecheck"
  "$PNPM_BIN" typecheck
  log "Running pnpm test"
  "$PNPM_BIN" test
else
  log "Skipping Node quality gates"
fi

log "All steps completed successfully."
