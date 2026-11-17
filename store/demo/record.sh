#!/bin/sh
# Record the demo.
#
# Must run under a terminal that owns the Screen Recording and Accessibility
# grants (Ghostty here). ffmpeg's avfoundation capture is broken on this
# machine (even -list_devices exits 1 and prints nothing), so screencapture -v
# is the capture path and ffmpeg is used only to transcode afterwards.
S="$(cd "$(dirname "$0")" && pwd)"
D="${LC_DEMO_WORK:-${TMPDIR:-/tmp}/lc-demo}"
PY="${LC_DEMO_PY:-/opt/homebrew/bin/python3}"
L="$D/record.log"
DUR="${LC_DEMO_DUR:-46}"
mkdir -p "$D"

echo "REC START $(date +%T)" > "$L"
rm -f "$D/record.done" "$D/raw.mov"

step() { timeout 40 osascript -l JavaScript "$S/step.js" "$@" 2>&1; }
ctl() { timeout 60 "$PY" -I "$S/ctl.py" "$@" 2>&1; }

. "$D/geom.sh"

# --- reset to a known starting state ----------------------------------------
echo "activate: $(step activate)" >> "$L"
sleep 1
echo "esc: $(step esc)" >> "$L"
sleep 1
ctl goto '{"url":"https://news.ycombinator.com/"}' > /dev/null 2>&1
sleep 1

TRIES=0
while [ "$("$PY" -I "$S/lcstate.py")" = "on" ] && [ "$TRIES" -lt 3 ]; do
  echo "lowercase was on, turning it off (try $TRIES)" >> "$L"
  step esc > /dev/null
  sleep 1
  step click "$ICON_X" "$ICON_Y" > /dev/null
  sleep 2
  step click "$BTN_X" "$BTN_Y" > /dev/null
  sleep 2
  step esc > /dev/null
  sleep 1
  TRIES=$((TRIES + 1))
done
echo "lowercase state before recording: $("$PY" -I "$S/lcstate.py")" >> "$L"

# Pre-warm the popup. The first open of an MV3 action popup has to start the
# service worker and load popup.html, which took about 1.5s and made the
# "popup opens" beat look rushed. Opening and closing it once beforehand makes
# every later open render in roughly 0.4s.
step click "$ICON_X" "$ICON_Y" > /dev/null
sleep 3
step esc > /dev/null
sleep 1
echo "popup pre-warmed, lowercase still: $("$PY" -I "$S/lcstate.py")" >> "$L"

# Park the pointer on empty page background. This must be a real CLICK, not
# just a move: navigating over CDP leaves keyboard focus in the omnibox with
# the URL selected, which shows as a blue highlight for the whole recording,
# and only a genuine click into the page clears it. BLANK comes from
# elementFromPoint, so it hits background with no link or text to select.
echo "park: $(step click "$BLANK_X" "$BLANK_Y")" >> "$L"
sleep 1
echo "park2: $(step move "$BLANK_X" "$BLANK_Y")" >> "$L"
sleep 1
echo "state before: $(ctl state | tr -d '\n ')" >> "$L"

# --- capture ----------------------------------------------------------------
# screencapture -v must stay in the FOREGROUND. Backgrounded it reads the tty,
# takes SIGTTIN, stops, and never finalises the movie (observed: killed at the
# timeout with no output file at all). So the input sequence is the job that
# gets backgrounded, after a short pre-roll.
rm -f "$D/seq.out"
(
  sleep 1.2
  timeout 120 osascript -l JavaScript "$S/sequence.js" "$D/steps.json" \
    > "$D/seq.out" 2>&1
  echo "SEQ_EXIT=$?" >> "$D/seq.out"
) < /dev/null &
SEQPID=$!
echo "sequence pid=$SEQPID preroll=1.2 dur=$DUR" >> "$L"

timeout $((DUR + 25)) screencapture -v -V "$DUR" -C -x "$D/raw.mov" >> "$L" 2>&1
echo "capture rc=$? size=$(stat -f%z "$D/raw.mov" 2>/dev/null)" >> "$L"

wait $SEQPID
echo "seq: $(cat "$D/seq.out" 2>/dev/null)" >> "$L"
echo "state after: $(ctl state | tr -d '\n ')" >> "$L"

echo "REC DONE $(date +%T)" >> "$L"
echo done > "$D/record.done"
