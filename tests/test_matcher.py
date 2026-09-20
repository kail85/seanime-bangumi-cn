import unittest

from seanime_bangumi_cn.matcher import choose, normalize


def subject(name, cn="", date="2009-04-05", eps=64, aliases=None, kind=2):
    return {"id": abs(hash(name)) % 100000, "name": name, "name_cn": cn, "date": date, "eps": eps, "type": kind,
            "infobox": [{"key": "别名", "value": [{"v": x} for x in aliases or []]}]}


class MatcherTests(unittest.TestCase):
    def test_exact_japanese_title(self):
        self.assertIsNotNone(choose({"titles": ["鋼の錬金術師 FULLMETAL ALCHEMIST"], "year": 2009, "episodes": 64}, [subject("鋼の錬金術師 FULLMETAL ALCHEMIST", "钢之炼金术师 FULLMETAL ALCHEMIST")]))

    def test_exact_english_romaji_and_alias(self):
        self.assertIsNotNone(choose({"titles": ["Fullmetal Alchemist Brotherhood"], "year": 2009, "episodes": 64}, [subject("鋼の錬金術師 FULLMETAL ALCHEMIST", aliases=["Fullmetal Alchemist Brotherhood"])]))

    def test_year_disambiguation(self):
        old, new = subject("Show", "旧", "1999-01-01", 24), subject("Show", "新", "2020-01-01", 24)
        self.assertEqual(choose({"titles": ["Show"], "year": 2020, "episodes": 24}, [old, new])["subject"]["name_cn"], "新")

    def test_episode_count_disambiguation(self):
        a, b = subject("Show", "A", "2020-01-01", 12), subject("Show", "B", "2020-01-01", 24)
        self.assertEqual(choose({"titles": ["Show"], "year": 2020, "episodes": 12}, [a, b])["subject"]["name_cn"], "A")

    def test_ambiguous_candidates_rejected(self):
        self.assertIsNone(choose({"titles": ["Show"]}, [subject("Show", "A", "", 0), subject("Show", "B", "", 0)]))

    def test_unicode_punctuation(self):
        self.assertEqual(normalize("  Ｆｕｌｌｍｅｔａｌ—Ａｌｃｈｅｍｉｓｔ  "), "fullmetal alchemist")

