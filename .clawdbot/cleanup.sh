#!/usr/bin/env bash
# cleanup.sh — Daily cleanup of done/failed tasks, orphaned worktrees and tmux sessions
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAWDBOT_DIR="${REPO_DIR}/.clawdbot"
TASKS_FILE="${CLAWDBOT_DIR}/active-tasks.json"

log() { echo "[cleanup $(date -u +%H:%M:%SZ)] $*"; }

if ! command -v jq &>/dev/null; then echo "jq required" >&2; exit 1; fi

TASKS=$(cat "${TASKS_FILE}")

while IFS= read -r TASK; do
  ID=$(echo "${TASK}"      | jq -r '.id')
  STATUS=$(echo "${TASK}"  | jq -r '.status')
  SESSION=$(echo "${TASK}" | jq -r '.tmuxSession')
  WORKTREE=$(echo "${TASK}"| jq -r '.worktree')

  if [[ "${STATUS}" == "done" || "${STATUS}" == "failed" ]]; then
    log "Cleaning up task ${ID} (${STATUS})..."

    # Kill tmux session
    tmux kill-session -t "${SESSION}" 2>/dev/null && log "  Killed tmux: ${SESSION}" || true

    # Remove worktree
    if [[ -d "${WORKTREE}" ]]; then
      git -C "${REPO_DIR}" worktree remove "${WORKTREE}" --force 2>/dev/null \
        && log "  Removed worktree: ${WORKTREE}" || log "  Could not remove worktree (may be already gone)"
    fi

    # Archive runner + log
    ARCHIVE_DIR="${CLAWDBOT_DIR}/archive"
    mkdir -p "${ARCHIVE_DIR}"
    mv "${CLAWDBOT_DIR}/run-${ID}.sh"  "${ARCHIVE_DIR}/" 2>/dev/null || true
    mv "${CLAWDBOT_DIR}/log-${ID}"*.txt "${ARCHIVE_DIR}/" 2>/dev/null || true
  fi
done < <(echo "${TASKS}" | jq -c '.[]')

# Remove done/failed tasks from registry (keep last 20 in archive)
ACTIVE=$(echo "${TASKS}" | jq '[.[] | select(.status != "done" and .status != "failed")]')
echo "${ACTIVE}" > "${TASKS_FILE}"
log "Registry pruned. ${#ACTIVE} active task(s) remaining."
