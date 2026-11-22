#!/usr/bin/env bash
# Runs every browser test (Node + Playwright with a Chromium). Usage: tools/e2e/run_all.sh [OUT]
OUT=${1:-/tmp/sf-e2e}; HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(dirname "$(dirname "$HERE")")
[ -f "$OUT/clip.webm" ] || bash "$HERE/make_fixtures.sh" "$OUT"
fail=0
for t in boottest welcometest blendtest ipadpentest apptest mobiletest sesstest autosavetest tuttest tooltuttest foxtest bonetest physicstest chaintest layertest suttest studiotest installtest animtest swaptest lipsynctest facetest m3dtest vrmtest gizmotest m3canvastest twotonetest mangatest hubtest smartfilltest persptest vectortest advtest tunetest helptest cloudtest smoothtest tonetest cpimgtest whatsnewtest lighttest holdtest importtest fxtest symtest cptest tltest mdtest vidtest psdtest pentest reusetest rigtest puptest textest toolsweep; do
  full=$(cd "$HERE" && node "$t.cjs" "$ROOT" "$OUT" 2>&1); r=$(printf '%s\n' "$full" | tail -1); echo "$t: $r"
  case "$r" in *PASS) ;; *) fail=1; printf '%s\n' "$full" | grep -v '^ok ' | sed 's/^/    | /' | tail -40;; esac
done
# desktop app live update (needs a display; uses xvfb-run when available)
if command -v xvfb-run >/dev/null && [ -x "$ROOT/node_modules/electron/dist/electron" ]; then
  r=$(cd "$HERE" && xvfb-run -a node electrontest.cjs "$ROOT" "$OUT" 2>&1 | tail -1); echo "electrontest: $r"; case "$r" in *PASS) ;; *) fail=1;; esac
fi
exit $fail
