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
    candidate_ids: set[str] = field(default_factory=set)


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
            if claims.candidate_id in usage.candidate_ids:
                raise ApiError(ApiErrorCode.INVALID_PROXY_TOKEN)
            if len(usage.candidate_ids) >= self._maximum_image_count:
                raise ApiError(ApiErrorCode.TOO_MANY_CANDIDATES)
            usage.candidate_ids.add(claims.candidate_id)
            usage.expires_at = max(usage.expires_at, claims.expires_at)

    async def add_bytes(self, claims: ProxyTokenClaims, byte_size: int) -> None:
        if byte_size <= 0:
            return
        async with self._lock:
            usage = self._batches.get(claims.batch_id)
            if usage is None or claims.candidate_id not in usage.candidate_ids:
                raise ApiError(ApiErrorCode.INVALID_PROXY_TOKEN)
            if usage.total_bytes + byte_size > self._maximum_total_bytes:
                raise ApiError(
                    ApiErrorCode.RESPONSE_TOO_LARGE,
                    {"resource": "totalImages"},
                )
            usage.total_bytes += byte_size
