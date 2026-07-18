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
