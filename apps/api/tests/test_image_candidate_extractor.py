import pytest

from app.services.image_candidate_extractor import (
    ImageCandidate,
    extract_image_candidates,
    select_best_source_from_srcset,
)

PAGE_URL = "https://example.com/comic/episode/1"


def test_image_input_sources_are_extracted_in_dom_order() -> None:
    html = """
      <input type="image" src="/images/page-01.jpg">
      <img src="/images/page-02.jpg">
      <input type="IMAGE" src="/images/page-03.jpg">
      <input type="text" src="/images/not-image.jpg">
    """

    assert tuple(
        candidate.image_url for candidate in extract_image_candidates(html, PAGE_URL)
    ) == (
        "https://example.com/images/page-01.jpg",
        "https://example.com/images/page-02.jpg",
        "https://example.com/images/page-03.jpg",
    )


def test_images_are_extracted_in_dom_order_with_unique_ids() -> None:
    html = """
      <img src="/images/page-01.jpg">
      <section><img src="https://cdn.example.com/page-02.jpg"></section>
      <img src="//cdn.example.com/page-03.jpg">
    """

    assert extract_image_candidates(html, PAGE_URL) == (
        ImageCandidate(
            "image-candidate-0",
            0,
            "https://example.com/images/page-01.jpg",
            "src",
            "image-parent-0",
        ),
        ImageCandidate(
            "image-candidate-1",
            1,
            "https://cdn.example.com/page-02.jpg",
            "src",
            "image-parent-1",
        ),
        ImageCandidate(
            "image-candidate-2",
            2,
            "https://cdn.example.com/page-03.jpg",
            "src",
            "image-parent-0",
        ),
    )


def test_missing_empty_and_duplicate_sources_are_excluded() -> None:
    html = """
      <img alt="missing">
      <img src="">
      <img src="   ">
      <img src=" /images/page.jpg ">
      <img data-original="/images/page.jpg" src="placeholder.gif">
    """

    assert extract_image_candidates(html, PAGE_URL) == (
        ImageCandidate(
            "image-candidate-0",
            0,
            "https://example.com/images/page.jpg",
            "src",
            "image-parent-0",
        ),
    )


@pytest.mark.parametrize(
    ("attribute", "source"),
    [
        ("data-src", "/images/data-src.jpg"),
        ("data-original", "/images/data-original.jpg"),
        ("data-lazy-src", "/images/data-lazy-src.jpg"),
        ("data-original-src", "/images/data-original-src.jpg"),
        ("data-lazy", "/images/data-lazy.jpg"),
    ],
)
def test_lazy_load_attributes_are_supported(attribute: str, source: str) -> None:
    candidates = extract_image_candidates(f'<img {attribute}="{source}">', PAGE_URL)

    assert candidates[0].source_attribute == attribute
    assert candidates[0].image_url == f"https://example.com{source}"


def test_attribute_priority_matches_frontend() -> None:
    html = """
      <img
        src="placeholder.gif"
        data-lazy="/images/data-lazy.jpg"
        data-original-src="/images/data-original-src.jpg"
        data-lazy-src="/images/data-lazy-src.jpg"
        data-original="/images/data-original.jpg"
        data-src="/images/data-src.jpg"
        srcset="/images/srcset.jpg 2x"
        data-srcset="/images/lazy-640.jpg 640w, /images/lazy-1280.jpg 1280w"
      >
    """

    assert extract_image_candidates(html, PAGE_URL)[0].source_attribute == "data-srcset"
    assert extract_image_candidates(html, PAGE_URL)[0].image_url.endswith(
        "/lazy-1280.jpg"
    )


@pytest.mark.parametrize(
    ("srcset", "expected"),
    [
        ("/320.jpg 320w, /1280.jpg 1280w, /640.jpg 640w", "/1280.jpg"),
        ("/page.jpg 1x, /page@3x.jpg 3x, /page@2x.jpg 2x", "/page@3x.jpg"),
        ("/page.jpg, /page@2x.jpg 2x", "/page@2x.jpg"),
        ("", None),
        (" , , ", None),
        ("/page.jpg 0w", None),
        ("/page.jpg 0x", None),
        ("/page.jpg invalid", None),
        ("/small.jpg 320w, /large.jpg 2x", None),
    ],
)
def test_srcset_selection_matches_frontend(srcset: str, expected: str | None) -> None:
    assert select_best_source_from_srcset(srcset) == expected


def test_invalid_srcset_falls_back_to_next_attribute() -> None:
    html = """
      <img data-srcset="/images/page.jpg invalid" data-src="/images/fallback.jpg">
    """

    candidate = extract_image_candidates(html, PAGE_URL)[0]

    assert candidate.source_attribute == "data-src"
    assert candidate.image_url == "https://example.com/images/fallback.jpg"


