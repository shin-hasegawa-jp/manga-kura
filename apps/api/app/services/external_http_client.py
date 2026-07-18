import asyncio
import ipaddress
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx

from app.config import Settings
from app.errors import ApiError, ApiErrorCode
from app.services.url_validator import HostResolver, ValidatedUrl, validate_external_url

REDIRECT_STATUS_CODES = frozenset({301, 302, 303, 307, 308})
USER_AGENT = "manga-kura-fetch-api/0.1"


@dataclass(frozen=True)
class ExternalHttpResponse:
    url: str
    response: httpx.Response


def _format_host(address: ipaddress.IPv4Address | ipaddress.IPv6Address) -> str:
    return (
        f"[{address}]" if isinstance(address, ipaddress.IPv6Address) else str(address)
    )


def _create_pinned_url(validated_url: ValidatedUrl) -> str:
    parsed_url = urlsplit(validated_url.url)
    address = _format_host(validated_url.resolved_addresses[0])
    return urlunsplit(
        (
            parsed_url.scheme,
            f"{address}:{validated_url.port}",
            parsed_url.path,
            parsed_url.query,
            "",
        )
    )


def _create_host_header(validated_url: ValidatedUrl) -> str:
    hostname = (
        f"[{validated_url.hostname}]"
        if ":" in validated_url.hostname
        else validated_url.hostname
    )
    default_port = 443 if validated_url.url.startswith("https://") else 80
    return (
        hostname
        if validated_url.port == default_port
        else f"{hostname}:{validated_url.port}"
    )


def _header_size(response: httpx.Response) -> int:
    return sum(len(name) + len(value) + 4 for name, value in response.headers.raw)


class ExternalHttpClient:
    def __init__(
        self,
        settings: Settings,
        resolver: HostResolver | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._settings = settings
        self._resolver = resolver
        self._transport = transport

    @asynccontextmanager
    async def stream(self, url: str) -> AsyncIterator[ExternalHttpResponse]:
        timeout = httpx.Timeout(
            connect=self._settings.connect_timeout_seconds,
            read=self._settings.read_timeout_seconds,
            write=self._settings.read_timeout_seconds,
            pool=self._settings.connect_timeout_seconds,
        )
        try:
            async with asyncio.timeout(self._settings.total_timeout_seconds):
                async with httpx.AsyncClient(
                    follow_redirects=False,
                    timeout=timeout,
                    transport=self._transport,
                    trust_env=False,
                ) as client:
                    async with self._follow_redirects(client, url) as result:
                        yield result
        except ApiError:
            raise
        except (TimeoutError, httpx.TimeoutException) as error:
            raise ApiError(ApiErrorCode.UPSTREAM_TIMEOUT) from error
        except httpx.HTTPError as error:
            raise ApiError(ApiErrorCode.UPSTREAM_NETWORK_ERROR) from error

    @asynccontextmanager
    async def _follow_redirects(
        self, client: httpx.AsyncClient, initial_url: str
    ) -> AsyncIterator[ExternalHttpResponse]:
        current_url = initial_url
        visited_urls: set[str] = set()
        redirect_count = 0

        while True:
            validated_url = await validate_external_url(current_url, self._resolver)
            if validated_url.url in visited_urls:
                raise ApiError(
                    ApiErrorCode.UPSTREAM_HTTP_ERROR,
                    {"reason": "redirect_loop"},
                )
            visited_urls.add(validated_url.url)

            headers = {
                "Accept": "*/*",
                "Host": _create_host_header(validated_url),
                "User-Agent": USER_AGENT,
            }
            extensions = {"sni_hostname": validated_url.hostname}
            async with client.stream(
                "GET",
                _create_pinned_url(validated_url),
                headers=headers,
                extensions=extensions,
            ) as response:
                if _header_size(response) > self._settings.max_response_header_bytes:
                    raise ApiError(
                        ApiErrorCode.RESPONSE_TOO_LARGE,
                        {"resource": "headers"},
                    )

                if response.status_code in REDIRECT_STATUS_CODES:
                    location = response.headers.get("location")
                    if location is None:
                        raise ApiError(
                            ApiErrorCode.UPSTREAM_HTTP_ERROR,
                            {"status": response.status_code},
                        )
                    if redirect_count >= self._settings.max_redirects:
                        raise ApiError(
                            ApiErrorCode.UPSTREAM_HTTP_ERROR,
                            {"reason": "too_many_redirects"},
                        )
                    current_url = urljoin(validated_url.url, location)
                    redirect_count += 1
                    continue

                if not response.is_success:
                    raise ApiError(
                        ApiErrorCode.UPSTREAM_HTTP_ERROR,
                        {"status": response.status_code},
                    )

                yield ExternalHttpResponse(url=validated_url.url, response=response)
                return
