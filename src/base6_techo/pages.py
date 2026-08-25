"""Logical page renderer: geometry + pattern + optional page number -> PageDraw.

PageDraw is pure mm geometry; imposition only moves these finished pages.
"""

import math
from dataclasses import dataclass

from base6_techo.layout import Rect, geometry_for, ruled_ys
from base6_techo.models import ContentPage, DocumentPage, PageSettings, RuledPattern

PAGE_NUMBER_SIZE = 8  # pt
PAGE_NUMBER_COLOR = "#666666"


@dataclass(frozen=True)
class Line:
    x1: float
    y1: float
    x2: float
    y2: float


@dataclass(frozen=True)
class Text:
    x: float
    y: float
    content: str
    size_pt: float = PAGE_NUMBER_SIZE
    color: str = PAGE_NUMBER_COLOR


@dataclass(frozen=True)
class Dot:
    x: float
    y: float
    radius: float  # mm


@dataclass(frozen=True)
class PageDraw:
    lines: list[Line]
    texts: list[Text]
    dots: list[Dot]


def dot_xs(content: Rect, spacing: float) -> list[float]:
    """X positions of dots on a line: first dot at the horizontal center of the
    content area, spreading left/right by spacing; symmetric edge gaps."""
    center = content.x + content.width / 2
    k = math.floor(content.width / 2 / spacing + 1e-9)
    return [center - i * spacing for i in range(k, 0, -1)] + [center + i * spacing for i in range(k + 1)]


def render_page(
    page: PageSettings,
    pattern: RuledPattern,
    doc_page: DocumentPage,
    show_page_number: bool,
) -> PageDraw:
    """Render one complete logical page. Page numbers belong to the logical page
    (drawn here, before imposition); padding pages stay completely blank."""
    if isinstance(doc_page, ContentPage):
        geo = geometry_for(page, doc_page.page_number)
        c = geo.content
        lines = [Line(c.x, y, c.x + c.width, y) for y in ruled_ys(geo, pattern.spacing)]
        dots = (
            [Dot(x, line.y1, pattern.dot_radius) for line in lines for x in dot_xs(c, pattern.dot_spacing)]
            if pattern.dot_spacing
            else []
        )
        texts = (
            [Text(page.width / 2, page.height - page.footer / 2, str(doc_page.page_number))]
            if show_page_number
            else []
        )
        return PageDraw(lines, texts, dots)
    return PageDraw([], [], [])
