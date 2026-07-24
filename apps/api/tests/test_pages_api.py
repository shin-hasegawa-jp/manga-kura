import pytest
from httpx import ASGITransport, AsyncClient

from app.api.routes.pages import get_analyze_rate_limiter, get_page_analyzer
from app.application import create_app
from app.config import Settings
from app.errors import ApiError, ApiErrorCode
from app.services.image_candidate_extractor import ImageCandidate
from app.services.page_analyzer import (
    AnalyzedImageCandidate,
    PageAnalysis,
)
from app.services.rate_limiter import SlidingWindowRateLimiter


class PageAnalyzerStub:
    def __init__(self, result: PageAnalysis | ApiError) -> None:
        self.result = result
        self.urls: list[str] = []

    async def analyze(self, url: str) -> PageAnalysis:
        self.urls.append(url)
        if isinstance(self.result, ApiError):
            raise self.result
        return self.result


def _create_test_app(
    analyzer: PageAnalyzerStub,
    settings: Settings | None = None,
):
    application = create_app(settings or Settings())
    application.dependency_overrides[get_page_analyzer] = lambda: analyzer
    return application


@pytest.mark.asyncio
async def test_analyze_endpoint_returns_camel_case_candidates() -> None:
    analyzer = PageAnalyzerStub(
        PageAnalysis(
            page_url="https://example.com/comic/1",
            page_title="作品名 第1話",
            candidates=(
                AnalyzedImageCandidate(
                    candidate=ImageCandidate(
                        id="image-candidate-0",
                        dom_order=0,
                        image_url="https://example.com/1.jpg",
                        source_attribute="src",
                        parent_group_id="image-parent-0",
                        css_classes=("comic-page", "lazy"),
                    ),
                    proxy_token="token",
                    preview_token="preview-token",
                ),
            ),
        )
    )
    transport = ASGITransport(app=_create_test_app(analyzer))

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/pages/analyze",
            json={"url": "https://example.com/comic/1"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "pageUrl": "https://example.com/comic/1",
        "pageTitle": "作品名 第1話",
        "acquisitionMethod": "api",
        "candidates": [
            {
                "id": "image-candidate-0",
                "domOrder": 0,
                "imageUrl": "https://example.com/1.jpg",
                "sourceAttribute": "src",
                "parentGroupId": "image-parent-0",
                "cssClasses": ["comic-page", "lazy"],
                "proxyToken": "token",
                "previewToken": "preview-token",
            }
        ],
    }
    assert analyzer.urls == ["https://example.com/comic/1"]


@pytest.mark.asyncio
async def test_analyze_endpoint_returns_empty_candidates() -> None:
    analyzer = PageAnalyzerStub(PageAnalysis("https://example.com/", ()))
    transport = ASGITransport(app=_create_test_app(analyzer))

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/pages/analyze", json={"url": "https://example.com"}
        )

    assert response.status_code == 200
    assert response.json()["candidates"] == []
    assert response.json()["pageTitle"] is None


@pytest.mark.asyncio
async def test_analyze_endpoint_uses_common_error_response() -> None:
    analyzer = PageAnalyzerStub(ApiError(ApiErrorCode.UPSTREAM_TIMEOUT))
    transport = ASGITransport(app=_create_test_app(analyzer))

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/pages/analyze", json={"url": "https://example.com"}
        )

    assert response.status_code == 504
    assert response.json()["error"]["code"] == "upstream_timeout"


@pytest.mark.asyncio
async def test_analyze_endpoint_rejects_invalid_url() -> None:
    analyzer = PageAnalyzerStub(PageAnalysis("https://example.com/", ()))
    transport = ASGITransport(app=_create_test_app(analyzer))

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/v1/pages/analyze", json={"url": "not-a-url"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_url"
    assert analyzer.urls == []


@pytest.mark.asyncio
async def test_analyze_endpoint_rate_limits_client_without_trusting_forwarded_for() -> (
    None
):
    analyzer = PageAnalyzerStub(PageAnalysis("https://example.com/", ()))
    application = _create_test_app(analyzer)
    limiter = SlidingWindowRateLimiter(1, 60)
    application.dependency_overrides[get_analyze_rate_limiter] = lambda: limiter
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        first_response = await client.post(
            "/v1/pages/analyze",
            json={"url": "https://example.com"},
            headers={"X-Forwarded-For": "198.51.100.1"},
        )
        second_response = await client.post(
            "/v1/pages/analyze",
            json={"url": "https://example.com"},
            headers={"X-Forwarded-For": "198.51.100.2"},
        )

    assert first_response.status_code == 200
    assert second_response.status_code == 429
    assert second_response.headers["Retry-After"] == "60"
    assert second_response.json()["error"]["code"] == "rate_limited"
    assert analyzer.urls == ["https://example.com/"]
