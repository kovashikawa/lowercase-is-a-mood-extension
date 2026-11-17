#!/usr/bin/env python3
"""Print 'on' or 'off' for the extension's lowercase state on the current tab."""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PY = os.environ.get("LC_DEMO_PY", "/opt/homebrew/bin/python3")

r = subprocess.run(
    [PY, "-I", os.path.join(HERE, "ctl.py"), "state"],
    capture_output=True, text=True, timeout=60,
)
try:
    d = json.loads(r.stdout)["data"]
except Exception:
    print("unknown")
    sys.exit(1)
print("on" if d.get("transform") == "lowercase" else "off")
