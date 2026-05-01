#!/usr/bin/env bash
# Pre-deploy gate. Boots the dev server in the background, runs the E2E
# critical-path test against it, then kills the server and exits with the
# E2E result. Triggered by `npm run deploy` so a regression in answer
# capture, host counter, or participant feedback BLOCKS the push to Railway.
#
# Set SKIP_E2E=1 to bypass (emergency only — avoid).

set -euo pipefail

if [ "${SKIP_E2E:-0}" = "1" ]; then
  echo "→ predeploy: SKIP_E2E=1 set, skipping E2E gate (NOT RECOMMENDED)"
  exit 0
fi

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

PORT=4000
LOG_FILE="$(mktemp)"

# Boot the dev server. The deploy gate runs Node-based contract tests against
# the Socket.IO protocol — the layer where today's regression class lives —
# so we don't need a production build or browser. Dev server is enough.
echo "→ predeploy: starting dev server on :$PORT"
PORT="$PORT" npm run dev > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" 2>/dev/null; then
    kill -TERM "$SERVER_PID" 2>/dev/null || true
    # Give it a couple seconds, then SIGKILL anything still listening.
    sleep 2
    if kill -0 "$SERVER_PID" 2>/dev/null; then
      kill -KILL "$SERVER_PID" 2>/dev/null || true
    fi
  fi
  # Belt-and-braces — anything else still bound to the port.
  if command -v lsof >/dev/null 2>&1; then
    PIDS=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$PIDS" ]; then kill -KILL $PIDS 2>/dev/null || true; fi
  fi
}
trap cleanup EXIT INT TERM

# Wait for "Quizotic running" to appear in the log, with a hard cap.
echo "→ predeploy: waiting for server ready (max 60s)"
for i in $(seq 1 120); do
  if grep -q "Quizotic running" "$LOG_FILE" 2>/dev/null; then
    echo "→ predeploy: server ready after $((i * 500))ms"
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "✗ predeploy: dev server died before ready. Last 30 log lines:"
    tail -30 "$LOG_FILE"
    exit 1
  fi
  sleep 0.5
done

if ! grep -q "Quizotic running" "$LOG_FILE" 2>/dev/null; then
  echo "✗ predeploy: server did not become ready within 60s. Last 30 log lines:"
  tail -30 "$LOG_FILE"
  exit 1
fi

# Run the E2E suite against the just-booted server.
echo "→ predeploy: running E2E suite"
PLAYWRIGHT_BASE_URL="http://localhost:$PORT" npx playwright test --project=chromium

echo ""
echo "✓ predeploy: E2E gate passed."
