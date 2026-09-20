# Design notes

Seanime's current official extension definitions expose mutable references in
the anime-entry, anime-object, library-collection, stream-collection, and
metadata hook events. A custom source would manufacture a different media
identity and could break local matching, AniList progress, artwork, or torrent
lookups, so it was rejected.

The plugin decorates only `media.title.userPreferred`, `media.title.english`,
and `media.description` where those fields exist. It never changes `id`,
`localFiles`, `libraryData`, list progress, images, mappings, or episode
objects. Hook callbacks always call `next()` in a `finally`-style guard.

The first lookup is asynchronous and non-blocking. A per-Anilist-ID in-memory
inflight map prevents request storms inside a plugin runtime; the persistent
cache prevents storms across restarts. Confirmed mappings are not silently
changed by later searches: refresh may replace metadata, but only a new
confident match can replace a mapping.

