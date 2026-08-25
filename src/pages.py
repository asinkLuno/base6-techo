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
) -> PageDraw:
    """Render one complete logical page. Page numbers belong to the logical page
    (drawn here, before imposition); padding pages stay completely blank."""
    if isinstance(doc_page, ContentPage):
        geo = geometry_for(page, doc_page.page_number)
        lines, dots = draw(geo, pattern)
        texts = (
            [
                Text(
                    page.width / 2,
                    page.height - page.footer / 2,
                    str(doc_page.page_number),
                )
            ]
            if show_page_number
            else []
        )
        return PageDraw(lines, texts, dots)
    return PageDraw([], [], [])
