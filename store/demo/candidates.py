#!/usr/bin/env python3
"""Print candidate toolbar-button x centres, as a search order.

Right to left the buttons are normally: 3-dot menu, profile avatar, puzzle
piece, then the pinned action, then the omnibox bookmark star. Rather than
trust that ordering, this emits a sensible order and lets calibrate.sh verify
by clicking; the star in particular opens a large "Bookmark added" dialog that
is easy to mistake for a popup.
"""
import json
import os

WORK = os.environ.get("LC_DEMO_WORK") or os.path.join(
    os.environ.get("TMPDIR", "/tmp"), "lc-demo")

tb = json.load(open(os.path.join(WORK, "toolbar.json")))
narrow = [c for c in tb["clusters"] if c["w"] <= 40]
order = sorted(narrow, key=lambda c: -c["cx"])
# Try the likely pinned-action slots first (4th and 3rd from the right), then
# fall back to the rest.
if len(order) > 3:
    order = order[2:] + order[:2]
print(" ".join(f"{c['cx']}:{c['cy']}" for c in order))
