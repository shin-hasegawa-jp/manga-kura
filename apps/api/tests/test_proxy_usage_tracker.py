from __future__ import annotations

import asyncio

import pytest

from app.errors import ApiError, ApiErrorCode
from app.services.proxy_token import ProxyTokenClaims
from app.services.proxy_usage_tracker import ProxyUsageTracker


def _claims(
    candidate_id: str,
    batch_id: str = "batch-1",
    expires_at: int = 200,
) -> ProxyTokenClaims:
    return ProxyTokenClaims(
        image_url=f"https://example.com/{candidate_id}.jpg",
        batch_id=batch_id,
        candidate_id=candidate_id,
        expires_at=expires_at,
    )


@pytest.mark.asyncio
async def test_image_count_and_total_bytes_are_tracked_per_batch() -> None:
    tracker = ProxyUsageTracker(2, 10, clock=lambda: 100)
    first = _claims("candidate-1")
    second = _claims("candidate-2")

    await tracker.start(first)
    await tracker.add_bytes(first, 4)
    await tracker.start(second)
    await tracker.add_bytes(second, 6)

    with pytest.raises(ApiError) as count_error:
        await tracker.start(_claims("candidate-3"))
    with pytest.raises(ApiError) as total_error:
        await tracker.add_bytes(second, 1)

    assert count_error.value.code is ApiErrorCode.TOO_MANY_CANDIDATES
    assert total_error.value.code is ApiErrorCode.RESPONSE_TOO_LARGE
    assert total_error.value.details == {"resource": "totalImages"}


@pytest.mark.asyncio
async def test_candidate_token_is_single_use() -> None:
    tracker = ProxyUsageTracker(2, 10, clock=lambda: 100)
    claims = _claims("candidate-1")

    await tracker.start(claims)

    with pytest.raises(ApiError) as error:
        await tracker.start(claims)

    assert error.value.code is ApiErrorCode.INVALID_PROXY_TOKEN


@pytest.mark.asyncio
async def test_expired_batch_state_is_removed() -> None:
    now = 100.0
    tracker = ProxyUsageTracker(1, 10, clock=lambda: now)
    await tracker.start(_claims("candidate-1", expires_at=101))
    now = 101.0

    await tracker.start(_claims("candidate-1", expires_at=201))


@pytest.mark.asyncio
async def test_different_batches_have_independent_limits() -> None:
    tracker = ProxyUsageTracker(1, 5, clock=lambda: 100)
    first = _claims("candidate-1", "batch-1")
    second = _claims("candidate-1", "batch-2")

    await tracker.start(first)
    await tracker.add_bytes(first, 5)
    await tracker.start(second)
    await tracker.add_bytes(second, 5)


@pytest.mark.asyncio
async def test_concurrent_updates_cannot_exceed_total_limit() -> None:
    tracker = ProxyUsageTracker(2, 10, clock=lambda: 100)
    first = _claims("candidate-1")
    second = _claims("candidate-2")
    await tracker.start(first)
    await tracker.start(second)

    async def add_bytes(claims: ProxyTokenClaims) -> ApiErrorCode | None:
        try:
            await tracker.add_bytes(claims, 6)
        except ApiError as error:
            return error.code
        return None

    results = await asyncio.gather(add_bytes(first), add_bytes(second))

    assert results.count(None) == 1
    assert results.count(ApiErrorCode.RESPONSE_TOO_LARGE) == 1
