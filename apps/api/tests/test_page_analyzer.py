import httpx
import pytest

from app.config import Settings
from app.errors import ApiError, ApiErrorCode
from app.services.external_http_client import ExternalHttpClient
from app.services.page_analyzer import PageAnalyzer
from app.services.proxy_token import ProxyTokenIssuer


class PublicHostResolver:
    async def resolve(self, hostname: str, port: int) -> tuple[str, ...]:
        return ("93.184.216.34",)


def _create_analyzer(html: str, maximum_candidates: int = 100) -> PageAnalyzer:
    settings = Settings().model_copy(update={"max_image_count": maximum_candidates})

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "text/html; charset=utf-8"},
            content=html.encode(),
        )

    client = ExternalHttpClient(
        settings,
        PublicHostResolver(),
        httpx.MockTransport(handler),
    )
    issuer = ProxyTokenIssuer("test-secret", 900, clock=lambda: 1000)
    return PageAnalyzer(settings, client, issuer)


@pytest.mark.asyncio
async def test_html_fetch_and_candidate_extraction_are_integrated() -> None:
    analyzer = _create_analyzer('<img src="/1.jpg"><img data-src="/2.jpg">')

    result = await analyzer.analyze("https://example.com/comic/1")

    assert result.page_url == "https://example.com/comic/1"
    assert tuple(item.candidate.image_url for item in result.candidates) == (
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
    )
    assert all(item.proxy_token.count(".") == 1 for item in result.candidates)


@pytest.mark.asyncio
async def test_no_candidates_is_a_successful_result() -> None:
    result = await _create_analyzer("<p>画像なし</p>").analyze("https://example.com")

    assert result.candidates == ()


@pytest.mark.asyncio
async def test_candidate_limit_is_enforced() -> None:
    analyzer = _create_analyzer('<img src="/1.jpg"><img src="/2.jpg">', 1)

    with pytest.raises(ApiError) as error:
        await analyzer.analyze("https://example.com")

    assert error.value.code is ApiErrorCode.TOO_MANY_CANDIDATES
