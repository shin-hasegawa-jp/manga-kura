from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from app.services.image_proxy import ImageProxyService

router = APIRouter(prefix="/v1/images", tags=["images"])


def get_image_proxy_service(request: Request) -> ImageProxyService:
    return request.app.state.image_proxy_service


@router.get("/proxy")
async def proxy_image(
    service: Annotated[ImageProxyService, Depends(get_image_proxy_service)],
    token: Annotated[str, Query(min_length=1)],
) -> StreamingResponse:
    image_stream = await service.open(token)
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
