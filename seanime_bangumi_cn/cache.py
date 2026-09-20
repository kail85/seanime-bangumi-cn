from dataclasses import dataclass
from time import time


@dataclass
class CacheEntry:
    status: str
    value: dict
    expires_at: float


class Cache:
    def __init__(self, clock=time):
        self._values = {}
        self._clock = clock
        self._inflight = {}

    def get(self, key):
        entry = self._values.get(key)
        if not entry or entry.expires_at <= self._clock():
            return None
        return entry

    def put(self, key, status, value, ttl):
        self._values[key] = CacheEntry(status, value, self._clock() + ttl)

    def has_inflight(self, key):
        return key in self._inflight

    def start_inflight(self, key):
        if key in self._inflight:
            return False
        self._inflight[key] = True
        return True

    def finish_inflight(self, key):
        self._inflight.pop(key, None)

