#!/usr/bin/env python3
"""Send one command to browser-host.mjs and print the JSON response.

Usage: ctl.py <action> [json-args]
Actions: state, markers_on, markers_off, links, blank, goto, bounds, activate
"""
import json
import os
import sys
import time

WORK = os.environ.get("LC_DEMO_WORK") or os.path.join(
    os.environ.get("TMPDIR", "/tmp"), "lc-demo")
CMD = os.path.join(WORK, "cmd.json")
RESP = os.path.join(WORK, "resp.json")
SEQ = os.path.join(WORK, "seq.txt")


def main():
    action = sys.argv[1]
    args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}

    seq = 0
    if os.path.exists(SEQ):
        try:
            seq = int(open(SEQ).read().strip())
        except ValueError:
            seq = 0
    seq += 1
    with open(SEQ, "w") as f:
        f.write(str(seq))

    if os.path.exists(RESP):
        os.remove(RESP)
    # Write via a temp file and rename so the host never reads a half-written
    # command.
    tmp = CMD + ".tmp"
    with open(tmp, "w") as f:
        json.dump({"seq": seq, "action": action, "args": args}, f)
    os.replace(tmp, CMD)

    deadline = time.time() + 30
    while time.time() < deadline:
        if os.path.exists(RESP):
            try:
                r = json.load(open(RESP))
            except (ValueError, OSError):
                time.sleep(0.1)
                continue
            if r.get("seq") == seq:
                print(json.dumps(r, indent=1))
                return 0 if r.get("ok") else 2
        time.sleep(0.12)
    print(json.dumps({"ok": False, "error": "timeout waiting for resp"}))
    return 3


if __name__ == "__main__":
    sys.exit(main())
