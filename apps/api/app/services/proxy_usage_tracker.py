import asyncio
import time
from collections.abc import Callable
from dataclasses import dataclass, field

from app.errors import ApiError, ApiErrorCode
from app.services.proxy_token import ProxyTokenClaims


@dataclass
class _BatchUsage:
    expires_at: int
    total_bytes: int = 0
    purposes_by_candidate: dict[str, set[str]] = field(default_factory=dict)


class ProxyUsageTracker:
    def __init__(
        self,
        maximum_image_count: int,
        maximum_total_bytes: int,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self._maximum_image_count = maximum_image_count
        self._maximum_total_bytes = maximum_total_bytes
        self._clock = clock
        self._batches: dict[str, _BatchUsage] = {}
        self._lock = asyncio.Lock()

    async def start(self, claims: ProxyTokenClaims) -> None:
        async with self._lock:
            now = self._clock()
            for batch_id, usage in tuple(self._batches.items()):
                if usage.expires_at <= now:
                    del self._batches[batch_id]

            usage = self._batches.setdefault(
                claims.batch_id,
                _BatchUsage(expires_at=claims.expires_at),
            )
            purposes = usage.purposes_by_candidate.get(claims.candidate_id)
            if purposes is not None and claims.purpose in purposes:
                raise ApiError(ApiErrorCode.INVALID_PROXY_TOKEN)
            if (
                purposes is None
                and len(usage.purposes_by_candidate) >= self._maximum_image_count
            ):
                raise ApiError(ApiErrorCode.TOO_MANY_CANDIDATES)
            usage.purposes_by_candidate.setdefault(claims.candidate_id, set()).add(
                claims.purpose
            )
            usage.expires_at = max(usage.expires_at, claims.expires_at)

    async def add_bytes(self, claims: ProxyTokenClaims, byte_size: int) -> None:
        if byte_size <= 0:
            return
        async with self._lock:
            usage = self._batches.get(claims.batch_id)
            purposes = (
                None
                if usage is None
                else usage.purposes_by_candidate.get(claims.candidate_id)
            )
            if usage is None or purposes is None or claims.purpose not in purposes:
                raise ApiError(ApiErrorCode.INVALID_PROXY_TOKEN)
            if usage.total_bytes + byte_size > self._maximum_total_bytes:
                raise ApiError(
                    ApiErrorCode.RESPONSE_TOO_LARGE,
                    {"resource": "totalImages"},
                )
            usage.total_bytes += byte_size
