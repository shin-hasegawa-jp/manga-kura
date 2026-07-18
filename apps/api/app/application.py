from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.api.routes.pages import router as pages_router
from app.config import Settings, get_settings
from app.error_handlers import register_error_handlers
from app.logging_config import configure_logging


def create_app(settings: Settings | None = None) -> FastAPI:
    configure_logging()
    resolved_settings = settings or Settings()
    application = FastAPI(
        title=resolved_settings.app_name,
        version=resolved_settings.app_version,
    )
    application.dependency_overrides[get_settings] = lambda: resolved_settings
    register_error_handlers(application)
    application.include_router(health_router)
    application.include_router(pages_router)
    return application
