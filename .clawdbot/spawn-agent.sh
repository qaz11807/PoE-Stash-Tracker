#!/usr/bin/env bash
# spawn-agent.sh — Create a git worktree and launch a coding agent in tmux
# Usage: spawn-agent.sh <task-id> <branch-name> <agent: codex|claude> <model> <reasoning: low|medium|high> "<prompt>"
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKTREES_DIR="${REPO_DIR}-worktrees"
CLAWDBOT_DIR="${REPO_DIR}/.clawdbot"
TASKS_FILE="${CLAWDBOT_DIR}/active-tasks.json"

TASK_ID="${1:?task-id required}"
BRANCH="${2:?branch-name required}"
AGENT="${3:?agent (codex|claude) required}"
MODEL="${4:?model required}"
REASONING="${5:-medium}"
PROMPT="${6:?prompt required}"

WORKTREE_PATH="${WORKTREES_DIR}/${TASK_ID}"
TMUX_SESSION="agent-${TASK_ID}"

echo "==> Spawning agent for task: ${TASK_ID}"
echo "    Branch:  ${BRANCH}"
echo "    Agent:   ${AGENT} (${MODEL}, reasoning=${REASONING})"
echo "    Worktree: ${WORKTREE_PATH}"

# 1. Create worktree
git -C "${REPO_DIR}" fetch origin main
if git -C "${REPO_DIR}" branch --list | grep -q "^  ${BRANCH}$\|^\* ${BRANCH}$"; then
  echo "    Branch already exists locally, reusing."
else
  git -C "${REPO_DIR}" worktree add "${WORKTREE_PATH}" -b "${BRANCH}" origin/main
fi

# 2. Kill existing tmux session if any
tmux kill-session -t "${TMUX_SESSION}" 2>/dev/null || true

# 3. Build PR body template and full prompt
PR_BODY="## 需求來源

由 AI Agent 自動執行任務：${TASK_ID}

## 功能/問題描述

${PROMPT:0:300}

## 作法

由 Codex/Claude agent 自動實作，詳見 commit diff。

## Additional Note

- Agent: ${AGENT} (${MODEL})
- Branch: ${BRANCH}
- Task ID: ${TASK_ID}"

# Escape for shell injection into prompt
PR_BODY_ESCAPED=$(echo "${PR_BODY}" | sed "s/\"/'/g")

FULL_PROMPT="${PROMPT}

## PR 建立規範
當你執行 gh pr create 時，請使用以下指令帶入 PR 說明：
gh pr create --title \"<適當的標題>\" --body \"${PR_BODY_ESCAPED}\"
不要使用 --fill，請務必使用 --body 帶入上述說明。"

# 3. Build agent command
case "${AGENT}" in
  codex)
    AGENT_CMD="codex exec --dangerously-bypass-approvals-and-sandbox \"${FULL_PROMPT}\""
    ;;
  claude)
    AGENT_CMD="claude --model ${MODEL} --dangerously-skip-permissions -p \"${FULL_PROMPT}\""
    ;;
  *)
    echo "ERROR: Unknown agent '${AGENT}'. Use codex or claude." >&2
    exit 1
    ;;
esac

# 4. Runner script written per-task
RUNNER="${CLAWDBOT_DIR}/run-${TASK_ID}.sh"
cat > "${RUNNER}" <<RUNNER_EOF
#!/usr/bin/env bash
cd "${WORKTREE_PATH}"
echo "[agent] Starting ${AGENT} at \$(date -u +%Y-%m-%dT%H:%M:%SZ)"
${AGENT_CMD}
echo "[agent] Done at \$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RUNNER_EOF
chmod +x "${RUNNER}"

# 5. Start tmux session
tmux new-session -d -s "${TMUX_SESSION}" -c "${WORKTREE_PATH}" "bash '${RUNNER}' 2>&1 | tee '${CLAWDBOT_DIR}/log-${TASK_ID}.txt'"

echo "    tmux session '${TMUX_SESSION}' started."

# 6. Register task
STARTED_AT=$(date +%s%3N)
TASK_JSON=$(cat <<TASK_EOF
{
  "id": "${TASK_ID}",
  "tmuxSession": "${TMUX_SESSION}",
  "agent": "${AGENT}",
  "model": "${MODEL}",
  "branch": "${BRANCH}",
  "worktree": "${WORKTREE_PATH}",
  "description": "${PROMPT:0:120}",
  "startedAt": ${STARTED_AT},
  "status": "running",
  "attempts": 1,
  "notifyOnComplete": true,
  "reviewed": "false"
}
TASK_EOF
)

# Append to active-tasks.json (requires jq)
if command -v jq &>/dev/null; then
  CURRENT=$(cat "${TASKS_FILE}")
  # Remove existing entry with same id if any, then append
  echo "${CURRENT}" | jq --argjson t "${TASK_JSON}" '[.[] | select(.id != $t.id)] + [$t]' > "${TASKS_FILE}"
else
  echo "WARNING: jq not found, task registry not updated." >&2
fi

echo "==> Task '${TASK_ID}' registered. Monitor with: tmux attach -t ${TMUX_SESSION}"
