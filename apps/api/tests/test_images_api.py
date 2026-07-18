import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.routes.images import get_image_proxy_service
from app.application import create_app
from app.config import Settings
from app.services.external_http_client import ExternalHttpClient
from app.services.image_proxy import ImageProxyService
from app.services.proxy_token import ProxyTokenIssuer


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
            params={"token": issuer.issue("https://example.com/image.png")},
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
