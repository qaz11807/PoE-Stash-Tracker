#!/usr/bin/env bash
# check-agents.sh — Monitors all active agents; runs every 10 min via cron
# Checks tmux liveness, PR status, CI status, auto-respawns on failure (max 3 attempts)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAWDBOT_DIR="${REPO_DIR}/.clawdbot"
TASKS_FILE="${CLAWDBOT_DIR}/active-tasks.json"
MAX_ATTEMPTS=3

log() { echo "[$(date -u +%H:%M:%SZ)] $*"; }

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required." >&2; exit 1
fi

TASKS=$(cat "${TASKS_FILE}")
COUNT=$(echo "${TASKS}" | jq 'length')
log "Checking ${COUNT} task(s)..."

UPDATED_TASKS="[]"

while IFS= read -r TASK; do
  ID=$(echo "${TASK}"        | jq -r '.id')
  SESSION=$(echo "${TASK}"   | jq -r '.tmuxSession')
  BRANCH=$(echo "${TASK}"    | jq -r '.branch')
  STATUS=$(echo "${TASK}"    | jq -r '.status')
  ATTEMPTS=$(echo "${TASK}"  | jq -r '.attempts')
  AGENT=$(echo "${TASK}"     | jq -r '.agent')
  MODEL=$(echo "${TASK}"     | jq -r '.model')
  WORKTREE=$(echo "${TASK}"  | jq -r '.worktree')
  DESC=$(echo "${TASK}"      | jq -r '.description')

  if [[ "${STATUS}" == "done" || "${STATUS}" == "failed" ]]; then
    log "  [${ID}] Already ${STATUS}, skipping."
    UPDATED_TASKS=$(echo "${UPDATED_TASKS}" | jq --argjson t "${TASK}" '. + [$t]')
    continue
  fi

  log "  [${ID}] status=${STATUS} session=${SESSION} branch=${BRANCH}"

  # --- 1. Check tmux ---
  TMUX_ALIVE=false
  if tmux has-session -t "${SESSION}" 2>/dev/null; then
    TMUX_ALIVE=true
    log "    tmux: alive"
  else
    log "    tmux: DEAD"
  fi

  # --- 2. Check for PR ---
  PR_NUM=""
  PR_NUM=$(gh pr list --repo "${REPO_DIR}" --head "${BRANCH}" --json number --jq '.[0].number // empty' 2>/dev/null || true)
  if [[ -n "${PR_NUM}" ]]; then
    log "    PR: #${PR_NUM} found"
  else
    log "    PR: none yet"
  fi

  # --- 3. Check CI ---
  CI_STATUS=""
  if [[ -n "${PR_NUM}" ]]; then
    CI_STATUS=$(gh pr checks "${PR_NUM}" --repo "${REPO_DIR}" 2>/dev/null \
      | awk '{print $2}' | sort | uniq \
      | (grep -c "fail" || true) | xargs -I{} bash -c 'if [ {} -gt 0 ]; then echo fail; else echo pass; fi')
    log "    CI: ${CI_STATUS:-unknown}"
  fi

  # --- 4. Determine new status ---
  NEW_STATUS="${STATUS}"
  NOTE=""

  if [[ -n "${PR_NUM}" && "${CI_STATUS}" == "pass" ]]; then
    NEW_STATUS="done"
    NOTE="PR #${PR_NUM} created, CI passed. Ready to merge."
    log "    => DONE — ${NOTE}"

    # Notify via Discord
    openclaw send discord "channel:1476575892875644973" \
      "✅ **Task \`${ID}\` done!** PR #${PR_NUM} ready to merge.
> ${DESC:0:100}" 2>/dev/null || true

  elif [[ "${TMUX_ALIVE}" == "false" && -z "${PR_NUM}" ]]; then
    # Agent died without creating a PR — respawn if attempts < max
    if [[ "${ATTEMPTS}" -ge "${MAX_ATTEMPTS}" ]]; then
      NEW_STATUS="failed"
      NOTE="Agent died ${ATTEMPTS} times without a PR. Manual intervention required."
      log "    => FAILED (max attempts reached)"
    else
      NEW_STATUS="respawning"
      NOTE="Agent died, respawning (attempt $((ATTEMPTS+1))/${MAX_ATTEMPTS})"
      log "    => RESPAWNING..."

      NEW_ATTEMPTS=$((ATTEMPTS+1))
      RUNNER="${CLAWDBOT_DIR}/run-${ID}.sh"
      if [[ -f "${RUNNER}" ]]; then
        tmux new-session -d -s "${SESSION}" -c "${WORKTREE}" \
          "bash '${RUNNER}' 2>&1 | tee '${CLAWDBOT_DIR}/log-${ID}-attempt${NEW_ATTEMPTS}.txt'"
        TASK=$(echo "${TASK}" | jq --arg a "${NEW_ATTEMPTS}" '.attempts = ($a | tonumber) | .status = "running"')
        NEW_STATUS="running"
      else
        log "    Runner script missing, cannot respawn."
        NEW_STATUS="failed"
      fi
    fi
  fi

  # Update task
  TASK=$(echo "${TASK}" | jq \
    --arg s "${NEW_STATUS}" \
    --arg n "${NOTE}" \
    --arg pr "${PR_NUM:-}" \
    '.status = $s | .note = $n | if $pr != "" then .pr = ($pr | tonumber) else . end')

  UPDATED_TASKS=$(echo "${UPDATED_TASKS}" | jq --argjson t "${TASK}" '. + [$t]')

done < <(echo "${TASKS}" | jq -c '.[]')

echo "${UPDATED_TASKS}" > "${TASKS_FILE}"
log "Done. Tasks updated in ${TASKS_FILE}"
