#!/usr/bin/env bash
# review-pr.sh — Run multi-model AI review on a PR
# Usage: review-pr.sh <pr-number> [repo-path]
# Reviewers: Codex, Claude Code, Gemini (if available)
set -euo pipefail

REPO_DIR="${2:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PR_NUM="${1:?PR number required}"

log() { echo "[review] $*"; }

log "Fetching diff for PR #${PR_NUM}..."
DIFF=$(gh pr diff "${PR_NUM}" --repo "${REPO_DIR}" 2>/dev/null || true)
PR_TITLE=$(gh pr view "${PR_NUM}" --repo "${REPO_DIR}" --json title --jq '.title')

if [[ -z "${DIFF}" ]]; then
  log "No diff found for PR #${PR_NUM}. Skipping review."
  exit 0
fi

REVIEW_PROMPT="You are a senior code reviewer. Review the following pull request titled '${PR_TITLE}'. Focus on: bugs, edge cases, missing error handling, race conditions, security issues, and scalability problems. Be concise and specific. Post your review as a GitHub PR comment.

${DIFF:0:8000}"

# --- Codex Reviewer ---
if command -v codex &>/dev/null; then
  log "Running Codex review..."
  CODEX_REVIEW=$(codex --model gpt-4.1 -c "model_reasoning_effort=high" \
    --dangerously-bypass-approvals-and-sandbox "${REVIEW_PROMPT}" 2>/dev/null || echo "Codex review failed")
  gh pr comment "${PR_NUM}" --repo "${REPO_DIR}" \
    --body "## 🤖 Codex Review

${CODEX_REVIEW}" 2>/dev/null || log "Failed to post Codex review comment"
  log "Codex review posted."
fi

# --- Claude Code Reviewer ---
if command -v claude &>/dev/null; then
  log "Running Claude Code review..."
  CLAUDE_REVIEW=$(claude --model claude-opus-4-5 --dangerously-skip-permissions \
    -p "${REVIEW_PROMPT}" 2>/dev/null || echo "Claude review failed")
  gh pr comment "${PR_NUM}" --repo "${REPO_DIR}" \
    --body "## 🤖 Claude Code Review

${CLAUDE_REVIEW}" 2>/dev/null || log "Failed to post Claude review comment"
  log "Claude review posted."
fi

# --- Gemini (via gemini CLI if available) ---
if command -v gemini &>/dev/null; then
  log "Running Gemini review..."
  GEMINI_REVIEW=$(echo "${REVIEW_PROMPT}" | gemini 2>/dev/null || echo "Gemini review failed")
  gh pr comment "${PR_NUM}" --repo "${REPO_DIR}" \
    --body "## 🤖 Gemini Review

${GEMINI_REVIEW}" 2>/dev/null || log "Failed to post Gemini review comment"
  log "Gemini review posted."
fi

log "All reviews complete for PR #${PR_NUM}."
