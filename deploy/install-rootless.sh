#!/bin/sh
set -eu
ROOT=/Volume1/nas-agent/seanime
DATA="$ROOT/data"
mkdir -p "$DATA/extensions" "$ROOT/logs"
PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
# Seanime stores the downloaded payload in an installed manifest. A raw
# payloadURI-only file is a marketplace artifact, not a directly loaded file.
jq --arg payload "$(cat "$PROJECT_ROOT/code.js")" 'del(.payloadURI) | .payload=$payload' "$PROJECT_ROOT/manifest.json" > "$DATA/extensions/seanime-bangumi-cn.json.tmp"
mv "$DATA/extensions/seanime-bangumi-cn.json.tmp" "$DATA/extensions/seanime-bangumi-cn.json"
cp "$PROJECT_ROOT/code.js" "$DATA/extensions/seanime-bangumi-cn.js"
echo "Installed plugin files in $DATA/extensions"
echo "The stable manifest uses the pushed GitHub payload; local copy is available for offline test inspection."
