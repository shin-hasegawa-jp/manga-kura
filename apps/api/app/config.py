from functools import lru_cache

from pydantic import Field
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

    @property
    def parsed_cors_origins(self) -> tuple[str, ...]:
        return tuple(
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
