import pytest
from httpx import ASGITransport, AsyncClient

from app.application import create_app
from app.config import Settings


@pytest.mark.asyncio
async def test_health_check_returns_ok() -> None:
    transport = ASGITransport(app=create_app(Settings()))

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
