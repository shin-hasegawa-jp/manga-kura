from collections.abc import AsyncIterator

import httpx
import pytest

from app.config import Settings
from app.errors import ApiError, ApiErrorCode
from app.services.external_http_client import ExternalHttpClient
from app.services.image_proxy import ImageProxyService
from app.services.proxy_token import ProxyTokenIssuer
from app.services.proxy_usage_tracker import ProxyUsageTracker


class ResolverStub:
    def __init__(self, address: str) -> None:
        self.address = address

    async def resolve(self, hostname: str, port: int) -> tuple[str, ...]:
        return (self.address,)


class ChunkedStream(httpx.AsyncByteStream):
    def __init__(self, chunks: tuple[bytes, ...], fail: bool = False) -> None:
        self.chunks = chunks
        self.fail = fail
        self.closed = False

    async def __aiter__(self) -> AsyncIterator[bytes]:
        for chunk in self.chunks:
            yield chunk
        if self.fail:
            raise httpx.ReadError("interrupted")

    async def aclose(self) -> None:
        self.closed = True


def _create_service(
    handler,
    settings: Settings | None = None,
    resolver: ResolverStub | None = None,
) -> tuple[ImageProxyService, ProxyTokenIssuer]:
    resolved_settings = settings or Settings()
    issuer = ProxyTokenIssuer("test-secret", 60, clock=lambda: 100)
    client = ExternalHttpClient(
        resolved_settings,
        resolver or ResolverStub("93.184.216.34"),
        httpx.MockTransport(handler),
    )
    usage_tracker = ProxyUsageTracker(
        resolved_settings.max_image_count,
        resolved_settings.max_total_image_bytes,
        clock=lambda: 100,
    )
    return ImageProxyService(resolved_settings, client, issuer, usage_tracker), issuer


def _issue_token(
    issuer: ProxyTokenIssuer,
    image_url: str,
    candidate_id: str = "candidate-1",
) -> str:
    return issuer.issue(image_url, "batch-1", candidate_id)


@pytest.mark.asyncio
async def test_image_is_streamed_without_persistence() -> None:
    stream = ChunkedStream((b"image-", b"bytes"))

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "image/jpeg", "Content-Length": "11"},
            stream=stream,
        )

    service, issuer = _create_service(handler)
    image = await service.open(_issue_token(issuer, "https://example.com/image.jpg"))

    body = b"".join([chunk async for chunk in image.iter_bytes()])

    assert body == b"image-bytes"
    assert image.media_type == "image/jpeg"
    assert image.content_length == 11
    assert stream.closed is True


@pytest.mark.asyncio
async def test_non_image_content_type_is_rejected() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, headers={"Content-Type": "text/html"}, content=b"html"
        )

    service, issuer = _create_service(handler)

    with pytest.raises(ApiError) as error:
        await service.open(_issue_token(issuer, "https://example.com/image"))

    assert error.value.code is ApiErrorCode.UNSUPPORTED_CONTENT_TYPE


@pytest.mark.asyncio
async def test_content_length_over_limit_is_rejected_before_streaming() -> None:
    stream = ChunkedStream((b"not-read",))

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "image/png", "Content-Length": "11"},
            stream=stream,
        )

    settings = Settings().model_copy(update={"max_image_bytes": 10})
    service, issuer = _create_service(handler, settings)

    with pytest.raises(ApiError) as error:
        await service.open(_issue_token(issuer, "https://example.com/image.png"))

    assert error.value.code is ApiErrorCode.RESPONSE_TOO_LARGE
    assert stream.closed is True


@pytest.mark.asyncio
async def test_measured_size_over_limit_stops_stream() -> None:
    stream = ChunkedStream((b"12345", b"67890", b"x"))

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, headers={"Content-Type": "image/png"}, stream=stream)

    settings = Settings().model_copy(update={"max_image_bytes": 10})
    service, issuer = _create_service(handler, settings)
    image = await service.open(_issue_token(issuer, "https://example.com/image.png"))

    with pytest.raises(ApiError) as error:
        b"".join([chunk async for chunk in image.iter_bytes()])

    assert error.value.code is ApiErrorCode.RESPONSE_TOO_LARGE
    assert stream.closed is True


@pytest.mark.asyncio
async def test_interrupted_upstream_closes_stream() -> None:
    stream = ChunkedStream((b"partial",), fail=True)

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, headers={"Content-Type": "image/webp"}, stream=stream
        )

    service, issuer = _create_service(handler)
    image = await service.open(_issue_token(issuer, "https://example.com/image.webp"))

    with pytest.raises(ApiError) as error:
        b"".join([chunk async for chunk in image.iter_bytes()])

    assert error.value.code is ApiErrorCode.UPSTREAM_NETWORK_ERROR
    assert stream.closed is True


@pytest.mark.asyncio
async def test_signed_private_destination_is_rejected() -> None:
    request_count = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal request_count
        request_count += 1
        return httpx.Response(200, headers={"Content-Type": "image/png"}, content=b"x")

    service, issuer = _create_service(handler, resolver=ResolverStub("127.0.0.1"))

    with pytest.raises(ApiError) as error:
        await service.open(_issue_token(issuer, "https://internal.example/image.png"))

    assert error.value.code is ApiErrorCode.FORBIDDEN_DESTINATION
    assert request_count == 0


@pytest.mark.asyncio
async def test_total_image_size_is_enforced_across_candidates() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "image/png", "Content-Length": "6"},
            content=b"123456",
        )

    settings = Settings().model_copy(
        update={"max_total_image_bytes": 10, "domain_interval_seconds": 0}
    )
    service, issuer = _create_service(handler, settings)
    first = await service.open(
        _issue_token(issuer, "https://first.example/image.png", "candidate-1")
    )
    assert b"".join([chunk async for chunk in first.iter_bytes()]) == b"123456"

    with pytest.raises(ApiError) as error:
        await service.open(
            _issue_token(issuer, "https://second.example/image.png", "candidate-2")
        )

    assert error.value.code is ApiErrorCode.RESPONSE_TOO_LARGE
    assert error.value.details == {"resource": "totalImages"}
