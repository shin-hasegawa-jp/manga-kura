from collections.abc import AsyncIterator

import httpx
import pytest

from app.config import Settings
from app.errors import ApiError, ApiErrorCode
from app.services.external_http_client import ExternalHttpClient
from app.services.page_html_fetcher import fetch_page_html


class PublicHostResolver:
    async def resolve(self, hostname: str, port: int) -> tuple[str, ...]:
        return ("93.184.216.34",)


class ChunkedStream(httpx.AsyncByteStream):
    def __init__(self, chunks: tuple[bytes, ...]) -> None:
        self.chunks = chunks
        self.iterated_chunks = 0

    async def __aiter__(self) -> AsyncIterator[bytes]:
        for chunk in self.chunks:
            self.iterated_chunks += 1
            yield chunk


def _create_client(
    handler,
    settings: Settings | None = None,
) -> tuple[ExternalHttpClient, Settings]:
    resolved_settings = settings or Settings()
    return (
        ExternalHttpClient(
            resolved_settings,
            PublicHostResolver(),
            httpx.MockTransport(handler),
        ),
        resolved_settings,
    )


@pytest.mark.asyncio
async def test_utf8_html_is_fetched() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "text/html; charset=utf-8"},
            content="<h1>漫画</h1>".encode(),
        )

    client, settings = _create_client(handler)

    result = await fetch_page_html("https://example.com", client, settings)

    assert result.url == "https://example.com/"
    assert result.html == "<h1>漫画</h1>"
    assert result.media_type == "text/html"
    assert result.encoding == "utf-8"
    assert result.byte_size == len("<h1>漫画</h1>".encode())


@pytest.mark.asyncio
async def test_xhtml_and_header_charset_are_supported() -> None:
    html = "<h1>漫画</h1>"

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "application/xhtml+xml; charset=shift_jis"},
            content=html.encode("shift_jis"),
        )

    client, settings = _create_client(handler)

    result = await fetch_page_html("https://example.com", client, settings)

    assert result.html == html
    assert result.media_type == "application/xhtml+xml"
    assert result.encoding == "shift_jis"


@pytest.mark.asyncio
async def test_meta_charset_is_used_when_header_has_no_charset() -> None:
    html = '<meta charset="shift_jis"><p>漫画</p>'

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "text/html"},
            content=html.encode("shift_jis"),
        )

    client, settings = _create_client(handler)

    result = await fetch_page_html("https://example.com", client, settings)

    assert result.html == html
    assert result.encoding == "shift_jis"


@pytest.mark.asyncio
async def test_non_html_content_type_is_rejected() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "application/json"},
            content=b"{}",
        )

    client, settings = _create_client(handler)

    with pytest.raises(ApiError) as error:
        await fetch_page_html("https://example.com", client, settings)

    assert error.value.code is ApiErrorCode.UNSUPPORTED_CONTENT_TYPE
    assert error.value.details == {"contentType": "application/json"}


@pytest.mark.asyncio
async def test_content_length_over_limit_is_rejected_before_body_read() -> None:
    stream = ChunkedStream((b"not-read",))

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "text/html", "Content-Length": "11"},
            stream=stream,
        )

    settings = Settings().model_copy(update={"max_html_bytes": 10})
    client, settings = _create_client(handler, settings)

    with pytest.raises(ApiError) as error:
        await fetch_page_html("https://example.com", client, settings)

    assert error.value.code is ApiErrorCode.RESPONSE_TOO_LARGE
    assert stream.iterated_chunks == 0


@pytest.mark.asyncio
async def test_streamed_body_over_limit_is_rejected() -> None:
    stream = ChunkedStream((b"12345", b"67890", b"x"))

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "text/html"},
            stream=stream,
        )

    settings = Settings().model_copy(update={"max_html_bytes": 10})
    client, settings = _create_client(handler, settings)

    with pytest.raises(ApiError) as error:
        await fetch_page_html("https://example.com", client, settings)

    assert error.value.code is ApiErrorCode.RESPONSE_TOO_LARGE
    assert stream.iterated_chunks == 3


@pytest.mark.asyncio
async def test_invalid_content_length_is_rejected() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "text/html", "Content-Length": "invalid"},
            stream=ChunkedStream((b"html",)),
        )

    client, settings = _create_client(handler)

    with pytest.raises(ApiError) as error:
        await fetch_page_html("https://example.com", client, settings)

    assert error.value.code is ApiErrorCode.UPSTREAM_HTTP_ERROR
    assert error.value.details == {"reason": "invalid_content_length"}


@pytest.mark.parametrize(
    ("content_type", "body"),
    [
        ("text/html; charset=unknown-charset", b"<p>text</p>"),
        ("text/html; charset=utf-8", b"\xff"),
    ],
)
@pytest.mark.asyncio
async def test_invalid_character_encoding_is_rejected(
    content_type: str, body: bytes
) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": content_type},
            content=body,
        )

    client, settings = _create_client(handler)

    with pytest.raises(ApiError) as error:
        await fetch_page_html("https://example.com", client, settings)

    assert error.value.code is ApiErrorCode.UNSUPPORTED_CHARACTER_ENCODING
