#!/bin/sh
# Measure, calibrate and record, in one terminal session.
#
# Launch this under a terminal that owns the Screen Recording and Accessibility
# grants. Everything here needs both: screencapture cannot create an image from
# the display without the first, and CGEventPost silently does nothing without
# the second (the event is accepted and the cursor does not move).
#
#   open -na Ghostty --args -e /bin/sh store/demo/run.sh
#
# browser-host.mjs must already be running and have printed READY.
S="$(cd "$(dirname "$0")" && pwd)"
D="${LC_DEMO_WORK:-${TMPDIR:-/tmp}/lc-demo}"
PY="${LC_DEMO_PY:-/opt/homebrew/bin/python3}"
L="$D/run.log"
mkdir -p "$D"

echo "RUN START $(date +%T)" > "$L"
rm -f "$D/run.done"

step() { timeout 40 osascript -l JavaScript "$S/step.js" "$@" 2>&1; }
ctl() { timeout 60 "$PY" -I "$S/ctl.py" "$@" 2>&1; }

# --- 1. measure the page-to-screen mapping ----------------------------------
echo "activate: $(step activate)" >> "$L"
sleep 1
ctl markers_on >> "$L" 2>&1
sleep 1
timeout 25 screencapture -x "$D/origin.png" >> "$L" 2>&1
echo "origin.png rc=$? size=$(stat -f%z "$D/origin.png" 2>/dev/null)" >> "$L"
timeout 200 "$PY" -I "$S/markers.py" "$D/origin.png" >> "$L" 2>&1
MRC=$?
ctl markers_off >> "$L" 2>&1
if [ $MRC -ne 0 ]; then
  echo "RUN FAILED: could not measure the viewport origin" >> "$L"
  echo done > "$D/run.done"
  exit 1
fi
sleep 1

# --- 2. find the toolbar icon and the popup button --------------------------
sh "$S/calibrate.sh"
if [ ! -f "$D/icon_geom.json" ]; then
  echo "RUN FAILED: calibration did not find the pinned action" >> "$L"
  cat "$D/calibrate.log" >> "$L"
  echo done > "$D/run.done"
  exit 1
fi
echo "icon_geom: $(cat "$D/icon_geom.json" | tr -d '\n ')" >> "$L"

# --- 3. build the sequence against the page as it is now --------------------
timeout 120 "$PY" -I "$S/makeplan.py" >> "$L" 2>&1
if [ ! -f "$D/steps.json" ]; then
  echo "RUN FAILED: could not build the step plan" >> "$L"
  echo done > "$D/run.done"
  exit 1
fi

# --- 4. record ---------------------------------------------------------------
sh "$S/record.sh"
echo "record.log:" >> "$L"
cat "$D/record.log" >> "$L"

echo "RUN DONE $(date +%T)" >> "$L"
echo done > "$D/run.done"
