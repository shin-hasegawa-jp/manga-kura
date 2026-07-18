import ipaddress

import pytest

from app.errors import ApiError, ApiErrorCode
from app.services.url_validator import validate_external_url


class FakeHostResolver:
    def __init__(self, addresses: tuple[str, ...]) -> None:
        self.addresses = addresses
        self.calls: list[tuple[str, int]] = []

    async def resolve(self, hostname: str, port: int) -> tuple[str, ...]:
        self.calls.append((hostname, port))
        return self.addresses


@pytest.mark.asyncio
async def test_public_https_url_is_accepted() -> None:
    resolver = FakeHostResolver(("93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"))

    result = await validate_external_url(
        "https://example.com/path?q=1#fragment", resolver
    )

    assert result.url == "https://example.com/path?q=1"
    assert result.hostname == "example.com"
    assert result.port == 443
    assert result.resolved_addresses == (
        ipaddress.ip_address("93.184.216.34"),
        ipaddress.ip_address("2606:2800:220:1:248:1893:25c8:1946"),
    )
    assert resolver.calls == [("example.com", 443)]


@pytest.mark.asyncio
async def test_public_ip_address_is_accepted_without_dns_resolution() -> None:
    resolver = FakeHostResolver(("127.0.0.1",))

    result = await validate_external_url("http://8.8.8.8:8080", resolver)

    assert result.port == 8080
    assert result.resolved_addresses == (ipaddress.ip_address("8.8.8.8"),)
    assert resolver.calls == []


@pytest.mark.parametrize(
    "url",
    [
        "",
        " https://example.com",
        "https://example.com/line\nbreak",
        "https://example.com\\private",
        "ftp://example.com/file",
        "file:///etc/passwd",
        "https://user:password@example.com",
        "https://example.com:invalid",
    ],
)
@pytest.mark.asyncio
async def test_invalid_url_is_rejected(url: str) -> None:
    with pytest.raises(ApiError) as error:
        await validate_external_url(url, FakeHostResolver(("93.184.216.34",)))

    assert error.value.code is ApiErrorCode.INVALID_URL


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost",
        "http://localhost.",
        "http://api.localhost",
        "http://127.0.0.1",
        "http://127.0.0.2",
        "http://[::1]",
        "http://169.254.169.254/latest/meta-data",
        "http://10.0.0.1",
        "http://172.16.0.1",
        "http://192.168.0.1",
        "http://0.0.0.0",
        "http://224.0.0.1",
        "http://192.0.2.1",
    ],
)
@pytest.mark.asyncio
async def test_non_global_destination_is_rejected(url: str) -> None:
    with pytest.raises(ApiError) as error:
        await validate_external_url(url, FakeHostResolver(("93.184.216.34",)))

    assert error.value.code is ApiErrorCode.FORBIDDEN_DESTINATION


@pytest.mark.asyncio
async def test_all_dns_results_must_be_global() -> None:
    resolver = FakeHostResolver(("93.184.216.34", "127.0.0.1"))

    with pytest.raises(ApiError) as error:
        await validate_external_url("https://example.com", resolver)

    assert error.value.code is ApiErrorCode.FORBIDDEN_DESTINATION


@pytest.mark.parametrize(
    "numeric_hostname", ["2130706433", "0x7f000001", "017700000001"]
)
@pytest.mark.asyncio
async def test_numeric_hostname_is_judged_by_resolved_address(
    numeric_hostname: str,
) -> None:
    resolver = FakeHostResolver(("127.0.0.1",))

    with pytest.raises(ApiError) as error:
        await validate_external_url(f"http://{numeric_hostname}", resolver)

    assert error.value.code is ApiErrorCode.FORBIDDEN_DESTINATION
    assert resolver.calls == [(numeric_hostname, 80)]


@pytest.mark.asyncio
async def test_empty_dns_result_is_a_network_error() -> None:
    with pytest.raises(ApiError) as error:
        await validate_external_url("https://example.com", FakeHostResolver(()))

    assert error.value.code is ApiErrorCode.UPSTREAM_NETWORK_ERROR
