import unittest


def apply(original, cached=None):
    result = dict(original)
    if cached and cached.get("title"):
        result["title"] = cached["title"]
    if cached and cached.get("summary"):
        result["description"] = cached["summary"]
    return result


class FallbackTests(unittest.TestCase):
    def test_network_failure_original(self):
        original = {"title": "Fullmetal Alchemist Brotherhood", "description": "original"}
        self.assertEqual(apply(original), original)

    def test_missing_name_cn_retains_title(self):
        original = {"title": "Original", "description": "original"}
        self.assertEqual(apply(original, {"title": "", "summary": "中文摘要"})["title"], "Original")

    def test_missing_summary_retains_description(self):
        original = {"title": "Original", "description": "original"}
        self.assertEqual(apply(original, {"title": "中文", "summary": ""})["description"], "original")

    def test_malformed_response_safe(self):
        self.assertEqual(apply({"title": "Original"}, None)["title"], "Original")

    def test_timeout_falls_back_without_exception(self):
        original = {"title": "Macross", "description": "AniList summary"}
        self.assertEqual(apply(original, None), original)

    def test_empty_metadata_never_overwrites_both_fields(self):
        original = {"title": "Original", "description": "Original summary"}
        self.assertEqual(apply(original, {"title": "", "summary": ""}), original)
