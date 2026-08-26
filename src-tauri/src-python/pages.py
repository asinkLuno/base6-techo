"""Logical page renderer: geometry + pattern + optional margin text -> PageDraw.

PageDraw is pure mm geometry; imposition only moves these finished pages.
"""

from dataclasses import dataclass

from babel.dates import format_date
from layout import geometry_for
from template.basic import BasicPattern, Dot, Line
from template.basic import draw as draw_basic
from template.midori import MidoriPattern
from template.midori import draw as draw_midori
from template.timeline import TimelinePattern
from template.timeline import draw as draw_timeline

Pattern = BasicPattern | MidoriPattern | TimelinePattern
from models import ContentPage, DocumentSettings, PageSettings

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
    anchor: str = "center"


@dataclass(frozen=True)
class PageDraw:
    lines: list[Line]
    texts: list[Text]
    dots: list[Dot]


def _add_text_block(
    texts: list[Text],
    font: str,
    lines: list[tuple[str | None, float]],
    spacing: float,
    center_x: float,
    center_y: float,
    *,
    rotation: int = 0,
    direction: int = 1,
    stack_x: bool = False,
) -> None:
    """Stack the non-empty text lines symmetrically around the center point."""
    visible = [(content, size) for content, size in lines if content]
    if not visible:
        return
    offset = (len(visible) - 1) * spacing / 2
    for index, (content, size) in enumerate(visible):
        d = direction * (index * spacing - offset)
        texts.append(
            Text(
                center_x + d if stack_x else center_x,
                center_y if stack_x else center_y + d,
                content,
                size_pt=size,
                rotation=rotation,
                font=font,
            )
        )


def render_page(
    page: PageSettings,
    pattern: Pattern,
    doc_page: ContentPage,
    doc: DocumentSettings | None = None,
    header_index: int | None = None,
) -> PageDraw:
    """Render one complete logical page. Margin text belongs to the logical
    page (drawn here, before imposition)."""
    if doc is None:
        doc = DocumentSettings()
    geo = geometry_for(page, doc_page.page_number)
    idx = doc_page.page_number - 1 if header_index is None else header_index
    page_date = (
        doc.header_dates[idx]
        if doc.header_dates is not None and 0 <= idx < len(doc.header_dates)
        else None
    )
    if isinstance(pattern, TimelinePattern):
        lines, dots, texts = draw_timeline(geo, pattern, page_date, doc.binding_text_font)
    else:
        if isinstance(pattern, MidoriPattern):
            lines, dots = draw_midori(geo, pattern)
        else:
            lines, dots = draw_basic(geo, pattern)
        texts = []
    # Header date (dates are already expanded to one entry per page;
    # the text only shows on pages matching the parity; colors stay shared)
    if (
        doc.show_header
        and doc.header_dates is not None
        and doc.header_date_format is not None
        and 0 <= idx < len(doc.header_dates)
        and doc.header_dates[idx] is not None
    ):
        header_page_number = idx + 1
        if (
            doc.header_parity == "both"
            or (doc.header_parity == "odd" and header_page_number % 2 == 1)
            or (doc.header_parity == "even" and header_page_number % 2 == 0)
        ):
            date_str = format_date(
                doc.header_dates[idx],
                doc.header_date_format,
                locale=doc.header_date_locale,
            )
            if doc.header_date_position == "binding":
                x = (
                    page.binding / 2
                    if geo.binding_side == "left"
                    else page.width - page.binding / 2
                )
                anchor = "west" if geo.binding_side == "left" else "east"
            elif doc.header_date_position == "outer":
                x = (
                    page.width - page.non_binding / 2
                    if geo.binding_side == "left"
                    else page.non_binding / 2
                )
                anchor = "east" if geo.binding_side == "left" else "west"
            else:
                x = page.width / 2
                anchor = "center"
            texts.append(
                Text(
                    x,
                    page.header / 2,
                    date_str,
                    size_pt=doc.header_date_size,
                    font=doc.header_date_font or doc.binding_text_font,
                    anchor=anchor,
                )
            )
    _add_text_block(
        texts,
        doc.binding_text_font,
        [
            (doc.binding_text, doc.binding_text_size),
            (doc.binding_text_2, doc.binding_text_2_size),
        ],
        doc.binding_text_spacing,
        (
            doc.binding_text_edge
            if doc.binding_text_edge is not None
            else page.binding / 2
        )
        if geo.binding_side == "left"
        else page.width
        - (
            doc.binding_text_edge
            if doc.binding_text_edge is not None
            else page.binding / 2
        ),
        page.height / 2,
        rotation=90,
        direction=1 if geo.binding_side == "left" else -1,
        stack_x=True,
    )
    _add_text_block(
        texts,
        doc.binding_text_font,
        [
            (doc.non_binding_text, doc.non_binding_text_size),
            (doc.non_binding_text_2, doc.non_binding_text_2_size),
        ],
        doc.non_binding_text_spacing,
        (
            doc.non_binding_text_edge
            if doc.non_binding_text_edge is not None
            else page.non_binding / 2
        )
        if geo.binding_side == "left"
        else page.width
        - (
            doc.non_binding_text_edge
            if doc.non_binding_text_edge is not None
            else page.non_binding / 2
        ),
        page.height / 2,
        rotation=90,
        direction=-1 if geo.binding_side == "left" else 1,
        stack_x=True,
    )
    _add_text_block(
        texts,
        doc.binding_text_font,
        [
            (doc.header_text, doc.header_text_size),
            (doc.header_text_2, doc.header_text_2_size),
        ],
        doc.header_text_spacing,
        page.width / 2,
        page.header / 2,
    )
    _add_text_block(
        texts,
        doc.binding_text_font,
        [
            (doc.footer_text, doc.footer_text_size),
            (doc.footer_text_2, doc.footer_text_2_size),
        ],
        doc.footer_text_spacing,
        page.width / 2,
        page.height - page.footer / 2,
    )
    return PageDraw(lines, texts, dots)
