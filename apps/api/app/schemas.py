from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, TypeAdapter

HTTP_URL_ADAPTER = TypeAdapter(HttpUrl)


def parse_http_url(value: str) -> HttpUrl:
    return HTTP_URL_ADAPTER.validate_python(value)


def _to_camel_case(value: str) -> str:
    first, *remaining = value.split("_")
    return first + "".join(part.capitalize() for part in remaining)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel_case,
        populate_by_name=True,
    )


class HealthResponse(ApiModel):
    status: Literal["ok"] = "ok"


class ApiErrorDetail(ApiModel):
    code: str
    message: str
    retryable: bool
    details: dict[str, str | int | bool] | None = None


class ApiErrorResponse(ApiModel):
    error: ApiErrorDetail


class AnalyzePageRequest(ApiModel):
    url: HttpUrl


class ImageCandidateResponse(ApiModel):
    id: str
    dom_order: int = Field(ge=0)
    image_url: HttpUrl
    source_attribute: Literal[
        "data-srcset",
        "srcset",
        "data-src",
        "data-original",
        "data-lazy-src",
        "data-original-src",
        "data-lazy",
        "src",
    ]
    parent_group_id: str | None = Field(
        default=None,
        max_length=32,
        pattern=r"^image-parent-\d+$",
    )
    css_classes: list[
        Annotated[str, Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")]
    ] = Field(default_factory=list, max_length=8)
    proxy_token: str
    preview_token: str


class AnalyzePageResponse(ApiModel):
    page_url: HttpUrl
    page_title: str | None = Field(default=None, max_length=200)
    acquisition_method: Literal["api"] = "api"
    candidates: list[ImageCandidateResponse]
