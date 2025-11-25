#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: refresh_data.sh [--no-download]

Deletes the current data/ directory and re-runs the ingestion pipeline.
Use --no-download to pass --no-download-documents to the pipeline.
EOF
}

NO_DOWNLOAD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-download)
      NO_DOWNLOAD=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DELETE_SCRIPT="${SCRIPT_DIR}/delete_data.sh"

"${DELETE_SCRIPT}" --yes

if command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  echo "Python is not installed or not in PATH." >&2
  exit 1
fi

PIPELINE_ARGS=()
if [[ "${NO_DOWNLOAD}" -eq 1 ]]; then
  PIPELINE_ARGS+=(--no-download-documents)
fi

cd "${REPO_ROOT}"
"${PYTHON_BIN}" -m src.pipeline "${PIPELINE_ARGS[@]}"
