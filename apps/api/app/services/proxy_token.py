import base64
import hashlib
import hmac
import json
import time
from collections.abc import Callable


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


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
