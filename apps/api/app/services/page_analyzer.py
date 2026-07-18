from dataclasses import dataclass

from app.config import Settings
from app.errors import ApiError, ApiErrorCode
from app.services.external_http_client import ExternalHttpClient
from app.services.image_candidate_extractor import (
    ImageCandidate,
    extract_image_candidates,
)
from app.services.page_html_fetcher import fetch_page_html
from app.services.proxy_token import ProxyTokenIssuer


@dataclass(frozen=True)
class AnalyzedImageCandidate:
    candidate: ImageCandidate
    proxy_token: str


@dataclass(frozen=True)
class PageAnalysis:
    page_url: str
    candidates: tuple[AnalyzedImageCandidate, ...]


class PageAnalyzer:
    def __init__(
        self,
        settings: Settings,
        http_client: ExternalHttpClient | None = None,
        token_issuer: ProxyTokenIssuer | None = None,
    ) -> None:
        self._settings = settings
        self._http_client = http_client or ExternalHttpClient(settings)
        self._token_issuer = token_issuer or ProxyTokenIssuer(
            settings.proxy_token_secret.get_secret_value(),
            settings.proxy_token_ttl_seconds,
        )

    async def analyze(self, url: str) -> PageAnalysis:
        fetched_html = await fetch_page_html(url, self._http_client, self._settings)
        candidates = extract_image_candidates(fetched_html.html, fetched_html.url)
        if len(candidates) > self._settings.max_image_count:
            raise ApiError(ApiErrorCode.TOO_MANY_CANDIDATES)

        return PageAnalysis(
            page_url=fetched_html.url,
            candidates=tuple(
                AnalyzedImageCandidate(
                    candidate=candidate,
                    proxy_token=self._token_issuer.issue(candidate.image_url),
                )
                for candidate in candidates
            ),
        )
