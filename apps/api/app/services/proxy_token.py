import base64
import binascii
import hashlib
import hmac
import json
import time
from collections.abc import Callable

from app.errors import ApiError, ApiErrorCode


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    try:
        return base64.b64decode(
            f"{value}{padding}",
            altchars=b"-_",
            validate=True,
        )
    except (binascii.Error, ValueError) as error:
        raise ApiError(ApiErrorCode.INVALID_PROXY_TOKEN) from error


class ProxyTokenIssuer:
    def __init__(
        self,
        secret: str,
        ttl_seconds: int,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self._secret = secret.encode("utf-8")
        self._ttl_seconds = ttl_seconds
        self._clock = clock

    def issue(self, image_url: str) -> str:
        payload = json.dumps(
            {
                "exp": int(self._clock()) + self._ttl_seconds,
                "url": image_url,
            },
            ensure_ascii=True,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
        signature = hmac.new(self._secret, payload, hashlib.sha256).digest()
        return f"{_encode(payload)}.{_encode(signature)}"

    def verify(self, token: str) -> str:
        parts = token.split(".")
        if len(parts) != 2:
            raise ApiError(ApiErrorCode.INVALID_PROXY_TOKEN)

        payload = _decode(parts[0])
        supplied_signature = _decode(parts[1])
        expected_signature = hmac.new(self._secret, payload, hashlib.sha256).digest()
        if not hmac.compare_digest(supplied_signature, expected_signature):
            raise ApiError(ApiErrorCode.INVALID_PROXY_TOKEN)

        try:
            decoded_payload = json.loads(payload)
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            raise ApiError(ApiErrorCode.INVALID_PROXY_TOKEN) from error
        if not isinstance(decoded_payload, dict):
            raise ApiError(ApiErrorCode.INVALID_PROXY_TOKEN)

        image_url = decoded_payload.get("url")
        expires_at = decoded_payload.get("exp")
        if not isinstance(image_url, str) or not isinstance(expires_at, int):
            raise ApiError(ApiErrorCode.INVALID_PROXY_TOKEN)
        if isinstance(expires_at, bool) or self._clock() >= expires_at:
            raise ApiError(ApiErrorCode.INVALID_PROXY_TOKEN)
        return image_url
