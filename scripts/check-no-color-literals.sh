#!/usr/bin/env bash
# Binding check for spec 000 FR-022 / SC-007: no literal colour values
# (hex / rgb() / hsl()) anywhere in src/ outside the design-token module.
# The ESLint no-restricted-syntax rule (eslint.config.js) is best-effort;
# this grep is the check CI actually fails on.
set -euo pipefail

cd "$(dirname "$0")/.."

matches=$(grep -RInE '#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(' \
  src/ --include='*.ts' --include='*.tsx' --include='*.css' \
  --exclude-dir=design 2>/dev/null || true)

if [ -n "$matches" ]; then
  echo "Literal colour values found outside src/presentation/design/:"
  echo "$matches"
  echo
  echo "Use a design token instead (src/presentation/design/tokens.css + tokens.ts)."
  exit 1
fi

echo "No literal colour values found outside src/presentation/design/."
