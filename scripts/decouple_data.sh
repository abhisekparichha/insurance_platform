#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

GITIGNORE_FILE="${REPO_ROOT}/.gitignore"
TARGET_ENTRY="data/"

touch "${GITIGNORE_FILE}"

if ! grep -Fxq "${TARGET_ENTRY}" "${GITIGNORE_FILE}"; then
  if [[ -s "${GITIGNORE_FILE}" && "$(tail -c 1 "${GITIGNORE_FILE}")" != $'\n' ]]; then
    printf '\n' >> "${GITIGNORE_FILE}"
  fi
  printf '%s\n' "${TARGET_ENTRY}" >> "${GITIGNORE_FILE}"
  echo "Added ${TARGET_ENTRY} to .gitignore"
else
  echo "${TARGET_ENTRY} already present in .gitignore"
fi

git add "${GITIGNORE_FILE}"

tracked_paths="$(git ls-files --cached -- data/ || true)"
if [[ -n "${tracked_paths}" ]]; then
  git rm -r --cached data
  echo "Removed data/ from git index"
else
  echo "data/ is not currently tracked; skipping git rm"
fi

if git diff --cached --quiet; then
  echo "No staged changes to commit."
else
  git commit -m "chore: stop tracking data/ and update .gitignore"
fi
