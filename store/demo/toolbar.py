#!/usr/bin/env python3
"""Locate Chrome's right-hand toolbar buttons by their light glyph clusters.

In dark mode the toolbar is near-black and every button glyph is light, so
clustering bright pixels in the toolbar band is far more stable than matching
on darkness, which kept locking onto the omnibox instead.

This only produces candidates. calibrate.sh decides which one is the pinned
action by clicking each and checking the shape of the popup that opens.

Usage: toolbar.py <capture.png> <viewport_top>
Writes toolbar.json.
"""
import json
import os
import sys
from collections import defaultdict

from PIL import Image

WORK = os.environ.get("LC_DEMO_WORK") or os.path.join(
    os.environ.get("TMPDIR", "/tmp"), "lc-demo")


def main():
    path = sys.argv[1]
    vtop = int(sys.argv[2])          # first row of the page viewport
    im = Image.open(path).convert("RGB")
    px = im.load()
    W, _ = im.size

    # Toolbar band: between the macOS menu bar and the page viewport. The tab
    # strip is included, but tab glyphs are far to the left of the x window.
    y0, y1 = 36, vtop - 4
    x0, x1 = 1500, W

    cols = defaultdict(list)
    for x in range(x0, x1):
        for y in range(y0, y1):
            r, g, b = px[x, y][:3]
            if r > 115 and g > 115 and b > 115:
                cols[x].append(y)

    xs = sorted(cols)
    clusters, cur = [], []
    for x in xs:
        if cur and x - cur[-1] > 6:
            clusters.append(cur)
            cur = []
        cur.append(x)
    if cur:
        clusters.append(cur)

    found = []
    for c in clusters:
        ys = [y for x in c for y in cols[x]]
        if len(ys) < 12:
            continue
        found.append({
            "x0": min(c), "x1": max(c),
            "y0": min(ys), "y1": max(ys),
            "cx": (min(c) + max(c)) // 2,
            # The glyph's own vertical centre is the button centre. Averaging
            # the whole band lands in the tab strip and the click misses.
            "cy": (min(ys) + max(ys)) // 2,
            "n": len(ys),
            "w": max(c) - min(c) + 1,
        })

    for b in found:
        print("cluster", json.dumps(b))

    with open(os.path.join(WORK, "toolbar.json"), "w") as f:
        json.dump({"clusters": found}, f)
    if not found:
        print("NO_CLUSTERS")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
