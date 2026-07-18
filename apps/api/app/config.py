from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="API_",
        extra="ignore",
    )

    app_name: str = "漫画蔵 取得専用API"
    app_version: str = "0.1.0"
    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173"
    connect_timeout_seconds: float = Field(default=5, gt=0)
    read_timeout_seconds: float = Field(default=10, gt=0)
    total_timeout_seconds: float = Field(default=15, gt=0)
    max_redirects: int = Field(default=5, ge=0)
    max_response_header_bytes: int = Field(default=65536, gt=0)
    max_html_bytes: int = Field(default=5242880, gt=0)
    max_image_bytes: int = Field(default=20971520, gt=0)
    max_image_count: int = Field(default=100, gt=0)
    proxy_token_ttl_seconds: int = Field(default=900, gt=0)
    proxy_token_secret: SecretStr = SecretStr("local-development-only-change-me")
    rate_limit_requests: int = Field(default=30, gt=0)
    rate_limit_window_seconds: float = Field(default=60, gt=0)
    domain_interval_seconds: float = Field(default=1, ge=0)

    @property
    def parsed_cors_origins(self) -> tuple[str, ...]:
        return tuple(
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
