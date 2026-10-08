#!/usr/bin/env sh
# Build the Chrome Web Store upload: only runtime files, manifest.json at the zip root.
# Output directory defaults to ./dist; override with OUT_DIR.
set -eu
cd "$(dirname "$0")/.."

version=$(node -p "require('./manifest.json').version")
out_dir="${OUT_DIR:-dist}"
out="$out_dir/lowercase-is-a-mood-$version.zip"

mkdir -p "$out_dir"
rm -f "$out"
zip -X -q "$out" manifest.json content.js content.css popup.html popup.js
echo "$out"
