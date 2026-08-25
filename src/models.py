"""Data model: page / document / print settings.

All user-facing lengths are in mm; font size is in pt.
"""

from dataclasses import dataclass

PAGE_PRESETS: dict[str, tuple[float, float]] = {
    "A3": (297, 420),
    "A4": (210, 297),
    "A5": (148, 210),
    "A6": (105, 148),
    "B5": (176, 250),
    "B6": (125, 176),
    "Letter": (215.9, 279.4),
}

MIN_FOOTER_FOR_PAGE_NUMBER = 5  # mm
MAX_PAGE_COUNT = 500


@dataclass(frozen=True)
class PageSettings:
    """Physical page and reserved areas, all in mm."""

    width: float
    height: float
    header: float = 10
    footer: float = 10
    binding: float = 15
    non_binding: float = 8

    def __post_init__(self) -> None:
        if self.width <= 0 or self.height <= 0:
            raise ValueError("width and height must be > 0")
        for name, v in (
            ("header", self.header),
            ("footer", self.footer),
            ("binding", self.binding),
            ("non_binding", self.non_binding),
        ):
            if v < 0:
                raise ValueError(f"{name} must be >= 0")
        if self.binding + self.non_binding >= self.width:
            raise ValueError("binding + non_binding must be < width")
        if self.header + self.footer >= self.height:
            raise ValueError("header + footer must be < height")


@dataclass(frozen=True)
class DocumentSettings:
    """Whole-notebook settings. page_count = finished usable pages, never sheet count."""

    page_count: int = 32
    show_page_number: bool = True
    binding_text: str | None = None
    binding_text_2: str | None = None
    binding_text_size: float = 8
    binding_text_2_size: float = 8
    binding_text_spacing: float = 5
    page_number_font: str = r"\sffamily"
    binding_text_font: str = r"\sffamily"

    def __post_init__(self) -> None:
        if not 1 <= self.page_count <= MAX_PAGE_COUNT:
            raise ValueError(f"page_count must be in 1..{MAX_PAGE_COUNT}")
        for name, v in (
            ("binding_text_size", self.binding_text_size),
            ("binding_text_2_size", self.binding_text_2_size),
        ):
            if v <= 0:
                raise ValueError(f"{name} must be > 0")
        if self.binding_text_spacing < 0:
            raise ValueError("binding_text_spacing must be >= 0")
        if not self.page_number_font.strip() or not self.binding_text_font.strip():
            raise ValueError("font declarations must not be empty")


def validate_project(page: PageSettings, doc: DocumentSettings) -> None:
    if doc.show_page_number and page.footer < MIN_FOOTER_FOR_PAGE_NUMBER:
        raise ValueError(
            f"页脚高度不足（{page.footer}mm < {MIN_FOOTER_FOR_PAGE_NUMBER}mm），无法打印页码"
        )


@dataclass(frozen=True)
class ContentPage:
    page_number: int


@dataclass(frozen=True)
class PaddingPage:
    """Auto-added blank page to reach a multiple of 4; never shows a page number."""


DocumentPage = ContentPage | PaddingPage
