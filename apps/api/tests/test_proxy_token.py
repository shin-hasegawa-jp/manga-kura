import pytest

from app.errors import ApiError, ApiErrorCode
from app.services.proxy_token import ProxyTokenIssuer


def test_issued_token_can_be_verified_before_expiration() -> None:
    issuer = ProxyTokenIssuer("secret", 60, clock=lambda: 100)

    token = issuer.issue("https://example.com/image.jpg")

    assert issuer.verify(token) == "https://example.com/image.jpg"


@pytest.mark.parametrize("token", ["", "invalid", "a.b.c", "@@.@@"])
def test_malformed_token_is_rejected(token: str) -> None:
    with pytest.raises(ApiError) as error:
        ProxyTokenIssuer("secret", 60, clock=lambda: 100).verify(token)

    assert error.value.code is ApiErrorCode.INVALID_PROXY_TOKEN


def test_tampered_token_is_rejected() -> None:
    issuer = ProxyTokenIssuer("secret", 60, clock=lambda: 100)
    token = issuer.issue("https://example.com/image.jpg")
    payload, signature = token.split(".")

    with pytest.raises(ApiError) as error:
        issuer.verify(f"{payload}x.{signature}")

    assert error.value.code is ApiErrorCode.INVALID_PROXY_TOKEN


def test_expired_token_is_rejected() -> None:
    now = 100.0
    issuer = ProxyTokenIssuer("secret", 60, clock=lambda: now)
    token = issuer.issue("https://example.com/image.jpg")
    now = 160.0

    with pytest.raises(ApiError) as error:
        issuer.verify(token)

    assert error.value.code is ApiErrorCode.INVALID_PROXY_TOKEN
