import pytest

TEST_PROXY_TOKEN_SECRET = "0123456789abcdef0123456789abcdef"


@pytest.fixture(autouse=True)
def proxy_token_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("API_PROXY_TOKEN_SECRET", TEST_PROXY_TOKEN_SECRET)
