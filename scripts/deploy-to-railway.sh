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

# Remove folders that exist on destination but shouldn't (rsync --exclude
# doesn't delete already-present excluded files, and --delete-excluded is
# too aggressive because it would also nuke .git).
rm -rf "$CACHE_DIR/remotion" "$CACHE_DIR/audits" "$CACHE_DIR/scripts/_pull-feedback.mjs" \
  "$CACHE_DIR/cold-email-pipeline"

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
  --exclude='test-results/' \
  --exclude='playwright-report/' \
  --exclude='audits/' \
  --exclude='assets/' \
  --exclude='brand logo/' \
  --exclude='Screenshots/' \
  --exclude='brand-logo-mockup.html' \
  --exclude='scripts/_pull-feedback.mjs' \
  --exclude='.claude/' \
  --exclude='.cursor/' \
  --exclude='.vscode/' \
  --exclude='remotion/' \
  --exclude='cold-email-pipeline/' \
  --exclude='*.xlsx' \
  --exclude='quizotic_user*.html' \
  --exclude='exports/*users*' \
  "$SRC_DIR/" "$CACHE_DIR/"

# ── Regression guard: never deploy SEO landing pages without a signup path ──
# A stale source snapshot once reverted the StickyNav off the SEO layouts,
# stripping the only signup path (logo / Sign in / Sign up) from every
# Google/ChatGPT landing page — signups went to zero while traffic looked
# healthy. Abort loudly rather than silently shipping that regression again.
SEO_LAYOUTS=(
  "src/components/seo/SolutionPageLayout.tsx"
  "src/components/seo/ComparisonPageLayout.tsx"
  "src/components/seo/UseCasePageLayout.tsx"
  "src/components/seo/TemplatePageLayout.tsx"
  "src/components/seo/LearnArticleLayout.tsx"
)
for layout in "${SEO_LAYOUTS[@]}"; do
  if [ -f "$CACHE_DIR/$layout" ] && ! grep -q "<StickyNav />" "$CACHE_DIR/$layout"; then
    echo "✗ ABORT: $layout has no <StickyNav /> — deploying it would ship an SEO"
    echo "  landing page with no signup path. The source you are syncing from is"
    echo "  stale. Reconcile the fix into the source of truth before deploying."
    exit 1
  fi
done
echo "✓ SEO signup-path guard passed."

# Stage and detect changes
cd "$CACHE_DIR"
git add -A
if git diff --cached --quiet; then
  echo "✓ No changes to deploy."
  exit 0
fi

# Commit message: arg if given, else a predictable deploy marker with monorepo sha
if [ "${1:-}" != "" ]; then
  MSG="$1"
else
  MONOREPO_SHA=$(git -C "$SRC_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
  MSG="deploy: sync from monorepo @ $MONOREPO_SHA"
fi

echo "→ Committing:"
echo "$MSG" | head -3 | sed 's/^/  /'
git commit -m "$MSG"

echo "→ Pushing to $REMOTE_URL"
git push origin "$BRANCH"

echo ""
echo "✓ Pushed. Railway will auto-deploy in ~30s."
echo "  Watch: https://railway.app/project/quizotic-beta"
