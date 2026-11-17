#!/usr/bin/env python3
"""Combine the verified toolbar icon position with the popup button position.

Reads LC_DEMO_FOUND ("cx:cy" of the icon that passed calibration) and the
popupbox.json that popup.py wrote for it. Writes icon_geom.json.
"""
import json
import os

WORK = os.environ.get("LC_DEMO_WORK") or os.path.join(
    os.environ.get("TMPDIR", "/tmp"), "lc-demo")
cx, cy = (int(v) for v in os.environ["LC_DEMO_FOUND"].split(":"))
pb = json.load(open(os.path.join(WORK, "popupbox.json")))

out = {
    "icon_x": cx,
    "icon_y": cy,
    "btn_x": pb["button"]["cx"],
    "btn_y": pb["button"]["cy"],
    "popup": pb["popup"],
}
with open(os.path.join(WORK, "icon_geom.json"), "w") as f:
    json.dump(out, f, indent=1)
print("ICON_GEOM", json.dumps(out))
