from typing import Annotated

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.schemas import (
    AnalyzePageRequest,
    AnalyzePageResponse,
    ImageCandidateResponse,
    parse_http_url,
)
from app.services.page_analyzer import PageAnalyzer

router = APIRouter(prefix="/v1/pages", tags=["pages"])


def get_page_analyzer(
    settings: Annotated[Settings, Depends(get_settings)],
) -> PageAnalyzer:
    return PageAnalyzer(settings)


@router.post("/analyze", response_model=AnalyzePageResponse)
async def analyze_page(
    request: AnalyzePageRequest,
    analyzer: Annotated[PageAnalyzer, Depends(get_page_analyzer)],
) -> AnalyzePageResponse:
    analysis = await analyzer.analyze(str(request.url))
    return AnalyzePageResponse(
        page_url=parse_http_url(analysis.page_url),
        candidates=[
            ImageCandidateResponse(
                id=result.candidate.id,
                dom_order=result.candidate.dom_order,
                image_url=parse_http_url(result.candidate.image_url),
                source_attribute=result.candidate.source_attribute,
                proxy_token=result.proxy_token,
            )
            for result in analysis.candidates
        ],
    )
