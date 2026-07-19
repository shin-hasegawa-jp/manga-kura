import asyncio
import math
import time
from collections import deque
from collections.abc import Awaitable, Callable

from app.errors import ApiError, ApiErrorCode


class SlidingWindowRateLimiter:
    def __init__(
        self,
        maximum_requests: int,
        window_seconds: float,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._maximum_requests = maximum_requests
        self._window_seconds = window_seconds
        self._clock = clock
        self._events_by_key: dict[str, deque[float]] = {}
        self._lock = asyncio.Lock()

    async def require(self, key: str) -> None:
        async with self._lock:
            now = self._clock()
            cutoff = now - self._window_seconds
            for stored_key, stored_events in tuple(self._events_by_key.items()):
                while stored_events and stored_events[0] <= cutoff:
                    stored_events.popleft()
                if not stored_events:
                    del self._events_by_key[stored_key]

            events = self._events_by_key.setdefault(key, deque())
            if len(events) >= self._maximum_requests:
                retry_after = max(1, math.ceil(events[0] + self._window_seconds - now))
                raise ApiError(
                    ApiErrorCode.RATE_LIMITED,
                    {"retryAfterSeconds": retry_after, "scope": "client"},
                )
            events.append(now)


class DomainAccessLimiter:
    def __init__(
        self,
        interval_seconds: float,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._interval_seconds = interval_seconds
        self._clock = clock
        self._sleep = sleep
        self._last_access_by_domain: dict[str, float] = {}
        self._lock = asyncio.Lock()

    async def require(self, domain: str) -> None:
        async with self._lock:
            now = self._clock()
            last_access = self._last_access_by_domain.get(domain)
            if last_access is not None:
                remaining = last_access + self._interval_seconds - now
                if remaining > 0:
                    await self._sleep(remaining)
            self._last_access_by_domain[domain] = self._clock()
