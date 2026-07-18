import logging

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel, HttpUrl

from app.application import create_app
from app.config import Settings
from app.errors import ApiError, ApiErrorCode, ERROR_DEFINITIONS


class UrlRequest(BaseModel):
    url: HttpUrl


@pytest.mark.parametrize(
    ("code", "status_code", "retryable"),
    [
        (ApiErrorCode.INVALID_URL, 422, False),
        (ApiErrorCode.FORBIDDEN_DESTINATION, 403, False),
        (ApiErrorCode.UPSTREAM_HTTP_ERROR, 502, True),
        (ApiErrorCode.UPSTREAM_NETWORK_ERROR, 502, True),
        (ApiErrorCode.UPSTREAM_TIMEOUT, 504, True),
        (ApiErrorCode.UNSUPPORTED_CONTENT_TYPE, 415, False),
        (ApiErrorCode.UNSUPPORTED_CHARACTER_ENCODING, 502, False),
        (ApiErrorCode.RESPONSE_TOO_LARGE, 413, False),
        (ApiErrorCode.TOO_MANY_CANDIDATES, 422, False),
        (ApiErrorCode.INVALID_PROXY_TOKEN, 400, False),
        (ApiErrorCode.RATE_LIMITED, 429, True),
        (ApiErrorCode.INTERNAL_ERROR, 500, True),
    ],
)
def test_error_definitions(
    code: ApiErrorCode, status_code: int, retryable: bool
) -> None:
    definition = ERROR_DEFINITIONS[code]

    assert definition.status_code == status_code
    assert definition.retryable is retryable


def _create_error_test_app() -> FastAPI:
    application = create_app(Settings())

    @application.get("/expected-error")
    def expected_error() -> None:
        raise ApiError(ApiErrorCode.UPSTREAM_HTTP_ERROR, {"status": 503})

    @application.post("/unexpected-error")
    def unexpected_error() -> None:
        raise RuntimeError("secret-html-body")

    @application.post("/validation-error")
    def validation_error(request: UrlRequest) -> None:
        del request

    return application


@pytest.mark.asyncio
async def test_api_error_is_converted_to_common_response() -> None:
    transport = ASGITransport(app=_create_error_test_app())

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/expected-error")

    assert response.status_code == 502
    assert response.json() == {
        "error": {
            "code": "upstream_http_error",
            "message": "取得先からエラーが返されました。",
            "retryable": True,
            "details": {"status": 503},
        }
    }


@pytest.mark.asyncio
async def test_unexpected_error_hides_sensitive_request_data(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.ERROR, logger="manga_kura.api")
    transport = ASGITransport(app=_create_error_test_app(), raise_app_exceptions=False)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/unexpected-error?token=secret-query",
            content="secret-request-body",
            headers={"Authorization": "Bearer secret-credential"},
        )

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "internal_error",
            "message": "サーバー内部でエラーが発生しました。",
            "retryable": True,
            "details": None,
        }
    }
    assert "secret-html-body" not in caplog.text
    assert "secret-query" not in caplog.text
    assert "secret-request-body" not in caplog.text
    assert "secret-credential" not in caplog.text
    assert "path=/unexpected-error" in caplog.text


@pytest.mark.asyncio
async def test_url_validation_error_uses_common_response() -> None:
    transport = ASGITransport(app=_create_error_test_app())

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/validation-error", json={"url": "not-a-url"})

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "invalid_url",
            "message": "URLの形式が正しくありません。",
            "retryable": False,
            "details": None,
        }
    }


def test_uvicorn_access_log_is_disabled() -> None:
    create_app(Settings())

    assert logging.getLogger("uvicorn.access").disabled is True
