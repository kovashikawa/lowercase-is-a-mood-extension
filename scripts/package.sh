#!/usr/bin/env sh
# Reproducible store zip. OUT_DIR overrides ./dist.
set -eu
cd "$(dirname "$0")/.."

version=$(node -p "require('./manifest.json').version")
out_dir="${OUT_DIR:-dist}"
mkdir -p "$out_dir"
out="$(cd "$out_dir" && pwd)/lowercase-is-a-mood-$version.zip"

files="manifest.json content.js content.css popup.html popup.js icons/icon-16.png icons/icon-48.png icons/icon-128.png"

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
for f in $files; do
  mkdir -p "$stage/$(dirname "$f")"
  cp "$f" "$stage/$f"
  chmod 644 "$stage/$f"
  TZ=UTC touch -t 202001010000.00 "$stage/$f"
done

rm -f "$out"
(cd "$stage" && TZ=UTC zip -X -q "$out" $files)
echo "$out"
