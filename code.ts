// Plain JavaScript-compatible TypeScript is intentional: Seanime can load the
// generated payload directly and the source remains easy to audit.
function bangumiSharedFactory() {
const BGM_ROOT = "https://api.bgm.tv";
const UA = "seanime-bangumi-cn/1.0 (+https://github.com/kail85/seanime-bangumi-cn)";
const META_TTL = 7 * 24 * 60 * 60 * 1000;
const NEGATIVE_TTL = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 5000;
const MIN_CONFIDENCE = 0.82;
const inflight = {};

function now() { return Date.now(); }
function clean(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase()
    .replace(/[\u2010-\u2015\-‐‑‒–—―_:：·•'’“”"「」『』【】〔〕()[\]{}]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}
function nonEmpty(value) { return typeof value === "string" && value.trim() !== ""; }
function log(message) { try { console.log("[bangumi-cn] " + message); } catch (_) {} }
function key(id) { return "seanime-bangumi-cn:v2:" + String(id); }
function read(id) { try { return $storage.get(key(id)); } catch (_) { return undefined; } }
function write(id, value) { try { $storage.set(key(id), value); } catch (e) { log("cache write failed: " + String(e)); } }

function titlesOf(media) {
  const t = media && media.title || {};
  return [t.english, t.romaji, t.native, t.userPreferred].concat(media && media.synonyms || []).filter(nonEmpty);
}
function yearOf(media) { return media && media.startDate && Number(media.startDate.year || 0) || Number(media && media.seasonYear || 0); }
function aliasesOf(subject) {
  const out = [];
  (subject && subject.infobox || []).forEach((row) => {
    if (!row || !/别名|alias/i.test(String(row.key || ""))) return;
    const values = Array.isArray(row.value) ? row.value : [row.value];
    values.forEach((v) => out.push(typeof v === "string" ? v : v && (v.v || v.value)));
  });
  return out.filter(nonEmpty);
}
function subjectYear(subject) { return Number(String(subject && (subject.date || subject.air_date) || "").slice(0, 4)) || 0; }
function subjectEpisodes(subject) { return Number(subject && (subject.eps || subject.episodes) || 0); }
function score(media, subject) {
  if (!subject || Number(subject.type) !== 2) return 0;
  const wanted = titlesOf(media).map(clean).filter(Boolean);
  const candidate = [subject.name, subject.name_cn].concat(aliasesOf(subject)).map(clean).filter(Boolean);
  const exact = wanted.some((x) => candidate.indexOf(x) >= 0);
  if (!exact) return 0;
  let value = 0.84;
  const y = yearOf(media), sy = subjectYear(subject);
  if (y && sy) value += y === sy ? 0.10 : -0.16;
  const e = Number(media && media.episodes || 0), se = subjectEpisodes(subject);
  if (e && se) value += e === se ? 0.06 : (Math.abs(e - se) <= 2 ? 0.01 : -0.08);
  return Math.max(0, Math.min(1, value));
}
function choose(media, subjects) {
  const ranked = (subjects || []).filter((s) => Number(s && s.type) === 2)
    .map((s) => ({ subject: s, confidence: score(media, s) }))
    .filter((x) => x.confidence > 0).sort((a, b) => b.confidence - a.confidence);
  if (!ranked.length || ranked[0].confidence < MIN_CONFIDENCE || (ranked[1] && ranked[0].confidence - ranked[1].confidence < 0.06)) {
    return null;
  }
  return ranked[0];
}
async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!response || !response.ok) throw new Error("HTTP " + (response && response.status || "unknown"));
  return await response.json();
}
async function lookup(media) {
  const id = Number(media && media.id || 0);
  if (!id) return;
  const old = read(id);
  if (old && old.status === "confirmed" && old.metadataExpiresAt > now()) return;
  if (old && old.status === "negative" && old.expiresAt > now()) return;
  if (inflight[id]) return inflight[id];
  inflight[id] = (async () => {
    try {
      const seen = {};
      let selected = null;
      for (const title of titlesOf(media).slice(0, 5)) {
        const result = await fetchJson(BGM_ROOT + "/search/subject/" + encodeURIComponent(title) + "?limit=10&type=2");
        for (const s of (result && result.list || []).slice(0, 5)) {
          if (s && s.id) {
            try { seen[s.id] = await fetchJson(BGM_ROOT + "/v0/subjects/" + s.id); }
            catch (_) { seen[s.id] = s; }
          }
        }
        selected = choose(media, Object.keys(seen).map((k) => seen[k]));
        if (selected && selected.confidence >= 0.94) break;
      }
      if (!selected) {
        write(id, { status: "negative", expiresAt: now() + NEGATIVE_TTL, reason: "no confident anime candidate" });
        log("no confident match for AniList " + id);
        return;
      }
      const detail = await fetchJson(BGM_ROOT + "/v0/subjects/" + selected.subject.id);
      if (!detail || Number(detail.type) !== 2) throw new Error("invalid subject schema");
      const entry = { status: "confirmed", subjectId: Number(detail.id), confidence: selected.confidence,
        title: nonEmpty(detail.name_cn) ? detail.name_cn.trim() : "", summary: nonEmpty(detail.summary) ? detail.summary.trim() : "",
        metadataExpiresAt: now() + META_TTL, confirmedAt: old && old.confirmedAt || now() };
      write(id, entry);
      log("matched AniList " + id + " -> Bangumi " + entry.subjectId);
    } catch (e) {
      log("lookup failed for AniList " + id + ": " + String(e));
    } finally { delete inflight[id]; }
  })();
  return inflight[id];
}
function decorate(media) {
  try {
    if (!media || !media.id) return;
    const cached = read(Number(media.id));
    if (cached && cached.status === "confirmed" && cached.metadataExpiresAt > now()) {
      media.title = media.title || {};
      if (nonEmpty(cached.title)) media.title.userPreferred = cached.title;
      if (nonEmpty(cached.summary)) media.description = cached.summary;
    } else { lookup(media).catch(() => {}); }
  } catch (e) { log("decorate failed: " + String(e)); }
}
function decorateCollection(collection) {
  const lists = collection && collection.MediaListCollection && collection.MediaListCollection.lists || [];
  lists.forEach((list) => (list.entries || []).forEach((entry) => decorate(entry && entry.media)));
}
function safeHook(register, handler) {
  register((event) => { try { handler(event); } catch (e) { log("hook failed: " + String(e)); } finally { try { event.next(); } catch (_) {} } });
}
return { decorate, decorateCollection, read, nonEmpty };
}

export function init() {
  $shared.define("seanime-bangumi-cn", bangumiSharedFactory);
  $app.onAnimeEntry((e) => { try { $shared.use("seanime-bangumi-cn").decorate(e.entry && e.entry.media); } catch (_) {} finally { e.next(); } });
  $app.onGetAnime((e) => { try { $shared.use("seanime-bangumi-cn").decorate(e.anime); } catch (_) {} finally { e.next(); } });
  $app.onGetAnimeDetails((e) => { try { $shared.use("seanime-bangumi-cn").decorate(e.anime); } catch (_) {} finally { e.next(); } });
  $app.onGetAnimeCollection((e) => { try { $shared.use("seanime-bangumi-cn").decorateCollection(e.animeCollection); } catch (_) {} finally { e.next(); } });
}
