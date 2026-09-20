# Seanime Bangumi CN

A fail-open Seanime plugin that adds Simplified Chinese titles and summaries
from the public Bangumi API to the existing AniList-backed anime objects.

It does not create a custom source, replace AniList IDs, alter artwork, touch
local media, or change episode/progress/torrent identity. Existing Seanime
objects are copied in-place only at display hooks, and only non-empty Bangumi
fields are used.

## Architecture

The plugin uses official Seanime plugin hooks (`onAnimeEntry`, `onGetAnime`,
`onGetAnimeCollection`, `onGetAnimeDetails`, and their stream/metadata paths)
to decorate the existing objects. It uses `$storage`, Seanime's persistent
plugin storage, for cache entries. A cache hit is synchronous and negligible.
On a miss, the hook leaves the original object visible, queues one background
lookup, and the next render uses the result.

Bangumi searches are restricted to `type=2` (anime). Candidate scoring uses
Unicode-normalized exact title/name/name_cn/alias comparisons, then release
year and episode count. A close score tie or low score is rejected. Confirmed
subject IDs persist; metadata refreshes after seven days. Negative results live
for 24 hours. Network, JSON, schema, and plugin errors are caught and leave
Seanime's original AniList data untouched.

## Install/update

The checked-in `manifest.json` is the stable installation artifact. In a
Seanime data directory, place it in `extensions/`, then reload extensions.
The NAS deployment script does this automatically for the isolated test
instance. The manifest points at the built `code.js` on GitHub.

## Cache and logs

Cache data lives in Seanime's extension storage database, never beside media.
Use the plugin storage controls or remove the `seanime-bangumi-cn:` keys to
force refresh. Normal logs only report misses, rejected matches, and failures.

## NAS deployment

`deploy/install-rootless.sh` installs the current plugin in an isolated
rootless Seanime instance, mounts the NAS anime directories read-only, binds a
local-only port, and persists configuration under `/Volume1/nas-agent/seanime`.
It does not touch the existing Docker project or media files. The script is
intended for this NAS layout and is safe to rerun.

## Tests

Run `python3 -m unittest discover -s tests -v` for deterministic matcher/cache
tests and `python3 tests/live_bangumi.py` for live API smoke tests. The live
test never writes to Seanime or media.

## Known limitations

Seanime's supported metadata hooks expose anime titles/descriptions and not a
stable, general-purpose episode-title replacement for all library/playback
paths. Episode titles are therefore intentionally left alone. Search results
that do not pass through a mutable supported object may retain their original
AniList title; the plugin covers the library, entry/detail, collection, stream,
and standard anime object hooks.

