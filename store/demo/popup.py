#!/usr/bin/env python3
"""Locate the extension popup and its a/A button from two screen captures.

The popup is a separate native window: it never appears in Playwright's
ctx.pages(), and a persistent context has no browser() to enumerate targets
from. Screen pixels are the only way to find it.

Diffing a before/after capture inside a band under the toolbar isolates it.
Never diff the whole screen: the desktop is not static, two captures seconds
apart differ across most of it.

Usage: popup.py <base.png> <popup.png> <icon_cx>
Writes popupbox.json. Exit 0 only when the diff is shaped like this popup.
"""
import json
import os
import sys
from collections import defaultdict

from PIL import Image

WORK = os.environ.get("LC_DEMO_WORK") or os.path.join(
    os.environ.get("TMPDIR", "/tmp"), "lc-demo")


def main():
    base = Image.open(sys.argv[1]).convert("RGB").load()
    shot = Image.open(sys.argv[2]).convert("RGB")
    px = shot.load()
    icon_cx = int(sys.argv[3])
    W, H = shot.size

    # The popup hangs below the toolbar, right-aligned near its icon.
    x0, x1 = max(0, icon_cx - 460), W
    y0, y1 = 110, min(H, 480)

    rows = defaultdict(list)
    for y in range(y0, y1):
        for x in range(x0, x1):
            r1, g1, b1 = base[x, y]
            r2, g2, b2 = px[x, y]
            if abs(r1 - r2) + abs(g1 - g2) + abs(b1 - b2) > 70:
                rows[y].append(x)

    total = sum(len(v) for v in rows.values())
    if total < 400:
        print("POPUP_NOT_FOUND diffpixels=%d" % total)
        return 1

    ys = sorted(rows)
    xs = [x for y in ys for x in rows[y]]
    box = {"x0": min(xs), "x1": max(xs), "y0": min(ys), "y1": max(ys),
           "pixels": total}
    box["w"] = box["x1"] - box["x0"] + 1
    box["h"] = box["y1"] - box["y0"] + 1
    print("POPUP", json.dumps(box))

    # Reject anything not shaped like this extension's popup. Clicking the
    # bookmark star opens a ~576x232 dialog and the puzzle piece a ~328x213
    # panel; the popup for a single a/A button measures about 87x58. Without
    # this check calibration locks onto the wrong button and every later click
    # lands on the page instead (observed: clicking HN's "login" link).
    if not (40 <= box["w"] <= 260 and 28 <= box["h"] <= 200):
        print("POPUP_WRONG_SHAPE w=%d h=%d" % (box["w"], box["h"]))
        return 3

    # Inside the popup find the bright a/A glyph ink. The popup is dark in dark
    # mode, so the lettering is the bright part; require a tall band, since the
    # 26px font is much taller than the 1px window border highlight.
    bands = defaultdict(list)
    for y in range(box["y0"], box["y1"] + 1):
        for x in range(box["x0"], box["x1"] + 1):
            r, g, b = px[x, y]
            if r > 170 and g > 170 and b > 170:
                bands[y].append(x)

    ylist = sorted(y for y in bands if len(bands[y]) >= 3)
    if not ylist:
        print("BUTTON_NOT_FOUND")
        return 2
    groups, cur = [], [ylist[0]]
    for y in ylist[1:]:
        if y - cur[-1] <= 2:
            cur.append(y)
        else:
            groups.append(cur)
            cur = [y]
    groups.append(cur)

    for g in groups:
        gxs = [x for y in g for x in bands[y]]
        print("band y=%d..%d h=%d x=%d..%d n=%d"
              % (g[0], g[-1], len(g), min(gxs), max(gxs), len(gxs)))

    best = max(groups, key=len)
    bxs = [x for y in best for x in bands[y]]
    btn = {"x0": min(bxs), "x1": max(bxs), "y0": best[0], "y1": best[-1]}
    btn["cx"] = (btn["x0"] + btn["x1"]) // 2
    btn["cy"] = (btn["y0"] + btn["y1"]) // 2
    print("BUTTON", json.dumps(btn))

    with open(os.path.join(WORK, "popupbox.json"), "w") as f:
        json.dump({"popup": box, "button": btn}, f)
    return 0


if __name__ == "__main__":
    sys.exit(main())
