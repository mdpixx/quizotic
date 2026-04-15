#!/usr/bin/env bash
# Syncs the Quizotic folder from the claude-zector monorepo to the standalone
# mdpixx/quizotic repo that Railway watches, then pushes — triggering auto-deploy.
#
# Usage:
#   ./scripts/deploy-to-railway.sh                 # uses latest monorepo commit msg
#   ./scripts/deploy-to-railway.sh "custom msg"    # uses custom commit msg
#
# Why this exists: Railway's GitHub integration watches mdpixx/quizotic (standalone),
# not mdpixx/claude-zector (monorepo). Direct pushes to the monorepo don't deploy.

set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CACHE_DIR="$HOME/.cache/quizotic-deploy"
REMOTE_URL="https://github.com/mdpixx/quizotic.git"
BRANCH="main"

# Ensure local cache clone exists and is up to date
if [ ! -d "$CACHE_DIR/.git" ]; then
  echo "→ Cloning $REMOTE_URL into $CACHE_DIR"
  git clone "$REMOTE_URL" "$CACHE_DIR"
else
  echo "→ Fetching latest from $REMOTE_URL"
  git -C "$CACHE_DIR" fetch origin "$BRANCH"
  git -C "$CACHE_DIR" checkout "$BRANCH"
  git -C "$CACHE_DIR" reset --hard "origin/$BRANCH"
fi

# Rsync source files (exclude everything the standalone repo doesn't need)
echo "→ Syncing files from $SRC_DIR → $CACHE_DIR"
rsync -a --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='*.tsbuildinfo' \
  --exclude='.DS_Store' \
  --exclude='assets/' \
  --exclude='brand logo/' \
  --exclude='Screenshots/' \
  --exclude='brand-logo-mockup.html' \
  --exclude='.claude/' \
  --exclude='.cursor/' \
  --exclude='.vscode/' \
  "$SRC_DIR/" "$CACHE_DIR/"

# Stage and detect changes
cd "$CACHE_DIR"
git add -A
if git diff --cached --quiet; then
  echo "✓ No changes to deploy."
  exit 0
fi

# Commit message: arg if given, else latest monorepo commit message
if [ "${1:-}" != "" ]; then
  MSG="$1"
else
  MSG=$(git -C "$SRC_DIR" log -1 --pretty=%B -- .)
fi

echo "→ Committing:"
echo "$MSG" | head -3 | sed 's/^/  /'
git commit -m "$MSG"

echo "→ Pushing to $REMOTE_URL"
git push origin "$BRANCH"

echo ""
echo "✓ Pushed. Railway will auto-deploy in ~30s."
echo "  Watch: https://railway.app/project/quizotic-beta"
