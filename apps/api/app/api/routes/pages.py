from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.schemas import (
    AnalyzePageRequest,
    AnalyzePageResponse,
    ImageCandidateResponse,
    parse_http_url,
)
from app.services.page_analyzer import PageAnalyzer
from app.services.rate_limiter import SlidingWindowRateLimiter

router = APIRouter(prefix="/v1/pages", tags=["pages"])


def get_page_analyzer(request: Request) -> PageAnalyzer:
    return request.app.state.page_analyzer


def get_analyze_rate_limiter(request: Request) -> SlidingWindowRateLimiter:
    return request.app.state.analyze_rate_limiter


@router.post("/analyze", response_model=AnalyzePageResponse)
async def analyze_page(
    payload: AnalyzePageRequest,
    request: Request,
    analyzer: Annotated[PageAnalyzer, Depends(get_page_analyzer)],
    rate_limiter: Annotated[
        SlidingWindowRateLimiter, Depends(get_analyze_rate_limiter)
    ],
) -> AnalyzePageResponse:
    client_key = request.client.host if request.client is not None else "unknown"
    await rate_limiter.require(client_key)
    analysis = await analyzer.analyze(str(payload.url))
    return AnalyzePageResponse(
        page_url=parse_http_url(analysis.page_url),
        page_title=analysis.page_title,
        candidates=[
            ImageCandidateResponse(
                id=result.candidate.id,
                dom_order=result.candidate.dom_order,
                image_url=parse_http_url(result.candidate.image_url),
                source_attribute=result.candidate.source_attribute,
                parent_group_id=result.candidate.parent_group_id,
                css_classes=list(result.candidate.css_classes),
                proxy_token=result.proxy_token,
                preview_token=result.preview_token,
            )
            for result in analysis.candidates
        ],
    )
