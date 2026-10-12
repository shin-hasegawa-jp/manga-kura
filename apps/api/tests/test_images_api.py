import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.routes.images import (
    get_image_proxy_service,
    get_proxy_client_rate_limiter,
    get_proxy_global_rate_limiter,
)
from app.application import create_app
from app.config import Settings
from app.services.external_http_client import ExternalHttpClient
from app.services.image_proxy import ImageProxyService
from app.services.proxy_token import ProxyTokenIssuer
from app.services.rate_limiter import SlidingWindowRateLimiter


class PublicHostResolver:
    async def resolve(self, hostname: str, port: int) -> tuple[str, ...]:
        return ("93.184.216.34",)


@pytest.mark.asyncio
async def test_proxy_endpoint_streams_image_with_safe_headers() -> None:
    settings = Settings()

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "image/png", "Content-Length": "5"},
            content=b"image",
        )

    issuer = ProxyTokenIssuer("test-secret", 60, clock=lambda: 100)
    service = ImageProxyService(
        settings,
        ExternalHttpClient(
            settings,
            PublicHostResolver(),
            httpx.MockTransport(handler),
        ),
        issuer,
    )
    application = create_app(settings)
    application.dependency_overrides[get_image_proxy_service] = lambda: service
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/v1/images/proxy",
            params={
                "token": issuer.issue(
                    "https://example.com/image.png",
                    "batch-1",
                    "candidate-1",
                )
            },
        )

    assert response.status_code == 200
    assert response.content == b"image"
    assert response.headers["Content-Type"] == "image/png"
    assert response.headers["Content-Length"] == "5"
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["X-Content-Type-Options"] == "nosniff"


@pytest.mark.asyncio
async def test_proxy_endpoint_rejects_invalid_token() -> None:
    application = create_app(Settings())
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/v1/images/proxy", params={"token": "invalid"})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_proxy_token"


def _create_proxy_client(
    client_limit: int,
    global_limit: int,
) -> tuple[AsyncClient, ProxyTokenIssuer]:
    settings = Settings()

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "image/png", "Content-Length": "5"},
            content=b"image",
        )

    issuer = ProxyTokenIssuer("test-secret", 60, clock=lambda: 100)
    service = ImageProxyService(
        settings,
        ExternalHttpClient(
            settings,
            PublicHostResolver(),
            httpx.MockTransport(handler),
        ),
        issuer,
    )
    application = create_app(settings)
    application.dependency_overrides[get_image_proxy_service] = lambda: service
    client_limiter = SlidingWindowRateLimiter(client_limit, 60, limit="requests")
    global_limiter = SlidingWindowRateLimiter(
        global_limit,
        60,
        scope="global",
        limit="requests",
    )
    application.dependency_overrides[get_proxy_client_rate_limiter] = lambda: (
        client_limiter
    )
    application.dependency_overrides[get_proxy_global_rate_limiter] = lambda: (
        global_limiter
    )
    return (
        AsyncClient(
            transport=ASGITransport(app=application),
            base_url="http://test",
        ),
        issuer,
    )


@pytest.mark.asyncio
async def test_proxy_endpoint_rate_limits_client_without_trusting_forwarded_for() -> (
    None
):
    client, issuer = _create_proxy_client(1, 10)
    token = issuer.issue("https://example.com/image.png", "batch-1", "candidate-1")

    async with client:
        first_response = await client.get(
            "/v1/images/proxy",
            params={"token": token},
            headers={"X-Forwarded-For": "198.51.100.1"},
        )
        second_response = await client.get(
            "/v1/images/proxy",
            params={"token": token},
            headers={"X-Forwarded-For": "198.51.100.2"},
        )

    assert first_response.status_code == 200
    assert second_response.status_code == 429
    assert second_response.headers["Retry-After"] == "60"
    assert second_response.json()["error"]["code"] == "rate_limited"
    assert second_response.json()["error"]["details"]["scope"] == "client"
    assert second_response.json()["error"]["details"]["limit"] == "requests"


@pytest.mark.asyncio
async def test_proxy_endpoint_rate_limits_all_clients_together() -> None:
    client, issuer = _create_proxy_client(10, 1)
    token = issuer.issue("https://example.com/image.png", "batch-1", "candidate-1")

    async with client:
        first_response = await client.get("/v1/images/proxy", params={"token": token})
        second_response = await client.get("/v1/images/proxy", params={"token": token})

    assert first_response.status_code == 200
    assert second_response.status_code == 429
    assert second_response.json()["error"]["details"]["scope"] == "global"
    assert second_response.json()["error"]["details"]["limit"] == "requests"
