#!/bin/sh
# Find the pinned a/A toolbar button and the a/A button inside its popup.
#
# Candidate toolbar buttons are clicked one at a time until one opens a popup
# shaped like this extension's. This self-check matters: identifying the button
# by pixel heuristics alone picked the bookmark star on the first attempt, and
# every later click then landed on the page instead of the popup.
#
# Must run under a terminal that owns the Screen Recording and Accessibility
# grants (Ghostty here). See README.md.
S="$(cd "$(dirname "$0")" && pwd)"
D="${LC_DEMO_WORK:-${TMPDIR:-/tmp}/lc-demo}"
PY="${LC_DEMO_PY:-/opt/homebrew/bin/python3}"
L="$D/calibrate.log"
mkdir -p "$D"

VTOP=$(timeout 30 "$PY" -I -c "import json,os;print(json.load(open(os.path.join('$D','origin.json')))['y'])")
echo "CAL START $(date +%T) viewport_top=$VTOP" > "$L"
rm -f "$D/calibrate.done" "$D/icon_geom.json"

step() { timeout 40 osascript -l JavaScript "$S/step.js" "$@" 2>&1; }

echo "activate: $(step activate)" >> "$L"
sleep 1
echo "esc: $(step esc)" >> "$L"
sleep 1

timeout 25 screencapture -x "$D/cal_base.png" >> "$L" 2>&1
echo "cal_base rc=$? size=$(stat -f%z "$D/cal_base.png" 2>/dev/null)" >> "$L"

timeout 150 "$PY" -I "$S/toolbar.py" "$D/cal_base.png" "$VTOP" >> "$L" 2>&1
CANDS=$(timeout 60 "$PY" -I "$S/candidates.py" 2>/dev/null)
echo "candidates: $CANDS" >> "$L"

FOUND=""
for C in $CANDS; do
  CX=$(echo "$C" | cut -d: -f1)
  CY=$(echo "$C" | cut -d: -f2)
  echo "--- trying icon $CX,$CY ---" >> "$L"
  echo "esc: $(step esc)" >> "$L"
  sleep 1
  timeout 25 screencapture -x "$D/cal_pre.png"
  echo "click: $(step click "$CX" "$CY")" >> "$L"
  sleep 2
  timeout 25 screencapture -x "$D/cal_post.png"
  if timeout 150 "$PY" -I "$S/popup.py" "$D/cal_pre.png" "$D/cal_post.png" "$CX" \
      >> "$L" 2>&1; then
    echo "MATCH at $CX,$CY" >> "$L"
    FOUND="$CX:$CY"
    break
  fi
  echo "no match at $CX,$CY" >> "$L"
done

# Leave the popup closed so the recording starts from a known state.
echo "esc: $(step esc)" >> "$L"

if [ -z "$FOUND" ]; then
  echo "CAL FAILED: no candidate opened an extension-shaped popup" >> "$L"
  echo done > "$D/calibrate.done"
  exit 1
fi

LC_DEMO_FOUND="$FOUND" timeout 60 "$PY" -I "$S/icongeom.py" >> "$L" 2>&1
echo "CAL DONE $(date +%T)" >> "$L"
echo done > "$D/calibrate.done"
