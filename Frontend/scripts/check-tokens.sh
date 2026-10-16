#!/bin/sh
# D1 token gate: no raw banned literals in JSX/JS, and no banned accent hues
# in CSS. Run via `npm run tokens:check`.
cd "$(dirname "$0")/.." || exit 1
FAIL=0
BANNED='#3B82F6|#60A5FA|#22C55E|#EF4444|#F59E0B|#9CA3AF|#8A93A6|#F5F7FA|#111318|#151820|#09090B|instrument-serif'
HITS=$(grep -rniE "$BANNED" src --include='*.jsx' --include='*.js' | grep -v 'src/legacy-landing/' || true)
if [ -n "$HITS" ]; then
  echo "TOKEN GATE FAILED (js/jsx) — banned literals found:"
  echo "$HITS"
  FAIL=1
fi
# CSS: token definitions (:root) legitimately hold system hexes; ban only the
# purged accent hues (hex + rgb-triple forms) outside comments.
CSSBANNED='#3B82F6|#60A5FA|#22C55E|#EF4444|#F59E0B|59, ?130, ?246|34, ?197, ?94|239, ?68, ?68|245, ?158, ?11'
CSSHITS=$(grep -rniE "$CSSBANNED" src --include='*.css' | grep -v 'src/legacy-landing/' || true)
if [ -n "$CSSHITS" ]; then
  echo "TOKEN GATE FAILED (css) — banned accent hues found:"
  echo "$CSSHITS"
  FAIL=1
fi
[ "$FAIL" = 0 ] && echo "token gate: clean"
exit "$FAIL"
