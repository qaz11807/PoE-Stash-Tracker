#!/usr/bin/env bash
# check-agents.sh — Monitors all active agents; runs every 10 min via cron
# Checks tmux liveness, PR status, CI status, auto-respawns on failure (max 3 attempts)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAWDBOT_DIR="${REPO_DIR}/.clawdbot"

# Load local env (not committed to git)
[[ -f "${CLAWDBOT_DIR}/.env" ]] && source "${CLAWDBOT_DIR}/.env"
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
  REPO_SLUG=$(cd "${REPO_DIR}" && gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || true)
  PR_NUM=$(gh pr list --repo "${REPO_SLUG}" --head "${BRANCH}" --json number --jq '.[0].number // empty' 2>/dev/null || true)
  REVIEWED=$(echo "${TASK}" | jq -r '.reviewed // "false"')
  if [[ -n "${PR_NUM}" ]]; then
    log "    PR: #${PR_NUM} found (reviewed=${REVIEWED})"
  else
    log "    PR: none yet"
  fi

  # --- 3. Check CI (optional) ---
  CI_STATUS="none"
  if [[ -n "${PR_NUM}" ]]; then
    set +e
    FAIL_COUNT=$(gh pr checks "${PR_NUM}" --repo "${REPO_SLUG}" 2>/dev/null | awk '{print $2}' | grep -c "fail" || true)
    FAIL_COUNT="${FAIL_COUNT:-0}"
    set -e
    if [[ "${FAIL_COUNT}" -gt 0 ]]; then
      CI_STATUS="fail"
    fi
    log "    CI: ${CI_STATUS}"
  fi

  # --- 4. Determine new status ---
  NEW_STATUS="${STATUS}"
  NOTE=""

  if [[ -n "${PR_NUM}" && "${TMUX_ALIVE}" == "false" ]]; then
    # PR exists and agent has finished → done (no CI required)
    NEW_STATUS="done"
    NOTE="PR #${PR_NUM} created. Ready to review and merge."
    log "    => DONE — ${NOTE}"

    # Notify via Discord
    if [[ -n "${CLAWDBOT_DISCORD_CHANNEL:-}" ]]; then
      PR_URL=$(gh pr view "${PR_NUM}" --repo "${REPO_SLUG}" --json url --jq '.url' 2>/dev/null || true)
      openclaw message send \
        --channel discord \
        --target "channel:${CLAWDBOT_DISCORD_CHANNEL}" \
        --message "✅ **Task \`${ID}\` 完成！** PR #${PR_NUM} 等待 Review。
${PR_URL}
> ${DESC:0:100}" 2>/dev/null || true
    fi

    # Trigger code review if not yet done
    if [[ "${REVIEWED}" == "false" ]]; then
      log "    => Triggering auto code review for PR #${PR_NUM}..."
      TASK=$(echo "${TASK}" | jq '.reviewed = "true"')
      bash "${CLAWDBOT_DIR}/review-pr.sh" "${PR_NUM}" "${REPO_DIR}" >> "${CLAWDBOT_DIR}/monitor.log" 2>&1 &
    fi

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
