#!/usr/bin/env python3
"""Report, per sampled frame, whether the popup is open.

screencapture -v only emits a frame when the screen changes, so the capture is
variable frame rate and a naive "event time plus offset" guess does not line
up. Scanning the transcoded frames finds where each beat actually landed.

The popup is a dark window over the light Hacker News page, so the mean
brightness of its rect collapses while it is open.

Usage: scan.py <frames_dir> [popup_x0 popup_y0 popup_x1 popup_y1]
"""
import json
import os
import sys

from PIL import Image

WORK = os.environ.get("LC_DEMO_WORK") or os.path.join(
    os.environ.get("TMPDIR", "/tmp"), "lc-demo")


def mean_bright(px, rect):
    x0, y0, x1, y1 = rect
    tot = n = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b = px[x, y][:3]
            tot += r + g + b
            n += 3
    return tot / max(1, n)


def main():
    d = sys.argv[1]
    if len(sys.argv) >= 6:
        rect = tuple(int(v) for v in sys.argv[2:6])
    else:
        geom = json.load(open(os.path.join(WORK, "icon_geom.json")))["popup"]
        rect = (geom["x0"], geom["y0"], geom["x1"] + 1, geom["y1"] + 1)
    print("popup rect", rect)

    files = sorted(f for f in os.listdir(d) if f.endswith(".png"))
    rows = []
    for i, f in enumerate(files):
        im = Image.open(os.path.join(d, f)).convert("RGB")
        pb = mean_bright(im.load(), rect)
        rows.append({"frame": f, "popup_bright": round(pb, 1),
                     "popup_open": pb < 120})

    prev = None
    for i, r in enumerate(rows):
        if r["popup_open"] != prev:
            print(f"frame {i} ({r['frame']}) popup_open={r['popup_open']} "
                  f"bright={r['popup_bright']}")
            prev = r["popup_open"]
    opens = sum(1 for r in rows if r["popup_open"])
    print(f"frames={len(rows)} popup_open_frames={opens}")

    with open(os.path.join(WORK, "scan.json"), "w") as fh:
        json.dump(rows, fh, indent=1)


if __name__ == "__main__":
    main()
