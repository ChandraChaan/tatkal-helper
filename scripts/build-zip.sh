#!/usr/bin/env bash
# Packages the extension's runtime files into dist/tatkal-helper-<version>.zip.
# The zip contains a single top-level folder "tatkal-helper/" so unzipping gives one folder to load unpacked.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
STAGE=$(mktemp -d)
mkdir -p "$STAGE/tatkal-helper" dist
cp -R manifest.json background.js content popup shared LICENSE README.md "$STAGE/tatkal-helper/"
mkdir -p "$STAGE/tatkal-helper/icons" && cp icons/icon*.png "$STAGE/tatkal-helper/icons/"
find "$STAGE" -name .DS_Store -delete
OUT="$PWD/dist/tatkal-helper-${VERSION}.zip"
rm -f "$OUT"
(cd "$STAGE" && zip -qr "$OUT" tatkal-helper)
rm -rf "$STAGE"
echo "built $OUT"
