#!/usr/bin/env bash
# Runs every browser test (Node + Playwright with a Chromium). Usage: tools/e2e/run_all.sh [OUT]
OUT=${1:-/tmp/sf-e2e}; HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(dirname "$(dirname "$HERE")")
[ -f "$OUT/clip.webm" ] || bash "$HERE/make_fixtures.sh" "$OUT"
fail=0
for t in apptest mobiletest sesstest symtest cptest tltest mdtest vidtest psdtest pentest reusetest rigtest puptest textest toolsweep; do
  r=$(cd "$HERE" && node "$t.cjs" "$ROOT" "$OUT" 2>&1 | tail -1); echo "$t: $r"; [ "$r" = PASS ] || fail=1
done
exit $fail
