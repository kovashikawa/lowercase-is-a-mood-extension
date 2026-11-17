#!/bin/sh
# Transcode the capture to the delivered mp4 and print the verification facts.
# Needs no special grants, so it can run from any shell.
#
# Usage: finish.sh [output.mp4]
S="$(cd "$(dirname "$0")" && pwd)"
D="${LC_DEMO_WORK:-${TMPDIR:-/tmp}/lc-demo}"
OUT="${1:-$S/../demo-$(date +%Y-%m-%d).mp4}"
# screencapture keeps recording for its full -V window, so the tail after the
# last scripted action is dead air; trim to just past the sequence end.
TRIM="${LC_DEMO_TRIM:-40.5}"

if [ ! -f "$D/raw.mov" ]; then
  echo "no capture at $D/raw.mov"
  exit 1
fi

ffmpeg -hide_banner -loglevel error -y -i "$D/raw.mov" -t "$TRIM" -r 30 \
  -vf "scale=1920:1080:flags=lanczos,format=yuv420p" \
  -c:v libx264 -preset slow -crf 20 -movflags +faststart -an "$OUT" || exit 1

echo "=== ffprobe $OUT ==="
ffprobe -v error \
  -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_frames \
  -show_entries format=duration,size -of default=nw=1 "$OUT"

echo "=== journal (must show none -> lowercase -> none, two item ids, a return to the front page) ==="
grep -E "TRANSFORM|NAV" "$D/host.log" 2>/dev/null | tail -12

echo "=== driven sequence ==="
cat "$D/seq.out" 2>/dev/null
