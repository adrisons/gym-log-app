#!/usr/bin/env bash
# Binding check for spec 000 FR-022 / SC-007: no literal colour values
# (hex / rgb() / hsl()) anywhere in src/ outside the design-token module.
# The ESLint no-restricted-syntax rule (eslint.config.js) is best-effort;
# this grep is the check CI actually fails on.
set -uo pipefail

cd "$(dirname "$0")/.."

# grep exits 1 for "no matches" (the expected, passing case) and 0 when it
# finds matches; any other exit code (2+) means grep itself failed (bad
# pattern, unreadable src/, etc.) and must fail this check, not pass it
# silently — `|| true` alone would swallow that distinction.
matches=$(grep -RInE '#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(' \
  src/ --include='*.ts' --include='*.tsx' --include='*.css' \
  --exclude-dir=design)
grep_exit=$?
if [ "$grep_exit" -gt 1 ]; then
  echo "grep failed while scanning src/ for colour literals (exit $grep_exit)."
  exit "$grep_exit"
fi

if [ -n "$matches" ]; then
  echo "Literal colour values found outside src/presentation/design/:"
  echo "$matches"
  echo
  echo "Use a design token instead (src/presentation/design/tokens.css + tokens.ts)."
  exit 1
fi

echo "No literal colour values found outside src/presentation/design/."
