#!/usr/bin/env bash
# sync-from-github.sh — keep the LOCAL clone in sync with GitHub (pull-only).
#
# GitHub `mdpixx/quizotic` main is the single source of truth. This script never
# pushes and never rewrites history. It is deliberately conservative:
#   • it only ever fast-forwards `main` to `origin/main`;
#   • it refuses to touch a tree with tracked changes (active local edits);
#   • it refuses to run if local `main` is ahead of origin (push/PR that first).
# In any unsafe situation it logs the reason and exits 0 (a no-op), so it is safe
# to run unattended from launchd every 30 minutes. See docs/RELEASING.md.
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="main"
LOG="$HOME/.cache/quizotic-sync.log"
mkdir -p "$(dirname "$LOG")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >>"$LOG"; }

cd "$REPO_DIR" || { log "ERROR: cannot cd to $REPO_DIR"; exit 1; }

current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
if [ "$current_branch" != "$BRANCH" ]; then
  log "SKIP: on branch '$current_branch', not '$BRANCH'"
  exit 0
fi

if ! git fetch --quiet origin "$BRANCH"; then
  log "ERROR: git fetch failed"
  exit 1
fi

# Tracked changes only — untracked local-only tooling (e.g. cold-email-pipeline/)
# is intentionally ignored so it never blocks the backup sync.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  log "SKIP: tracked working-tree changes present — not syncing"
  exit 0
fi

counts="$(git rev-list --left-right --count "origin/$BRANCH...HEAD")"
behind="$(echo "$counts" | awk '{print $1}')"
ahead="$(echo "$counts" | awk '{print $2}')"

if [ "${ahead:-0}" -gt 0 ]; then
  log "SKIP: local is ahead of origin by $ahead commit(s) — push/PR first"
  exit 0
fi

if [ "${behind:-0}" -eq 0 ]; then
  log "OK: already up to date ($(git rev-parse --short HEAD))"
  exit 0
fi

if git merge --ff-only --quiet "origin/$BRANCH"; then
  log "PULLED: fast-forwarded $behind commit(s) -> $(git rev-parse --short HEAD)"
else
  log "ERROR: fast-forward failed (unexpected divergence) — manual check needed"
  exit 1
fi
