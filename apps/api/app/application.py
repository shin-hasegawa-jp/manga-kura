from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.images import router as images_router
from app.api.routes.pages import router as pages_router
from app.config import Settings, get_settings
from app.error_handlers import register_error_handlers
from app.logging_config import configure_logging
from app.services.external_http_client import ExternalHttpClient
from app.services.page_analyzer import PageAnalyzer
from app.services.image_proxy import ImageProxyService
from app.services.rate_limiter import DomainAccessLimiter, SlidingWindowRateLimiter
from app.services.proxy_usage_tracker import ProxyUsageTracker


def create_app(settings: Settings | None = None) -> FastAPI:
    configure_logging()
    resolved_settings = settings or Settings()
    application = FastAPI(
        title=resolved_settings.app_name,
        version=resolved_settings.app_version,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.parsed_cors_origins),
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        allow_credentials=False,
    )
    application.dependency_overrides[get_settings] = lambda: resolved_settings
    domain_limiter = DomainAccessLimiter(resolved_settings.domain_interval_seconds)
    external_http_client = ExternalHttpClient(
        resolved_settings,
        domain_limiter=domain_limiter,
    )
    application.state.page_analyzer = PageAnalyzer(
        resolved_settings,
        external_http_client,
    )
    proxy_usage_tracker = ProxyUsageTracker(
        resolved_settings.max_image_count,
        resolved_settings.max_total_image_bytes,
    )
    application.state.image_proxy_service = ImageProxyService(
        resolved_settings,
        external_http_client,
        usage_tracker=proxy_usage_tracker,
    )
    application.state.analyze_rate_limiter = SlidingWindowRateLimiter(
        resolved_settings.rate_limit_requests,
        resolved_settings.rate_limit_window_seconds,
    )
    register_error_handlers(application)
    application.include_router(health_router)
    application.include_router(images_router)
    application.include_router(pages_router)
    return application
