from app.services.page_metadata_extractor import (
    MAX_PAGE_TITLE_LENGTH,
    extract_page_title,
)


def test_page_title_is_extracted_and_whitespace_is_normalized() -> None:
    assert extract_page_title("<title>  漫画蔵\n  第12話  </title>") == "漫画蔵 第12話"


def test_html_entities_are_decoded() -> None:
    assert extract_page_title("<title>作品名 &amp; 第1話</title>") == "作品名 & 第1話"


def test_missing_or_empty_title_returns_none() -> None:
    assert extract_page_title("<main>titleなし</main>") is None
    assert extract_page_title("<title> \n </title>") is None


def test_long_title_is_truncated_to_the_response_limit() -> None:
    title = "漫" * (MAX_PAGE_TITLE_LENGTH + 10)

    assert extract_page_title(f"<title>{title}</title>") == "漫" * MAX_PAGE_TITLE_LENGTH
