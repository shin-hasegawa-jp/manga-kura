from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


class ApiErrorDetail(BaseModel):
    code: str
    message: str
    retryable: bool
    details: dict[str, str | int | bool] | None = None


class ApiErrorResponse(BaseModel):
    error: ApiErrorDetail
