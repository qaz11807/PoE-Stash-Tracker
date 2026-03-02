#!/usr/bin/env bash
# review-pr.sh — Run multi-model AI review on a PR
# Usage: review-pr.sh <pr-number> [repo-path]
set -euo pipefail

REPO_DIR="${2:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PR_NUM="${1:?PR number required}"
REPO_SLUG=$(cd "${REPO_DIR}" && gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null)

log() { echo "[review] $*"; }

# Idempotency lock — prevent running review twice for the same PR
LOCK_FILE="${REPO_DIR}/.clawdbot/.review-lock-pr${PR_NUM}"
if [[ -f "${LOCK_FILE}" ]]; then
  log "PR #${PR_NUM} already reviewed (lock file exists). Skipping."
  exit 0
fi
touch "${LOCK_FILE}"

log "Fetching diff for PR #${PR_NUM} (${REPO_SLUG})..."
DIFF=$(gh pr diff "${PR_NUM}" --repo "${REPO_SLUG}" 2>/dev/null || true)
PR_TITLE=$(gh pr view "${PR_NUM}" --repo "${REPO_SLUG}" --json title --jq '.title')

if [[ -z "${DIFF}" ]]; then
  log "No diff found for PR #${PR_NUM}. Skipping review."
  exit 0
fi

REVIEW_PROMPT="你是一位資深程式碼審查員，請用**繁體中文**審查以下 Pull Request。

PR 標題：${PR_TITLE}

審查重點：
- 潛在的 Bug 或邏輯錯誤
- 邊界條件與例外處理
- 安全性問題
- 效能問題
- 程式碼風格與可讀性
- 架構設計是否合理

請具體指出問題並給出改善建議。若程式碼品質良好，也請說明優點。

--- Diff ---
${DIFF:0:8000}"

# --- Codex Reviewer ---
if command -v codex &>/dev/null; then
  log "Running Codex review..."
  CODEX_REVIEW=$(codex exec --dangerously-bypass-approvals-and-sandbox \
    "${REVIEW_PROMPT}" 2>/dev/null || echo "Codex review 執行失敗")
  gh pr comment "${PR_NUM}" --repo "${REPO_SLUG}" \
    --body "## 🤖 Codex 代碼審查

${CODEX_REVIEW}" 2>/dev/null && log "Codex review posted." || log "Failed to post Codex review"
fi

# --- Claude Reviewer (via openclaw agent) ---
if command -v openclaw &>/dev/null; then
  log "Running Claude review via openclaw..."
  CLAUDE_REVIEW=$(openclaw agent --agent main --message "${REVIEW_PROMPT}" --json 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['payloads'][0]['text'])" 2>/dev/null \
    || echo "Claude review 執行失敗")
  if [[ -n "${CLAUDE_REVIEW}" && "${CLAUDE_REVIEW}" != "Claude review 執行失敗" ]]; then
    gh pr comment "${PR_NUM}" --repo "${REPO_SLUG}" \
      --body "## 🤖 Claude 代碼審查

${CLAUDE_REVIEW}" 2>/dev/null && log "Claude review posted." || log "Failed to post Claude review"
  fi
fi

# --- Gemini Reviewer (via gemini CLI) ---
if command -v gemini &>/dev/null; then
  log "Running Gemini review..."
  GEMINI_REVIEW=$(echo "${REVIEW_PROMPT}" | gemini 2>/dev/null || echo "Gemini review 執行失敗")
  gh pr comment "${PR_NUM}" --repo "${REPO_SLUG}" \
    --body "## 🤖 Gemini 代碼審查

${GEMINI_REVIEW}" 2>/dev/null && log "Gemini review posted." || log "Failed to post Gemini review"
fi

log "All reviews complete for PR #${PR_NUM}."
