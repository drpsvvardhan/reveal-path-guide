#!/bin/bash
# SessionStart hook — lightweight repository health check.
#
# Ensures dependencies are installed and runs the Vitest unit suite so a web
# session begins with a known-good baseline. Runs only in the remote (web)
# environment.
#
# IMPORTANT: a SessionStart hook's *stdout* is injected into Claude's starting
# context, so we keep stdout to a single concise summary line and send the
# verbose npm install/test output to a log file. Test failures are reported
# but DO NOT abort the session (the suite is a health signal, not a gate).
# Lint is intentionally excluded: the repo currently lints with many
# pre-existing errors, so it is not a meaningful pass/fail signal at startup.
set -uo pipefail

# Only run in Claude Code on the web; local CLI sessions skip this.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

LOG="${TMPDIR:-/tmp}/reveal-path-session-start.log"
: > "$LOG"

# All command output goes to the log file, never to stdout.
if ! npm install --no-audit --no-fund >>"$LOG" 2>&1; then
  echo "[session-start] npm install FAILED (non-blocking) — see $LOG"
  exit 0
fi

if npm test >>"$LOG" 2>&1; then
  echo "[session-start] deps installed; Vitest suite passed."
else
  echo "[session-start] deps installed; Vitest reported failures (non-blocking) — see $LOG"
fi

exit 0
