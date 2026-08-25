"""Logical page renderer: geometry + pattern + optional page number -> PageDraw.

PageDraw is pure mm geometry; imposition only moves these finished pages.
"""

from dataclasses import dataclass

from src.basic import BasicPattern, Dot, Line, draw
from src.layout import geometry_for
from src.models import ContentPage, DocumentPage, PageSettings

PAGE_NUMBER_SIZE = 8  # pt
PAGE_NUMBER_COLOR = "#666666"


@dataclass(frozen=True)
class Text:
    x: float
    y: float
    content: str
    size_pt: float = PAGE_NUMBER_SIZE
    color: str = PAGE_NUMBER_COLOR
    rotation: int = 0
    font: str = r"\sffamily"


@dataclass(frozen=True)
class PageDraw:
    lines: list[Line]
    texts: list[Text]
    dots: list[Dot]


def render_page(
    page: PageSettings,
    pattern: BasicPattern,
    doc_page: DocumentPage,
    show_page_number: bool,
    binding_text: str | None = None,
    binding_text_2: str | None = None,
    binding_text_size: float = 8,
    binding_text_2_size: float = 8,
    binding_text_spacing: float = 5,
    page_number_font: str = r"\sffamily",
    binding_text_font: str = r"\sffamily",
) -> PageDraw:
    """Render one complete logical page. Page numbers and binding text belong to
    the logical page (drawn here, before imposition); padding pages stay blank."""
    if isinstance(doc_page, ContentPage):
        geo = geometry_for(page, doc_page.page_number)
        lines, dots = draw(geo, pattern)
        texts = (
            [
                Text(
                    page.width / 2,
                    page.height - page.footer / 2,
                    str(doc_page.page_number),
                    font=page_number_font,
                )
            ]
            if show_page_number
            else []
        )
        center_x = (
            page.binding / 2
            if geo.binding_side == "left"
            else page.width - page.binding / 2
        )
        binding_lines = [
            (binding_text, binding_text_size),
            (binding_text_2, binding_text_2_size),
        ]
        visible_lines = [(content, size) for content, size in binding_lines if content]
        offset = (len(visible_lines) - 1) * binding_text_spacing / 2
        direction = 1 if geo.binding_side == "left" else -1
        for index, (content, size) in enumerate(visible_lines):
            texts.append(
                Text(
                    center_x + direction * (index * binding_text_spacing - offset),
                    page.height / 2,
                    content,
                    size_pt=size,
                    rotation=90,
                    font=binding_text_font,
                )
            )
        return PageDraw(lines, texts, dots)
    return PageDraw([], [], [])
