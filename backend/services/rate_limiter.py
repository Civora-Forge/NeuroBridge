"""
Small in-process sliding-window rate limiter shared by every endpoint that
triggers a real Gemini call. One process, one set of buckets — this is
intentionally not Redis-backed; at current scale a single FastAPI worker
holding these buckets in memory is the right amount of infrastructure, and
splitting workers would need a shared store, which isn't justified yet (see
the scalability review's 10k-user notes).
"""

import threading
import time
from typing import Optional

from fastapi import HTTPException


class SlidingWindowRateLimiter:
    def __init__(self, max_events: int, window_seconds: float, message: Optional[str] = None):
        self.max_events = max_events
        self.window_seconds = window_seconds
        self.message = message or "You've sent a lot of requests in a short time — please wait a bit before trying again."
        self._buckets: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        now = time.time()
        with self._lock:
            recent = [t for t in self._buckets.get(key, []) if now - t < self.window_seconds]
            if len(recent) >= self.max_events:
                raise HTTPException(status_code=429, detail=self.message)
            recent.append(now)
            self._buckets[key] = recent

    def clear(self) -> None:
        """Test-only: reset all buckets."""
        with self._lock:
            self._buckets.clear()
