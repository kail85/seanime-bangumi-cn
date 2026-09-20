#!/bin/sh
set -eu
test -s code.ts
test -s code.js
test -s manifest.json
python3 - <<'PY'
import json
from pathlib import Path
m=json.loads(Path('manifest.json').read_text())
assert m['type']=='plugin' and m['plugin']['permissions']['allow']['networkAccess']['allowedDomains']==['api.bgm.tv']
assert 'payloadURI' in m
for p in ('code.ts','code.js'):
    text=Path(p).read_text()
    assert 'function init' in text and '$app.onAnimeEntry' in text and 'type=2' in text
print('build: manifest and payload checks passed')
PY

