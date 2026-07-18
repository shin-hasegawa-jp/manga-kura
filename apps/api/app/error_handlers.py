import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.errors import ApiError, ApiErrorCode, ERROR_DEFINITIONS
from app.schemas import ApiErrorDetail, ApiErrorResponse

logger = logging.getLogger("manga_kura.api")


def _create_error_response(
    code: ApiErrorCode,
    details: dict[str, str | int | bool] | None = None,
) -> ApiErrorResponse:
    definition = ERROR_DEFINITIONS[code]
    return ApiErrorResponse(
        error=ApiErrorDetail(
            code=code.value,
            message=definition.message,
            retryable=definition.retryable,
            details=details,
        )
    )


async def handle_api_error(request: Request, exception: Exception) -> JSONResponse:
    if not isinstance(exception, ApiError):
        return await handle_unexpected_error(request, exception)

    logger.warning(
        "api_request_failed code=%s method=%s path=%s",
        exception.code.value,
        request.method,
        request.url.path,
    )
    response = _create_error_response(exception.code, exception.details)
    headers: dict[str, str] = {}
    retry_after = (
        exception.details.get("retryAfterSeconds")
        if exception.details is not None
        else None
    )
    if isinstance(retry_after, int) and not isinstance(retry_after, bool):
        headers["Retry-After"] = str(retry_after)
    return JSONResponse(
        status_code=exception.status_code,
        content=response.model_dump(mode="json"),
        headers=headers,
    )


async def handle_unexpected_error(
    request: Request, exception: Exception
) -> JSONResponse:
    logger.error(
        "api_request_failed code=%s method=%s path=%s",
        ApiErrorCode.INTERNAL_ERROR.value,
        request.method,
        request.url.path,
    )
    definition = ERROR_DEFINITIONS[ApiErrorCode.INTERNAL_ERROR]
    response = _create_error_response(ApiErrorCode.INTERNAL_ERROR)
    return JSONResponse(
        status_code=definition.status_code,
        content=response.model_dump(mode="json"),
    )


async def handle_validation_error(
    request: Request, exception: Exception
) -> JSONResponse:
    logger.warning(
        "api_request_failed code=%s method=%s path=%s",
        ApiErrorCode.INVALID_URL.value,
        request.method,
        request.url.path,
    )
    definition = ERROR_DEFINITIONS[ApiErrorCode.INVALID_URL]
    response = _create_error_response(ApiErrorCode.INVALID_URL)
    return JSONResponse(
        status_code=definition.status_code,
        content=response.model_dump(mode="json"),
    )


def register_error_handlers(application: FastAPI) -> None:
    application.add_exception_handler(ApiError, handle_api_error)
    application.add_exception_handler(RequestValidationError, handle_validation_error)
    application.add_exception_handler(Exception, handle_unexpected_error)
