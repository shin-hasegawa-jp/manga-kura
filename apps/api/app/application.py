from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.config import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or Settings()
    application = FastAPI(
        title=resolved_settings.app_name,
        version=resolved_settings.app_version,
    )
    application.include_router(health_router)
    return application
