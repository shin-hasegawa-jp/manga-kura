from __future__ import annotations

import codecs
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from email.message import Message

from app.config import Settings
from app.errors import ApiError, ApiErrorCode
from app.services.external_http_client import ExternalHttpClient

HTML_MEDIA_TYPES = frozenset({"text/html", "application/xhtml+xml"})
META_CHARSET_PATTERN = re.compile(
    rb"<meta[^>]+charset\s*=\s*[\"']?\s*([a-zA-Z0-9._:-]+)",
    re.IGNORECASE,
)
META_CHARSET_SCAN_BYTES = 4096


@dataclass(frozen=True)
class FetchedHtml:
    url: str
    html: str
    media_type: str
    encoding: str
    byte_size: int


def _parse_content_type(value: str) -> tuple[str, str | None]:
    message = Message()
    message["content-type"] = value
    return message.get_content_type().lower(), message.get_content_charset()


def _validate_content_length(value: str | None, maximum_bytes: int) -> None:
    if value is None:
        return
    try:
        content_length = int(value)
    except ValueError as error:
        raise ApiError(
            ApiErrorCode.UPSTREAM_HTTP_ERROR,
            {"reason": "invalid_content_length"},
        ) from error
    if content_length < 0:
        raise ApiError(
            ApiErrorCode.UPSTREAM_HTTP_ERROR,
            {"reason": "invalid_content_length"},
        )
    if content_length > maximum_bytes:
        raise ApiError(ApiErrorCode.RESPONSE_TOO_LARGE, {"resource": "html"})


async def _read_limited_body(
    response_iterator: AsyncIterator[bytes],
    maximum_bytes: int,
) -> bytes:
    body = bytearray()
    async for chunk in response_iterator:
        if len(body) + len(chunk) > maximum_bytes:
            raise ApiError(ApiErrorCode.RESPONSE_TOO_LARGE, {"resource": "html"})
        body.extend(chunk)
    return bytes(body)


def _detect_encoding(body: bytes, header_encoding: str | None) -> str:
    if header_encoding is not None:
        return header_encoding
    if body.startswith(codecs.BOM_UTF8):
        return "utf-8-sig"
    if body.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        return "utf-16"

    match = META_CHARSET_PATTERN.search(body[:META_CHARSET_SCAN_BYTES])
    if match is not None:
        try:
            return match.group(1).decode("ascii")
        except UnicodeDecodeError as error:
            raise ApiError(ApiErrorCode.UNSUPPORTED_CHARACTER_ENCODING) from error
    return "utf-8"


def _decode_html(body: bytes, encoding: str) -> str:
    try:
        canonical_encoding = codecs.lookup(encoding).name
        return body.decode(canonical_encoding, errors="strict")
    except (LookupError, UnicodeDecodeError) as error:
        raise ApiError(ApiErrorCode.UNSUPPORTED_CHARACTER_ENCODING) from error


async def fetch_page_html(
    url: str,
    client: ExternalHttpClient,
    settings: Settings,
) -> FetchedHtml:
    async with client.stream(url) as result:
        content_type = result.response.headers.get("content-type", "")
        media_type, header_encoding = _parse_content_type(content_type)
        if media_type not in HTML_MEDIA_TYPES:
            raise ApiError(
                ApiErrorCode.UNSUPPORTED_CONTENT_TYPE,
                {"contentType": media_type},
            )

        _validate_content_length(
            result.response.headers.get("content-length"),
            settings.max_html_bytes,
        )
        body = await _read_limited_body(
            result.response.aiter_bytes(),
            settings.max_html_bytes,
        )
        encoding = _detect_encoding(body, header_encoding)
        html = _decode_html(body, encoding)
        return FetchedHtml(
            url=result.url,
            html=html,
            media_type=media_type,
            encoding=codecs.lookup(encoding).name,
            byte_size=len(body),
        )
