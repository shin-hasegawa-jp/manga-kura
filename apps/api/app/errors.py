from dataclasses import dataclass
from enum import StrEnum


class ApiErrorCode(StrEnum):
    INVALID_URL = "invalid_url"
    FORBIDDEN_DESTINATION = "forbidden_destination"
    UPSTREAM_HTTP_ERROR = "upstream_http_error"
    UPSTREAM_NETWORK_ERROR = "upstream_network_error"
    UPSTREAM_TIMEOUT = "upstream_timeout"
    UNSUPPORTED_CONTENT_TYPE = "unsupported_content_type"
    RESPONSE_TOO_LARGE = "response_too_large"
    TOO_MANY_CANDIDATES = "too_many_candidates"
    INVALID_PROXY_TOKEN = "invalid_proxy_token"
    RATE_LIMITED = "rate_limited"
    INTERNAL_ERROR = "internal_error"


@dataclass(frozen=True)
class ErrorDefinition:
    status_code: int
    message: str
    retryable: bool


ERROR_DEFINITIONS: dict[ApiErrorCode, ErrorDefinition] = {
    ApiErrorCode.INVALID_URL: ErrorDefinition(
        422, "URLの形式が正しくありません。", False
    ),
    ApiErrorCode.FORBIDDEN_DESTINATION: ErrorDefinition(
        403, "この取得先にはアクセスできません。", False
    ),
    ApiErrorCode.UPSTREAM_HTTP_ERROR: ErrorDefinition(
        502, "取得先からエラーが返されました。", True
    ),
    ApiErrorCode.UPSTREAM_NETWORK_ERROR: ErrorDefinition(
        502, "取得先へ接続できませんでした。", True
    ),
    ApiErrorCode.UPSTREAM_TIMEOUT: ErrorDefinition(
        504, "取得先が時間内に応答しませんでした。", True
    ),
    ApiErrorCode.UNSUPPORTED_CONTENT_TYPE: ErrorDefinition(
        415, "対応していないContent-Typeです。", False
    ),
    ApiErrorCode.RESPONSE_TOO_LARGE: ErrorDefinition(
        413, "取得データが許可された上限を超えています。", False
    ),
    ApiErrorCode.TOO_MANY_CANDIDATES: ErrorDefinition(
        422, "画像候補数が許可された上限を超えています。", False
    ),
    ApiErrorCode.INVALID_PROXY_TOKEN: ErrorDefinition(
        400, "画像中継情報が無効または期限切れです。", False
    ),
    ApiErrorCode.RATE_LIMITED: ErrorDefinition(
        429, "リクエスト回数が上限を超えました。", True
    ),
    ApiErrorCode.INTERNAL_ERROR: ErrorDefinition(
        500, "サーバー内部でエラーが発生しました。", True
    ),
}


class ApiError(Exception):
    def __init__(
        self,
        code: ApiErrorCode,
        details: dict[str, str | int | bool] | None = None,
    ) -> None:
        definition = ERROR_DEFINITIONS[code]
        super().__init__(definition.message)
        self.code = code
        self.status_code = definition.status_code
        self.public_message = definition.message
        self.retryable = definition.retryable
        self.details = details
