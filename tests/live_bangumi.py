import json
import urllib.parse
import urllib.request

from seanime_bangumi_cn.matcher import choose


UA = "seanime-bangumi-cn/1.0 (+https://github.com/kail85/seanime-bangumi-cn)"


def get(url):
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)


def main():
    checked = []
    for title, year, episodes in [("Fullmetal Alchemist Brotherhood", 2009, 64), ("Cowboy Bebop", 1998, 26), ("進撃の巨人", 2013, 25)]:
        data = get("https://api.bgm.tv/search/subject/" + urllib.parse.quote(title) + "?limit=10&type=2")
        subjects = []
        for item in data.get("list", [])[:5]:
            subjects.append(get(f"https://api.bgm.tv/v0/subjects/{item['id']}"))
        media = {"titles": [title], "year": year, "episodes": episodes}
        match = choose(media, subjects)
        if not match:
            raise SystemExit(f"no confident live match for {title}")
        detail = match["subject"]
        if detail.get("type") != 2 or not detail.get("name_cn") or not detail.get("summary"):
            raise SystemExit(f"incomplete live metadata for {title}")
        checked.append((title, detail["name_cn"], match["confidence"]))
    for row in checked:
        print(f"PASS {row[0]} -> {row[1]} confidence={row[2]:.2f}")


if __name__ == "__main__":
    main()
