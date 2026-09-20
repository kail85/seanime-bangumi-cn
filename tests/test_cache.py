import unittest

from seanime_bangumi_cn.cache import Cache


class CacheTests(unittest.TestCase):
    def setUp(self):
        self.t = [100.0]
        self.cache = Cache(lambda: self.t[0])

    def test_hit_and_expiry(self):
        self.cache.put("1", "confirmed", {"title": "中文"}, 7)
        self.assertEqual(self.cache.get("1").value["title"], "中文")
        self.t[0] += 7
        self.assertIsNone(self.cache.get("1"))

    def test_negative_cache(self):
        self.cache.put("1", "negative", {"reason": "ambiguous"}, 24)
        self.assertEqual(self.cache.get("1").status, "negative")

    def test_concurrent_deduplication_token(self):
        self.assertTrue(self.cache.start_inflight("1"))
        self.assertFalse(self.cache.start_inflight("1"))
        self.cache.finish_inflight("1")
        self.assertTrue(self.cache.start_inflight("1"))

