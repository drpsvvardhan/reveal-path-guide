#!/bin/bash
# SessionStart hook — lightweight repository health check.
#
# Ensures dependencies are installed and runs the Vitest unit suite so a web
# session begins with a known-good baseline. Runs only in the remote (web)
# environment. Test failures are reported but DO NOT abort the session
# (the suite is a health signal, not a gate). Lint is intentionally excluded:
# the repo currently lints with many pre-existing errors, so it is not a
# meaningful pass/fail signal at startup.
set -euo pipefail

# Only run in Claude Code on the web; local CLI sessions skip this.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

echo "[session-start] installing dependencies (npm install)..."
npm install --no-audit --no-fund

echo "[session-start] running unit tests (npm test)..."
if npm test; then
  echo "[session-start] ✅ Vitest suite passed."
else
  echo "[session-start] ‼️ Vitest reported failures — continuing anyway (non-blocking)."
fi

exit 0
