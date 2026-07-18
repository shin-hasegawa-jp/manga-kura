import pytest
from httpx import ASGITransport, AsyncClient

from app.application import create_app
from app.config import Settings


@pytest.mark.asyncio
async def test_configured_frontend_origin_can_preflight_analyze_request() -> None:
    application = create_app(
        Settings(cors_origins="http://127.0.0.1:5173,http://localhost:5173")
    )
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.options(
            "/v1/pages/analyze",
            headers={
                "Origin": "http://127.0.0.1:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "content-type" in response.headers["access-control-allow-headers"].lower()
    assert "access-control-allow-credentials" not in response.headers


@pytest.mark.asyncio
async def test_unconfigured_origin_is_not_allowed() -> None:
    application = create_app(Settings(cors_origins="http://127.0.0.1:5173"))
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.options(
            "/v1/pages/analyze",
            headers={
                "Origin": "https://attacker.example",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.asyncio
async def test_error_response_includes_cors_header_for_configured_origin() -> None:
    application = create_app(Settings(cors_origins="http://127.0.0.1:5173"))
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/pages/analyze",
            headers={"Origin": "http://127.0.0.1:5173"},
            json={"url": "not-a-url"},
        )

    assert response.status_code == 422
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
