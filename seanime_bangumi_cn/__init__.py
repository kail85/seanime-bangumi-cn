"""Pure matching and cache primitives used by the deterministic test suite."""

from .matcher import choose, normalize, score
from .cache import Cache, CacheEntry

__all__ = ["Cache", "CacheEntry", "choose", "normalize", "score"]

