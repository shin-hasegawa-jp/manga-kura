from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.config import Settings
from app.error_handlers import register_error_handlers
from app.logging_config import configure_logging


def create_app(settings: Settings | None = None) -> FastAPI:
    configure_logging()
    resolved_settings = settings or Settings()
    application = FastAPI(
        title=resolved_settings.app_name,
        version=resolved_settings.app_version,
    )
    register_error_handlers(application)
    application.include_router(health_router)
    return application
