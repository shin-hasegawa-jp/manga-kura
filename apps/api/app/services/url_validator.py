import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlsplit, urlunsplit

from app.errors import ApiError, ApiErrorCode

ALLOWED_SCHEMES = frozenset({"http", "https"})


class HostResolver(Protocol):
    async def resolve(self, hostname: str, port: int) -> tuple[str, ...]: ...


class SystemHostResolver:
    async def resolve(self, hostname: str, port: int) -> tuple[str, ...]:
        loop = asyncio.get_running_loop()
        try:
            results = await loop.getaddrinfo(
                hostname,
                port,
                family=socket.AF_UNSPEC,
                type=socket.SOCK_STREAM,
            )
        except OSError as error:
            raise ApiError(ApiErrorCode.UPSTREAM_NETWORK_ERROR) from error

        addresses: set[str] = set()
        for result in results:
            address = result[4][0]
            if isinstance(address, str):
                addresses.add(address)
        return tuple(sorted(addresses))


@dataclass(frozen=True)
class ValidatedUrl:
    url: str
    hostname: str
    port: int
    resolved_addresses: tuple[ipaddress.IPv4Address | ipaddress.IPv6Address, ...]


def _is_localhost(hostname: str) -> bool:
    normalized_hostname = hostname.rstrip(".").lower()
    return normalized_hostname == "localhost" or normalized_hostname.endswith(
        ".localhost"
    )


def _parse_ip_address(value: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address:
    try:
        return ipaddress.ip_address(value)
    except ValueError as error:
        raise ApiError(ApiErrorCode.UPSTREAM_NETWORK_ERROR) from error


def _require_global_addresses(
    addresses: tuple[str, ...],
) -> tuple[ipaddress.IPv4Address | ipaddress.IPv6Address, ...]:
    if not addresses:
        raise ApiError(ApiErrorCode.UPSTREAM_NETWORK_ERROR)

    parsed_addresses = tuple(_parse_ip_address(address) for address in addresses)
    if any(
        not address.is_global
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
        for address in parsed_addresses
    ):
        raise ApiError(ApiErrorCode.FORBIDDEN_DESTINATION)

    return parsed_addresses


async def validate_external_url(
    value: str,
    resolver: HostResolver | None = None,
) -> ValidatedUrl:
    has_control_character = any(
        ord(character) < 32 or ord(character) == 127 for character in value
    )
    if not value or value != value.strip() or "\\" in value or has_control_character:
        raise ApiError(ApiErrorCode.INVALID_URL)

    try:
        parsed_url = urlsplit(value)
        port = parsed_url.port
    except ValueError as error:
        raise ApiError(ApiErrorCode.INVALID_URL) from error

    scheme = parsed_url.scheme.lower()
    hostname = parsed_url.hostname
    if scheme not in ALLOWED_SCHEMES or hostname is None:
        raise ApiError(ApiErrorCode.INVALID_URL)
    if parsed_url.username is not None or parsed_url.password is not None:
        raise ApiError(ApiErrorCode.INVALID_URL)
    if _is_localhost(hostname):
        raise ApiError(ApiErrorCode.FORBIDDEN_DESTINATION)

    resolved_port = port or (443 if scheme == "https" else 80)
    try:
        direct_address = ipaddress.ip_address(hostname)
    except ValueError:
        host_resolver = resolver or SystemHostResolver()
        resolved_values = await host_resolver.resolve(hostname, resolved_port)
    else:
        resolved_values = (str(direct_address),)

    resolved_addresses = _require_global_addresses(resolved_values)
    normalized_url = urlunsplit(
        (
            scheme,
            parsed_url.netloc,
            parsed_url.path or "/",
            parsed_url.query,
            "",
        )
    )
    return ValidatedUrl(
        url=normalized_url,
        hostname=hostname.rstrip(".").lower(),
        port=resolved_port,
        resolved_addresses=resolved_addresses,
    )
