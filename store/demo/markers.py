#!/usr/bin/env python3
"""Find the injected corner markers in a full-screen capture.

browser-host.mjs paints three 12x12 pure-colour squares pinned to the viewport
corners. Locating them gives the exact page-to-screen mapping, which beats
guessing Chrome's chrome height: window.screenX/screenY report the window
FRAME, not the viewport.

Usage: markers.py <capture.png>
Writes origin.json: {x, y, w, h, scale}
"""
import json
import os
import sys
from collections import defaultdict

from PIL import Image

WORK = os.environ.get("LC_DEMO_WORK") or os.path.join(
    os.environ.get("TMPDIR", "/tmp"), "lc-demo")
TARGETS = {
    "tl": (255, 0, 255),
    "tr": (0, 255, 255),
    "bl": (255, 255, 0),
}


def find(px, w, h, rgb, tol=12):
    hits = []
    tr, tg, tb = rgb
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            if abs(r - tr) <= tol and abs(g - tg) <= tol and abs(b - tb) <= tol:
                hits.append((x, y))
    return hits


def cluster(hits):
    """Return the largest run of adjacent rows as a bounding box."""
    if not hits:
        return None
    rows = defaultdict(list)
    for x, y in hits:
        rows[y].append(x)
    ys = sorted(rows)
    groups, cur = [], [ys[0]]
    for y in ys[1:]:
        if y - cur[-1] <= 1:
            cur.append(y)
        else:
            groups.append(cur)
            cur = [y]
    groups.append(cur)
    best = max(groups, key=lambda g: sum(len(rows[y]) for y in g))
    xs = [x for y in best for x in rows[y]]
    return {
        "x0": min(xs), "x1": max(xs),
        "y0": min(best), "y1": max(best),
        "n": len(xs),
    }


def main():
    im = Image.open(sys.argv[1]).convert("RGB")
    px = im.load()
    w, h = im.size
    print(f"capture {w}x{h}")

    boxes = {}
    for name, rgb in TARGETS.items():
        boxes[name] = cluster(find(px, w, h, rgb))
        print(name, rgb, boxes[name])

    if not all(boxes.values()):
        print("MARKERS_NOT_FOUND")
        return 1

    # Marker centres are 6px inside the viewport corner; derive the origin from
    # the centre rather than the edge, because the outermost pixel column is
    # blended with the window border and shifts the box by one.
    tl = boxes["tl"]
    ox = round((tl["x0"] + tl["x1"]) / 2) - 6
    oy = round((tl["y0"] + tl["y1"]) / 2) - 6
    tr = boxes["tr"]
    bl = boxes["bl"]
    vw = round((tr["x0"] + tr["x1"]) / 2) + 6 - ox
    vh = round((bl["y0"] + bl["y1"]) / 2) + 6 - oy

    sw = tl["x1"] - tl["x0"] + 1
    sh = tl["y1"] - tl["y0"] + 1
    scale = round(((sw + sh) / 2) / 12.0, 3)

    out = {"x": ox, "y": oy, "w": vw, "h": vh, "scale": scale,
           "marker_px": [sw, sh]}
    print("ORIGIN", json.dumps(out))
    if not 0.9 <= scale <= 1.1:
        print(f"WARNING scale={scale} is not ~1.0; the display may be scaled "
              f"and all click coordinates would be wrong")
    with open(os.path.join(WORK, "origin.json"), "w") as f:
        json.dump(out, f)
    return 0


if __name__ == "__main__":
    sys.exit(main())
