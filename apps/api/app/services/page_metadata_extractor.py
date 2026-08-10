from __future__ import annotations

from bs4 import BeautifulSoup, Tag

MAX_PAGE_TITLE_LENGTH = 200


def extract_page_title(html: str) -> str | None:
    soup = BeautifulSoup(html, "html.parser")
    title = soup.find("title")
    if not isinstance(title, Tag):
        return None

    normalized = " ".join(title.get_text(" ", strip=True).split())
    if not normalized:
        return None
    return normalized[:MAX_PAGE_TITLE_LENGTH]
