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
function key(id) { return "seanime-bangumi-cn:v11:" + String(id); }
function read(id) { try { return $storage.get(key(id)); } catch (_) { return undefined; } }
function write(id, value) { try { $storage.set(key(id), value); } catch (e) { log("cache write failed: " + String(e)); } }

function titlesOf(media) {
  const t = media && media.title || {};
  const out = [];
  [t.english, t.romaji, t.native, t.userPreferred].forEach((v) => { if (nonEmpty(v)) out.push(String(v)); });
  const synonyms = media && media.synonyms || [];
  for (let i = 0; i < synonyms.length; i++) if (nonEmpty(synonyms[i])) out.push(String(synonyms[i]));
  return out;
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
function fetchJson(url) {
  const response = $await(fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } }));
  if (!response || !response.ok) throw new Error("HTTP " + (response && response.status || "unknown"));
  return $await(response.json());
}
function lookup(media) {
  const id = Number(media && media.id || 0);
  if (!id) return;
  const titles = titlesOf(media);
  if (!titles.length) return;
  const old = read(id);
  if (old && old.status === "confirmed" && old.metadataExpiresAt > now()) return;
  if (old && old.status === "negative" && old.expiresAt > now()) return;
  if (inflight[id]) return inflight[id];
  inflight[id] = true;
    try {
      let selected = null;
      for (let ti = 0; ti < Math.min(5, titles.length); ti++) {
        const title = titles[ti];
        const result = fetchJson(BGM_ROOT + "/search/subject/" + encodeURIComponent(title) + "?limit=10&type=2");
        const list = result && result.list || [];
        for (let si = 0; si < Math.min(5, list.length); si++) {
          const s = list[si];
          if (s && s.id && Number(s.type) === 2) {
            selected = s;
            break;
          }
        }
        if (selected) break;
      }
      if (!selected) {
        write(id, { status: "negative", expiresAt: now() + NEGATIVE_TTL, reason: "no confident anime candidate" });
        log("no confident match for AniList " + id);
        return;
      }
      const detail = fetchJson(BGM_ROOT + "/v0/subjects/" + selected.id);
      if (!detail || Number(detail.type) !== 2) throw new Error("invalid subject schema");
      const exact = titles.some((t) => clean(t) === clean(detail.name) || clean(t) === clean(detail.name_cn) || aliasesOf(detail).map(clean).indexOf(clean(t)) >= 0);
      let confidence = exact ? 0.84 : 0.80;
      const sy = subjectYear(detail), y = yearOf(media);
      if (y && sy) confidence += y === sy ? 0.10 : -0.16;
      const se = subjectEpisodes(detail), e = Number(media && media.episodes || 0);
      if (e && se) confidence += e === se ? 0.06 : (Math.abs(e - se) <= 2 ? 0.01 : -0.08);
      confidence = Math.max(0, Math.min(1, confidence));
      if (confidence < MIN_CONFIDENCE) throw new Error("candidate confidence below threshold");
      const entry = { status: "confirmed", subjectId: Number(detail.id), confidence: confidence,
        title: nonEmpty(detail.name_cn) ? detail.name_cn.trim() : "", summary: nonEmpty(detail.summary) ? detail.summary.trim() : "",
        metadataExpiresAt: now() + META_TTL, confirmedAt: old && old.confirmedAt || now() };
      write(id, entry);
      log("matched AniList " + id + " -> Bangumi " + entry.subjectId);
    } catch (e) {
      log("lookup failed for AniList " + id + ": " + String(e));
    } finally { delete inflight[id]; }
}
function decorate(media) {
  try {
    if (!media || !media.id) return;
    const cached = read(Number(media.id));
    if (cached && cached.status === "confirmed" && cached.metadataExpiresAt > now()) {
      media.title = media.title || {};
      if (nonEmpty(cached.title)) media.title.userPreferred = cached.title;
      if (nonEmpty(cached.summary)) media.description = cached.summary;
    } else {
      lookup(media);
      const refreshed = read(Number(media.id));
      if (refreshed && refreshed.status === "confirmed" && refreshed.metadataExpiresAt > now()) {
        media.title = media.title || {};
        if (nonEmpty(refreshed.title)) media.title.userPreferred = refreshed.title;
        if (nonEmpty(refreshed.summary)) media.description = refreshed.summary;
      }
    }
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

function init() {
  $shared.define("seanime-bangumi-cn", bangumiSharedFactory);
  $app.onAnimeEntryRequested((e) => { try { $shared.use("seanime-bangumi-cn").decorateCollection(e.animeCollection); } catch (_) {} finally { e.next(); } });
  $app.onAnimeEntry((e) => { try {
    const m = e.entry && e.entry.media, id = Number(m && m.id || 0), t = m && m.title || {};
    if (id && t.english) {
      const k = "seanime-bangumi-cn:v12:" + id, c = $storage.get(k), apply = (x) => {
        if (x && x.title) { m.title.userPreferred = x.title; if (x.summary) m.description = x.summary; }
      };
      if (c && c.status === "confirmed" && c.metadataExpiresAt > Date.now()) apply(c);
      else {
        const sr = $await(fetch("https://api.bgm.tv/search/subject/" + encodeURIComponent(t.english) + "?limit=1&type=2", {headers:{"User-Agent":"seanime-bangumi-cn/1.0 (+https://github.com/kail85/seanime-bangumi-cn)"}}));
        const sj = $await(sr.json()), s = sj && sj.list && sj.list[0];
        if (s && Number(s.type) === 2) {
          const dr = $await(fetch("https://api.bgm.tv/v0/subjects/" + s.id, {headers:{"User-Agent":"seanime-bangumi-cn/1.0 (+https://github.com/kail85/seanime-bangumi-cn)"}}));
          const d = $await(dr.json()), y = Number(String(d.date || "").slice(0,4));
          if (d && Number(d.type) === 2 && (!m.seasonYear || !y || m.seasonYear === y)) {
            const x = {status:"confirmed",subjectId:Number(d.id),title:typeof d.name_cn === "string" ? d.name_cn : "",summary:typeof d.summary === "string" ? d.summary : "",metadataExpiresAt:Date.now()+604800000};
            $storage.set(k, x); apply(x);
          }
        }
      }
    }
  } catch (_) {} finally { e.next(); } });
  $app.onGetAnime((e) => { try { $shared.use("seanime-bangumi-cn").decorate(e.anime); } catch (_) {} finally { e.next(); } });
  $app.onGetAnimeDetails((e) => { try { $shared.use("seanime-bangumi-cn").decorate(e.anime); } catch (_) {} finally { e.next(); } });
  $app.onGetAnimeCollection((e) => { try { $shared.use("seanime-bangumi-cn").decorateCollection(e.animeCollection); } catch (_) {} finally { e.next(); } });
}
