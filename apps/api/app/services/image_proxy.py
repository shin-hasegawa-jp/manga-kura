from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import AsyncExitStack
from dataclasses import dataclass

import httpx

from app.config import Settings
from app.errors import ApiError, ApiErrorCode
from app.services.external_http_client import ExternalHttpClient
from app.services.proxy_token import ProxyTokenClaims, ProxyTokenIssuer
from app.services.proxy_usage_tracker import ProxyUsageTracker


def _get_image_media_type(content_type: str) -> str:
    media_type = content_type.split(";", 1)[0].strip().lower()
    if not media_type.startswith("image/"):
        raise ApiError(
            ApiErrorCode.UNSUPPORTED_CONTENT_TYPE,
            {"contentType": media_type},
        )
    return media_type


def _get_content_length(value: str | None, maximum_bytes: int) -> int | None:
    if value is None:
        return None
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
        raise ApiError(ApiErrorCode.RESPONSE_TOO_LARGE, {"resource": "image"})
    return content_length


@dataclass
class ImageProxyStream:
    media_type: str
    content_length: int | None
    _response: httpx.Response
    _exit_stack: AsyncExitStack
    _maximum_bytes: int
    _claims: ProxyTokenClaims
    _usage_tracker: ProxyUsageTracker

    async def iter_bytes(self) -> AsyncIterator[bytes]:
        byte_size = 0
        accounted_bytes = self.content_length or 0
        try:
            async for chunk in self._response.aiter_bytes():
                byte_size += len(chunk)
                if byte_size > self._maximum_bytes:
                    raise ApiError(
                        ApiErrorCode.RESPONSE_TOO_LARGE,
                        {"resource": "image"},
                    )
                if byte_size > accounted_bytes:
                    await self._usage_tracker.add_bytes(
                        self._claims,
                        byte_size - accounted_bytes,
                    )
                    accounted_bytes = byte_size
                yield chunk
        except ApiError:
            raise
        except (TimeoutError, httpx.TimeoutException) as error:
            raise ApiError(ApiErrorCode.UPSTREAM_TIMEOUT) from error
        except httpx.HTTPError as error:
            raise ApiError(ApiErrorCode.UPSTREAM_NETWORK_ERROR) from error
        finally:
            await self._exit_stack.aclose()


class ImageProxyService:
    def __init__(
        self,
        settings: Settings,
        http_client: ExternalHttpClient | None = None,
        token_issuer: ProxyTokenIssuer | None = None,
        usage_tracker: ProxyUsageTracker | None = None,
    ) -> None:
        self._settings = settings
        self._http_client = http_client or ExternalHttpClient(settings)
        self._token_issuer = token_issuer or ProxyTokenIssuer(
            settings.proxy_token_secret.get_secret_value(),
            settings.proxy_token_ttl_seconds,
        )
        self._usage_tracker = usage_tracker or ProxyUsageTracker(
            settings.max_image_count,
            settings.max_total_image_bytes,
        )

    async def open(self, token: str) -> ImageProxyStream:
        claims = self._token_issuer.verify(token)
        await self._usage_tracker.start(claims)
        exit_stack = AsyncExitStack()
        try:
            result = await exit_stack.enter_async_context(
                self._http_client.stream(claims.image_url)
            )
            media_type = _get_image_media_type(
                result.response.headers.get("content-type", "")
            )
            content_length = _get_content_length(
                result.response.headers.get("content-length"),
                self._settings.max_image_bytes,
            )
            await self._usage_tracker.add_bytes(claims, content_length or 0)
        except BaseException:
            await exit_stack.aclose()
            raise

        return ImageProxyStream(
            media_type=media_type,
            content_length=content_length,
            _response=result.response,
            _exit_stack=exit_stack,
            _maximum_bytes=self._settings.max_image_bytes,
            _claims=claims,
            _usage_tracker=self._usage_tracker,
        )
