#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: delete_data.sh [--yes]

Removes the local data/ directory. Prompts for confirmation unless --yes is provided.
EOF
}

CONFIRM=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y)
      CONFIRM=0
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
DATA_DIR="${REPO_ROOT}/data"

if [[ ! -d "${DATA_DIR}" ]]; then
  echo "No data/ directory found at ${DATA_DIR}"
  exit 0
fi

if [[ "${CONFIRM}" -ne 0 ]]; then
  read -r -p "Delete ${DATA_DIR}? [y/N]: " answer
  case "${answer}" in
    y|Y) ;;
    *)
      echo "Aborted."
      exit 1
      ;;
  esac
fi

rm -rf -- "${DATA_DIR}"
echo "Deleted ${DATA_DIR}"
