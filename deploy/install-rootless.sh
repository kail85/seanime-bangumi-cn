#!/bin/sh
set -eu
ROOT=/Volume1/nas-agent/seanime
DATA="$ROOT/data"
mkdir -p "$DATA/extensions" "$ROOT/logs"
cp "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)/manifest.json" "$DATA/extensions/seanime-bangumi-cn.json"
cp "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)/code.js" "$DATA/extensions/seanime-bangumi-cn.js"
echo "Installed plugin files in $DATA/extensions"
echo "The stable manifest uses the pushed GitHub payload; local copy is available for offline test inspection."

