from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from app.services.image_proxy import ImageProxyService
from app.services.rate_limiter import GLOBAL_RATE_LIMIT_KEY, SlidingWindowRateLimiter

router = APIRouter(prefix="/v1/images", tags=["images"])


def get_image_proxy_service(request: Request) -> ImageProxyService:
    return request.app.state.image_proxy_service


def get_proxy_client_rate_limiter(request: Request) -> SlidingWindowRateLimiter:
    return request.app.state.proxy_client_rate_limiter


def get_proxy_global_rate_limiter(request: Request) -> SlidingWindowRateLimiter:
    return request.app.state.proxy_global_rate_limiter


@router.get("/proxy")
async def proxy_image(
    request: Request,
    service: Annotated[ImageProxyService, Depends(get_image_proxy_service)],
    client_rate_limiter: Annotated[
        SlidingWindowRateLimiter, Depends(get_proxy_client_rate_limiter)
    ],
    global_rate_limiter: Annotated[
        SlidingWindowRateLimiter, Depends(get_proxy_global_rate_limiter)
    ],
    token: Annotated[str, Query(min_length=1)],
) -> StreamingResponse:
    client_key = request.client.host if request.client is not None else "unknown"
    await client_rate_limiter.require(client_key)
    await global_rate_limiter.require(GLOBAL_RATE_LIMIT_KEY)
    image_stream = await service.open(token, client_key)
    headers = {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    }
    if image_stream.content_length is not None:
        headers["Content-Length"] = str(image_stream.content_length)
    return StreamingResponse(
        image_stream.iter_bytes(),
        media_type=image_stream.media_type,
        headers=headers,
    )
