from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from uuid import uuid4

from app.config import Settings
from app.errors import ApiError, ApiErrorCode
from app.services.external_http_client import ExternalHttpClient
from app.services.image_candidate_extractor import (
    ImageCandidate,
    extract_image_candidates,
)
from app.services.page_html_fetcher import fetch_page_html
from app.services.page_metadata_extractor import extract_page_title
from app.services.proxy_token import ProxyTokenIssuer


@dataclass(frozen=True)
class AnalyzedImageCandidate:
    candidate: ImageCandidate
    proxy_token: str
    preview_token: str


@dataclass(frozen=True)
class PageAnalysis:
    page_url: str
    candidates: tuple[AnalyzedImageCandidate, ...]
    page_title: str | None = None


class PageAnalyzer:
    def __init__(
        self,
        settings: Settings,
        http_client: ExternalHttpClient | None = None,
        token_issuer: ProxyTokenIssuer | None = None,
        batch_id_factory: Callable[[], str] | None = None,
    ) -> None:
        self._settings = settings
        self._http_client = http_client or ExternalHttpClient(settings)
        self._token_issuer = token_issuer or ProxyTokenIssuer(
            settings.proxy_token_secret.get_secret_value(),
            settings.proxy_token_ttl_seconds,
        )
        self._batch_id_factory = batch_id_factory or (lambda: uuid4().hex)

    async def analyze(self, url: str) -> PageAnalysis:
        fetched_html = await fetch_page_html(url, self._http_client, self._settings)
        candidates = extract_image_candidates(fetched_html.html, fetched_html.url)
        if len(candidates) > self._settings.max_image_count:
            raise ApiError(ApiErrorCode.TOO_MANY_CANDIDATES)

        batch_id = self._batch_id_factory()
        preview_batch_id = self._batch_id_factory()
        return PageAnalysis(
            page_url=fetched_html.url,
            candidates=tuple(
                AnalyzedImageCandidate(
                    candidate=candidate,
                    proxy_token=self._token_issuer.issue(
                        candidate.image_url,
                        batch_id,
                        candidate.id,
                    ),
                    preview_token=self._token_issuer.issue(
                        candidate.image_url,
                        preview_batch_id,
                        candidate.id,
                    ),
                )
                for candidate in candidates
            ),
            page_title=extract_page_title(fetched_html.html),
        )
