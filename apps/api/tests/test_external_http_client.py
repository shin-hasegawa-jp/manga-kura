import asyncio

import httpx
import pytest

from app.config import Settings
from app.errors import ApiError, ApiErrorCode
from app.services.external_http_client import ExternalHttpClient


class HostResolverStub:
    def __init__(self, addresses_by_hostname: dict[str, tuple[str, ...]]) -> None:
        self.addresses_by_hostname = addresses_by_hostname
        self.calls: list[tuple[str, int]] = []

    async def resolve(self, hostname: str, port: int) -> tuple[str, ...]:
        self.calls.append((hostname, port))
        return self.addresses_by_hostname[hostname]


def _settings(**overrides: float | int | str) -> Settings:
    return Settings().model_copy(update=overrides)


@pytest.mark.asyncio
async def test_successful_request_is_pinned_to_validated_ip() -> None:
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, text="ok")

    resolver = HostResolverStub({"example.com": ("93.184.216.34",)})
    client = ExternalHttpClient(_settings(), resolver, httpx.MockTransport(handler))

    async with client.stream("https://example.com/page?q=1") as result:
        body = await result.response.aread()

    assert result.url == "https://example.com/page?q=1"
    assert body == b"ok"
    assert requests[0].url == "https://93.184.216.34/page?q=1"
    assert requests[0].headers["host"] == "example.com"
    assert requests[0].extensions["sni_hostname"] == "example.com"
    assert resolver.calls == [("example.com", 443)]


@pytest.mark.asyncio
async def test_each_redirect_destination_is_validated() -> None:
    requested_hosts: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requested_hosts.append(request.headers["host"])
        if request.headers["host"] == "example.com":
            return httpx.Response(
                302, headers={"Location": "https://cdn.example/image"}
            )
        return httpx.Response(200, content=b"image")

    resolver = HostResolverStub(
        {
            "example.com": ("93.184.216.34",),
            "cdn.example": ("93.184.216.35",),
        }
    )
    client = ExternalHttpClient(_settings(), resolver, httpx.MockTransport(handler))

    async with client.stream("https://example.com/start") as result:
        assert await result.response.aread() == b"image"

    assert requested_hosts == ["example.com", "cdn.example"]
    assert resolver.calls == [("example.com", 443), ("cdn.example", 443)]


@pytest.mark.asyncio
async def test_redirect_to_private_destination_is_rejected_before_request() -> None:
    request_count = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal request_count
        request_count += 1
        return httpx.Response(
            302, headers={"Location": "http://internal.example/secret"}
        )

    resolver = HostResolverStub(
        {
            "example.com": ("93.184.216.34",),
            "internal.example": ("127.0.0.1",),
        }
    )
    client = ExternalHttpClient(_settings(), resolver, httpx.MockTransport(handler))

    with pytest.raises(ApiError) as error:
        async with client.stream("https://example.com/start"):
            pass

    assert error.value.code is ApiErrorCode.FORBIDDEN_DESTINATION
    assert request_count == 1


@pytest.mark.asyncio
async def test_redirect_loop_is_rejected() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"Location": "https://example.com/start"})

    resolver = HostResolverStub({"example.com": ("93.184.216.34",)})
    client = ExternalHttpClient(_settings(), resolver, httpx.MockTransport(handler))

    with pytest.raises(ApiError) as error:
        async with client.stream("https://example.com/start"):
            pass

    assert error.value.code is ApiErrorCode.UPSTREAM_HTTP_ERROR
    assert error.value.details == {"reason": "redirect_loop"}


@pytest.mark.asyncio
async def test_redirect_limit_is_enforced() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        sequence = int(request.url.path.removeprefix("/"))
        return httpx.Response(302, headers={"Location": f"/{sequence + 1}"})

    resolver = HostResolverStub({"example.com": ("93.184.216.34",)})
    client = ExternalHttpClient(
        _settings(max_redirects=2), resolver, httpx.MockTransport(handler)
    )

    with pytest.raises(ApiError) as error:
        async with client.stream("https://example.com/0"):
            pass

    assert error.value.code is ApiErrorCode.UPSTREAM_HTTP_ERROR
    assert error.value.details == {"reason": "too_many_redirects"}


@pytest.mark.asyncio
async def test_http_error_is_converted() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    resolver = HostResolverStub({"example.com": ("93.184.216.34",)})
    client = ExternalHttpClient(_settings(), resolver, httpx.MockTransport(handler))

    with pytest.raises(ApiError) as error:
        async with client.stream("https://example.com"):
            pass

    assert error.value.code is ApiErrorCode.UPSTREAM_HTTP_ERROR
    assert error.value.details == {"status": 503}


@pytest.mark.asyncio
async def test_network_timeout_is_converted() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timeout", request=request)

    resolver = HostResolverStub({"example.com": ("93.184.216.34",)})
    client = ExternalHttpClient(_settings(), resolver, httpx.MockTransport(handler))

    with pytest.raises(ApiError) as error:
        async with client.stream("https://example.com"):
            pass

    assert error.value.code is ApiErrorCode.UPSTREAM_TIMEOUT


@pytest.mark.asyncio
async def test_total_timeout_is_enforced() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        await asyncio.sleep(0.05)
        return httpx.Response(200)

    resolver = HostResolverStub({"example.com": ("93.184.216.34",)})
    client = ExternalHttpClient(
        _settings(total_timeout_seconds=0.01),
        resolver,
        httpx.MockTransport(handler),
    )

    with pytest.raises(ApiError) as error:
        async with client.stream("https://example.com"):
            pass

    assert error.value.code is ApiErrorCode.UPSTREAM_TIMEOUT


@pytest.mark.asyncio
async def test_response_header_limit_is_enforced() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, headers={"X-Large": "a" * 100})

    resolver = HostResolverStub({"example.com": ("93.184.216.34",)})
    client = ExternalHttpClient(
        _settings(max_response_header_bytes=32),
        resolver,
        httpx.MockTransport(handler),
    )

    with pytest.raises(ApiError) as error:
        async with client.stream("https://example.com"):
            pass

    assert error.value.code is ApiErrorCode.RESPONSE_TOO_LARGE
    assert error.value.details == {"resource": "headers"}
