#!/usr/bin/env python3
"""Build the demo input sequence against the page as it is right now.

Hacker News reorders its front page every few minutes, so link coordinates are
resolved immediately before recording rather than reused from an earlier run.

Writes steps.json (for sequence.js) and geom.sh (for record.sh).
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.environ.get("LC_DEMO_WORK") or os.path.join(
    os.environ.get("TMPDIR", "/tmp"), "lc-demo")
PY = os.environ.get("LC_DEMO_PY", "/opt/homebrew/bin/python3")


def ctl(action, args=None):
    cmd = [PY, "-I", os.path.join(HERE, "ctl.py"), action]
    if args is not None:
        cmd.append(json.dumps(args))
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if r.returncode not in (0, 2):
        raise SystemExit(f"ctl {action} failed rc={r.returncode}: "
                         f"{r.stdout}{r.stderr}")
    out = json.loads(r.stdout)
    if not out.get("ok"):
        raise SystemExit(f"ctl {action} error: {out}")
    return out["data"]


def main():
    origin = json.load(open(os.path.join(WORK, "origin.json")))
    icon = json.load(open(os.path.join(WORK, "icon_geom.json")))
    ox, oy = origin["x"], origin["y"]

    state = ctl("state")
    print("STATE", json.dumps(state))
    if state["url"].rstrip("/") != "https://news.ycombinator.com":
        ctl("goto", {"url": "https://news.ycombinator.com/"})
        print("STATE2", json.dumps(ctl("state")))

    blank = ctl("blank", {"ox": ox, "oy": oy})
    links = ctl("links", {"ox": ox, "oy": oy})
    if len(links) < 4:
        raise SystemExit(f"not enough comment links: {len(links)}")

    # Two different threads, both item?id= on news.ycombinator.com, chosen well
    # inside the viewport.
    l1, l2 = links[1], links[3]
    print("LINK1", json.dumps(l1))
    print("LINK2", json.dumps(l2))
    if l1["href"] == l2["href"]:
        raise SystemExit("link1 and link2 are the same thread")

    I = (icon["icon_x"], icon["icon_y"])
    B = (icon["btn_x"], icon["btn_y"])
    mid = (ox + 900, oy + 420)

    steps = [
        # 1. the front page in its original case
        {"c": "hold", "p": 2000, "label": "show_original"},
        # 2. the real pinned toolbar icon, popup opens
        {"c": "click", "x": I[0], "y": I[1], "p": 2200, "label": "open_popup"},
        # 3. a/A flips the page to lowercase
        {"c": "click", "x": B[0], "y": B[1], "p": 1900, "label": "click_aA"},
        {"c": "click", "x": blank["x"], "y": blank["y"], "p": 1500,
         "label": "dismiss_popup"},
        # 4. a comments thread, same origin, must load already lowercase
        {"c": "click", "x": l1["x"], "y": l1["y"], "p": 4200, "label": "thread1"},
        # 5. scroll the article
        {"c": "scroll", "x": mid[0], "y": mid[1], "dy": -32, "n": 26, "p": 1100,
         "label": "scroll1"},
        {"c": "scroll", "x": mid[0], "y": mid[1], "dy": -32, "n": 20, "p": 1400,
         "label": "scroll2"},
        # 6. Cmd+[ back to the front page, still lowercase
        {"c": "back", "p": 2700, "label": "back_to_front"},
        # 7. a second thread
        {"c": "click", "x": l2["x"], "y": l2["y"], "p": 2900, "label": "thread2"},
        {"c": "scroll", "x": mid[0], "y": mid[1], "dy": -32, "n": 16, "p": 1300,
         "label": "scroll3"},
        # 8. flip back to the original case through the popup
        {"c": "click", "x": I[0], "y": I[1], "p": 1400, "label": "open_popup2"},
        {"c": "click", "x": B[0], "y": B[1], "p": 1900, "label": "click_aA_off"},
        {"c": "click", "x": blank["x"], "y": blank["y"], "p": 2000,
         "label": "dismiss_popup2"},
        {"c": "hold", "p": 1200, "label": "show_original_again"},
    ]

    with open(os.path.join(WORK, "steps.json"), "w") as f:
        json.dump(steps, f, indent=1)

    geom = {
        "ICON_X": I[0], "ICON_Y": I[1],
        "BTN_X": B[0], "BTN_Y": B[1],
        "BLANK_X": blank["x"], "BLANK_Y": blank["y"],
        "LINK1": l1["href"], "LINK2": l2["href"],
    }
    with open(os.path.join(WORK, "geom.sh"), "w") as f:
        for k, v in geom.items():
            f.write(f"{k}={v}\n")

    print("GEOM", json.dumps(geom))
    print("STEPS", len(steps))
    return 0


if __name__ == "__main__":
    sys.exit(main())
