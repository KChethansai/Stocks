#!/bin/sh
# Serialized Playwright runner. Two concurrent runs share the backend, the dev
# server, and the test-results artifact dir — that collision produced
# trace-attachment ENOENT failures and load flakes (Oct 2026). flock refuses a
# second run with a clear error instead of corrupting the first.
# Usage: sh scripts/e2e.sh [--project=chromium-desktop] [extra playwright args]
cd "$(dirname "$0")/.." || exit 1
LOCK=/tmp/marketforge-e2e.lock
exec flock -n "$LOCK" npx playwright test "$@" || {
  echo "E2E LOCKED: another Playwright run holds $LOCK. Wait for it to finish instead of running concurrently."
  exit 9
}
