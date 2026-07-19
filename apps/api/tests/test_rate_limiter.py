import pytest

from app.errors import ApiError, ApiErrorCode
from app.services.rate_limiter import DomainAccessLimiter, SlidingWindowRateLimiter


class ClockStub:
    def __init__(self) -> None:
        self.now = 100.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.mark.asyncio
async def test_client_limit_allows_configured_count() -> None:
    clock = ClockStub()
    limiter = SlidingWindowRateLimiter(2, 60, clock)

    await limiter.require("client-a")
    await limiter.require("client-a")

    with pytest.raises(ApiError) as error:
        await limiter.require("client-a")

    assert error.value.code is ApiErrorCode.RATE_LIMITED
    assert error.value.details == {"retryAfterSeconds": 60, "scope": "client"}


@pytest.mark.asyncio
async def test_client_limit_is_independent_per_key_and_recovers() -> None:
    clock = ClockStub()
    limiter = SlidingWindowRateLimiter(1, 60, clock)

    await limiter.require("client-a")
    await limiter.require("client-b")
    clock.advance(60)
    await limiter.require("client-a")


@pytest.mark.asyncio
async def test_domain_interval_waits_before_rapid_repeat() -> None:
    clock = ClockStub()
    waits: list[float] = []

    async def sleep(seconds: float) -> None:
        waits.append(seconds)
        clock.advance(seconds)

    limiter = DomainAccessLimiter(1, clock, sleep)

    await limiter.require("example.com")
    await limiter.require("example.com")
    await limiter.require("cdn.example.com")

    assert waits == [1]
