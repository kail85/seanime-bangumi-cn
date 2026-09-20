import re
import unicodedata

MIN_CONFIDENCE = 0.82


def normalize(value: str | None) -> str:
    value = unicodedata.normalize("NFKC", value or "").casefold()
    value = re.sub(r"[\u2010-\u2015\-‐‑‒–—―_:：·•'’“”\"「」『』【】〔〕()[\]{}]", " ", value)
    value = "".join(ch if ch.isalnum() else " " for ch in value)
    return " ".join(value.split())


def _aliases(subject):
    result = []
    for row in subject.get("infobox", []) or []:
        if not re.search(r"别名|alias", str(row.get("key", "")), re.I):
            continue
        values = row.get("value", [])
        if not isinstance(values, list):
            values = [values]
        for value in values:
            result.append(value if isinstance(value, str) else (value or {}).get("v"))
    return [x for x in result if x]


def score(media, subject):
    if subject.get("type") != 2:
        return 0.0
    titles = media.get("titles", [])
    candidates = [subject.get("name"), subject.get("name_cn"), *_aliases(subject)]
    if not any(normalize(t) and normalize(t) in {normalize(c) for c in candidates if c} for t in titles):
        return 0.0
    value = 0.84
    year = media.get("year")
    subject_year = int(str(subject.get("date", ""))[:4] or 0)
    if year and subject_year:
        value += 0.10 if year == subject_year else -0.16
    episodes = media.get("episodes") or 0
    subject_eps = subject.get("eps") or subject.get("episodes") or 0
    if episodes and subject_eps:
        value += 0.06 if episodes == subject_eps else (0.01 if abs(episodes - subject_eps) <= 2 else -0.08)
    return max(0.0, min(1.0, value))


def choose(media, subjects):
    ranked = sorted(
        ((score(media, subject), subject) for subject in subjects if subject.get("type") == 2),
        reverse=True,
        key=lambda item: item[0],
    )
    if not ranked or ranked[0][0] < MIN_CONFIDENCE:
        return None
    if len(ranked) > 1 and ranked[0][0] - ranked[1][0] < 0.06:
        return None
    return {"subject": ranked[0][1], "confidence": ranked[0][0]}

