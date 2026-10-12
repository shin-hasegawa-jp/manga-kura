from pathlib import Path

import pytest
from pydantic import ValidationError

from app.config import Settings


def test_environment_variables_override_defaults(monkeypatch) -> None:
    monkeypatch.setenv("API_APP_NAME", "テストAPI")
    monkeypatch.setenv(
        "API_CORS_ORIGINS", "http://localhost:5173, http://127.0.0.1:4173"
    )

    settings = Settings()

    assert settings.app_name == "テストAPI"
    assert settings.parsed_cors_origins == (
        "http://localhost:5173",
        "http://127.0.0.1:4173",
    )


@pytest.mark.parametrize(
    "secret",
    [
        "local-development-only-change-me",
        "replace-with-a-long-random-secret",
        "short-secret",
        "   ",
    ],
)
def test_insecure_proxy_token_secret_is_rejected(
    monkeypatch: pytest.MonkeyPatch,
    secret: str,
) -> None:
    monkeypatch.setenv("API_PROXY_TOKEN_SECRET", secret)

    with pytest.raises(ValidationError, match="API_PROXY_TOKEN_SECRET"):
        Settings()


def test_missing_proxy_token_secret_is_rejected(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.delenv("API_PROXY_TOKEN_SECRET", raising=False)
    monkeypatch.chdir(tmp_path)

    with pytest.raises(ValidationError, match="API_PROXY_TOKEN_SECRET"):
        Settings()