def test_relative_query_absolute_and_protocol_relative_urls_match_frontend() -> None:
    html = """
      <img src="//cdn.example.com/images/protocol.jpg">
      <img src="/images/root.jpg">
      <img src="images/path.jpg">
      <img src="?image=queried">
      <img src="https://static.example.com/images/absolute.jpg">
    """

    assert tuple(
        candidate.image_url for candidate in extract_image_candidates(html, PAGE_URL)
    ) == (
        "https://cdn.example.com/images/protocol.jpg",
        "https://example.com/images/root.jpg",
        "https://example.com/comic/episode/images/path.jpg",
        "https://example.com/comic/episode/1?image=queried",
        "https://static.example.com/images/absolute.jpg",
    )


def test_first_valid_base_element_is_used() -> None:
    html = """
      <base href="https://assets.example.com/comics/series-a/">
      <base href="https://ignored.example.com/">
      <img src="pages/01.jpg">
      <img src="/shared/cover.jpg">
    """

    assert tuple(
        candidate.image_url for candidate in extract_image_candidates(html, PAGE_URL)
    ) == (
        "https://assets.example.com/comics/series-a/pages/01.jpg",
        "https://assets.example.com/shared/cover.jpg",
    )


@pytest.mark.parametrize(
    "base_element",
    [
        '<base href="http://[invalid">',
        '<base href="data:text/plain,invalid">',
        '<base href="">',
    ],
)
def test_invalid_base_falls_back_to_page_url(base_element: str) -> None:
    candidates = extract_image_candidates(
        f'{base_element}<img src="images/page.jpg">', PAGE_URL
    )

    assert (
        candidates[0].image_url == "https://example.com/comic/episode/images/page.jpg"
    )


def test_non_http_and_unresolvable_urls_are_excluded() -> None:
    html = """
      <img src="http://[invalid">
      <img src="data:image/png;base64,placeholder">
      <img src="blob:https://example.com/id">
      <img src="file:///images/page.jpg">
      <img src="javascript:alert(1)">
      <img src="https://example.com/images/valid.jpg">
    """

    assert extract_image_candidates(html, PAGE_URL) == (
        ImageCandidate(
            "image-candidate-0",
            0,
            "https://example.com/images/valid.jpg",
            "src",
            "image-parent-0",
        ),
    )


def test_duplicates_after_url_resolution_keep_first_candidate() -> None:
    html = """
      <img src="/images/page.jpg">
      <img data-src="https://example.com/images/page.jpg">
      <img src="../images/page.jpg">
    """

    assert extract_image_candidates(html, "https://example.com/comic/1") == (
        ImageCandidate(
            "image-candidate-0",
            0,
            "https://example.com/images/page.jpg",
            "src",
            "image-parent-0",
        ),
    )


def test_malformed_html_fragment_is_parsed() -> None:
    html = '<main><img src="/1.jpg"><div><img src="/2.jpg">'

    assert tuple(
        candidate.image_url for candidate in extract_image_candidates(html, PAGE_URL)
    ) == (
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
    )


def test_same_direct_parent_uses_same_group_id() -> None:
    candidates = extract_image_candidates(
        """
        <main>
          <img src="/1.jpg">
          <img src="/2.jpg">
        </main>
        <aside><img src="/advert.jpg"></aside>
        """,
        PAGE_URL,
    )

    assert candidates[0].parent_group_id == candidates[1].parent_group_id
    assert candidates[0].parent_group_id != candidates[2].parent_group_id


def test_nested_images_use_their_direct_parent() -> None:
    candidates = extract_image_candidates(
        """
        <main>
          <figure><img src="/1.jpg"></figure>
          <figure><img src="/2.jpg"></figure>
        </main>
        """,
        PAGE_URL,
    )

    assert candidates[0].parent_group_id != candidates[1].parent_group_id


def test_common_css_classes_are_extracted_without_duplicates() -> None:
    candidates = extract_image_candidates(
        """
        <img class="comic-page lazy comic-page" src="/1.jpg">
        <img class="comic-page" src="/2.jpg">
        <img src="/3.jpg">
        """,
        PAGE_URL,
    )

    assert candidates[0].css_classes == ("comic-page", "lazy")
    assert candidates[1].css_classes == ("comic-page",)
    assert candidates[2].css_classes == ()


def test_css_classes_are_bounded_and_invalid_values_are_ignored() -> None:
    classes = " ".join([f"class-{index}" for index in range(10)])
    candidate = extract_image_candidates(
        f'<img class="{classes} 日本語" src="/1.jpg">', PAGE_URL
    )[0]

    assert candidate.css_classes == tuple(f"class-{index}" for index in range(8))


def test_lazy_loaded_image_keeps_dom_group_information() -> None:
    candidates = extract_image_candidates(
        """
        <div>
          <img class="comic-page" data-src="/1.jpg">
          <img class="comic-page" data-original="/2.jpg">
        </div>
        """,
        PAGE_URL,
    )

    assert candidates[0].parent_group_id == candidates[1].parent_group_id
    assert candidates[0].css_classes == ("comic-page",)
