"""LANCZOS-downscale the 3x masters rendered by render.mjs to their exact target size."""
import json
import sys

from PIL import Image

for job in json.load(sys.stdin):
    img = Image.open(job["master"]).convert("RGB")
    img = img.resize((job["w"], job["h"]), Image.Resampling.LANCZOS)
    img.save(job["out"], optimize=True)
    print(f"{job['out']} {img.width}x{img.height} {img.mode}")
