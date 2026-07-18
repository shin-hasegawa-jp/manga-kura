import re
from dataclasses import dataclass
from typing import Literal
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup, Tag

ImageSourceAttribute = Literal[
    "data-srcset",
    "srcset",
    "data-src",
    "data-original",
    "data-lazy-src",
    "data-original-src",
    "data-lazy",
    "src",
]
IMAGE_SOURCE_ATTRIBUTE_PRIORITY: tuple[ImageSourceAttribute, ...] = (
    "data-srcset",
    "srcset",
    "data-src",
    "data-original",
    "data-lazy-src",
    "data-original-src",
    "data-lazy",
    "src",
)
SRCSET_WIDTH_PATTERN = re.compile(r"^(\d+)w$")
SRCSET_DENSITY_PATTERN = re.compile(r"^(\d+(?:\.\d+)?)x$")


@dataclass(frozen=True)
class ImageCandidate:
    id: str
    dom_order: int
    image_url: str
    source_attribute: ImageSourceAttribute


@dataclass(frozen=True)
class _ExtractedSource:
    source: str
    source_attribute: ImageSourceAttribute


@dataclass(frozen=True)
class _SrcsetCandidate:
    source: str
    descriptor_kind: Literal["width", "density"]
    descriptor_value: float


def _parse_srcset_candidate(value: str) -> _SrcsetCandidate | None:
    parts = value.strip().split()
    if len(parts) == 1 and parts[0]:
        return _SrcsetCandidate(parts[0], "density", 1)
    if len(parts) != 2:
        return None

    source, descriptor = parts
    width_match = SRCSET_WIDTH_PATTERN.fullmatch(descriptor)
    if width_match is not None:
        width = int(width_match.group(1))
        return _SrcsetCandidate(source, "width", width) if width > 0 else None

    density_match = SRCSET_DENSITY_PATTERN.fullmatch(descriptor)
    if density_match is not None:
        density = float(density_match.group(1))
        return _SrcsetCandidate(source, "density", density) if density > 0 else None
    return None


def select_best_source_from_srcset(srcset: str) -> str | None:
    candidates = tuple(
        candidate
        for value in srcset.split(",")
        if (candidate := _parse_srcset_candidate(value)) is not None
    )
    if not candidates:
        return None

    descriptor_kind = candidates[0].descriptor_kind
    if any(candidate.descriptor_kind != descriptor_kind for candidate in candidates):
        return None
    return max(candidates, key=lambda candidate: candidate.descriptor_value).source


def _get_string_attribute(tag: Tag, attribute: str) -> str:
    value = tag.get(attribute)
    return value.strip() if isinstance(value, str) else ""


def _find_image_source(image: Tag) -> _ExtractedSource | None:
    for attribute in IMAGE_SOURCE_ATTRIBUTE_PRIORITY:
        value = _get_string_attribute(image, attribute)
        if not value:
            continue
        source = (
            select_best_source_from_srcset(value)
            if attribute in {"srcset", "data-srcset"}
            else value
        )
        if source is not None:
            return _ExtractedSource(source, attribute)
    return None


def _extract_unique_sources(soup: BeautifulSoup) -> tuple[_ExtractedSource, ...]:
    candidates: list[_ExtractedSource] = []
    seen_sources: set[str] = set()
    for image in soup.find_all("img"):
        if not isinstance(image, Tag):
            continue
        candidate = _find_image_source(image)
        if candidate is None or candidate.source in seen_sources:
            continue
        seen_sources.add(candidate.source)
        candidates.append(candidate)
    return tuple(candidates)


def _normalize_http_url(source: str, base_url: str) -> str | None:
    try:
        resolved_url = httpx.URL(urljoin(base_url, source))
    except (ValueError, httpx.InvalidURL):
        return None
    if resolved_url.scheme not in {"http", "https"} or not resolved_url.host:
        return None
    return str(resolved_url)


def _resolve_base_url(soup: BeautifulSoup, page_url: str) -> str:
    base = soup.find("base", href=True)
    if not isinstance(base, Tag):
        return page_url
    href = _get_string_attribute(base, "href")
    if not href:
        return page_url
    return _normalize_http_url(href, page_url) or page_url


def extract_image_candidates(html: str, page_url: str) -> tuple[ImageCandidate, ...]:
    soup = BeautifulSoup(html, "html.parser")
    base_url = _resolve_base_url(soup, page_url)
    resolved_sources: list[_ExtractedSource] = []
    seen_urls: set[str] = set()

    for candidate in _extract_unique_sources(soup):
        image_url = _normalize_http_url(candidate.source, base_url)
        if image_url is None or image_url in seen_urls:
            continue
        seen_urls.add(image_url)
        resolved_sources.append(_ExtractedSource(image_url, candidate.source_attribute))

    return tuple(
        ImageCandidate(
            id=f"image-candidate-{dom_order}",
            dom_order=dom_order,
            image_url=candidate.source,
            source_attribute=candidate.source_attribute,
        )
        for dom_order, candidate in enumerate(resolved_sources)
    )
