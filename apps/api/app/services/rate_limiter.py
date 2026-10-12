from __future__ import annotations

import asyncio
import math
import time
from collections import deque
from collections.abc import Awaitable, Callable

from app.errors import ApiError, ApiErrorCode

GLOBAL_RATE_LIMIT_KEY = "global"


def _retry_after(ready_at: float, now: float) -> int:
    return max(1, math.ceil(ready_at - now))


class SlidingWindowRateLimiter:
    def __init__(
        self,
        maximum_requests: int,
        window_seconds: float,
        clock: Callable[[], float] = time.monotonic,
        *,
        scope: str = "client",
        limit: str | None = None,
    ) -> None:
        self._maximum_requests = maximum_requests
        self._window_seconds = window_seconds
        self._clock = clock
        self._scope = scope
        self._limit = limit
        self._events_by_key: dict[str, deque[float]] = {}
        self._lock = asyncio.Lock()

    async def require(self, key: str) -> None:
        async with self._lock:
            now = self._clock()
            self._prune(now)
            events = self._events_by_key.setdefault(key, deque())
            if len(events) >= self._maximum_requests:
                raise ApiError(
                    ApiErrorCode.RATE_LIMITED,
                    self._details(
                        _retry_after(events[0] + self._window_seconds, now),
                    ),
                )
            events.append(now)

    def _prune(self, now: float) -> None:
        cutoff = now - self._window_seconds
        for stored_key, stored_events in tuple(self._events_by_key.items()):
            while stored_events and stored_events[0] <= cutoff:
                stored_events.popleft()
            if not stored_events:
                del self._events_by_key[stored_key]

    def _details(self, retry_after: int) -> dict[str, str | int | bool]:
        details: dict[str, str | int | bool] = {
            "retryAfterSeconds": retry_after,
            "scope": self._scope,
        }
        if self._limit is not None:
            details["limit"] = self._limit
        return details


class SlidingWindowByteLimiter:
    def __init__(
        self,
        maximum_bytes: int,
        window_seconds: float,
        clock: Callable[[], float] = time.monotonic,
        *,
        scope: str = "client",
        limit: str = "bytes",
    ) -> None:
        self._maximum_bytes = maximum_bytes
        self._window_seconds = window_seconds
        self._clock = clock
        self._scope = scope
        self._limit = limit
        self._events_by_key: dict[str, deque[tuple[float, int]]] = {}
        self._lock = asyncio.Lock()

    async def add(self, key: str, byte_size: int) -> None:
        if byte_size <= 0:
            return
        async with self._lock:
            now = self._clock()
            self._prune(now)
            events = self._events_by_key.setdefault(key, deque())
            total = sum(size for _, size in events)
            if total + byte_size > self._maximum_bytes:
                raise ApiError(
                    ApiErrorCode.RATE_LIMITED,
                    {
                        "retryAfterSeconds": self._retry_after(
                            events,
                            now,
                            total + byte_size - self._maximum_bytes,
                        ),
                        "scope": self._scope,
                        "limit": self._limit,
                    },
                )
            events.append((now, byte_size))

    def _prune(self, now: float) -> None:
        cutoff = now - self._window_seconds
        for stored_key, stored_events in tuple(self._events_by_key.items()):
            while stored_events and stored_events[0][0] <= cutoff:
                stored_events.popleft()
            if not stored_events:
                del self._events_by_key[stored_key]

    def _retry_after(
        self,
        events: deque[tuple[float, int]],
        now: float,
        excess_bytes: int,
    ) -> int:
        freed = 0
        ready_at = now + self._window_seconds
        for timestamp, size in events:
            freed += size
            ready_at = timestamp + self._window_seconds
            if freed >= excess_bytes:
                break
        return _retry_after(ready_at, now)


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
        self._next_access_by_domain: dict[str, float] = {}
        self._lock = asyncio.Lock()

    async def require(self, domain: str) -> None:
        async with self._lock:
            now = self._clock()
            for stored_domain, next_access in tuple(
                self._next_access_by_domain.items()
            ):
                if next_access <= now:
                    del self._next_access_by_domain[stored_domain]

            reserved_at = max(
                now,
                self._next_access_by_domain.get(domain, now),
            )
            self._next_access_by_domain[domain] = reserved_at + self._interval_seconds

        remaining = reserved_at - self._clock()
        if remaining > 0:
            await self._sleep(remaining)
