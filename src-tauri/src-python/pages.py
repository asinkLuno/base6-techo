"""Logical page renderer: geometry + pattern + optional page number -> PageDraw.

PageDraw is pure mm geometry; imposition only moves these finished pages.
"""

from dataclasses import dataclass
from datetime import date

from babel.dates import format_date
from layout import geometry_for
from template.basic import BasicPattern, Dot, Line
from template.basic import draw as draw_basic
from template.midori import MidoriPattern
from template.midori import draw as draw_midori
from template.timeline import TimelinePattern
from template.timeline import draw as draw_timeline

Pattern = BasicPattern | MidoriPattern | TimelinePattern
from models import ContentPage, PageSettings

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


def render_page(
    page: PageSettings,
    pattern: Pattern,
    doc_page: ContentPage,
    show_page_number: bool,
    binding_text: str | None = None,
    binding_text_2: str | None = None,
    binding_text_size: float = 8,
    binding_text_2_size: float = 8,
    binding_text_spacing: float = 5,
    page_number_font: str = r"\sffamily",
    binding_text_font: str = r"\sffamily",
    header_dates: tuple[date, ...] | None = None,
    header_date_format: str | None = None,
    header_date_locale: str = "zh_CN",
    header_parity: str = "both",
    header_date_size: float = 8,
    header_date_font: str | None = None,
    header_date_position: str = "center",
    printed_page_number: int | None = None,
    header_index: int | None = None,
    show_header: bool = True,
) -> PageDraw:
    """Render one complete logical page. Page numbers and binding text belong to
    the logical page (drawn here, before imposition)."""
    if isinstance(doc_page, ContentPage):
        geo = geometry_for(page, doc_page.page_number)
        idx = doc_page.page_number - 1 if header_index is None else header_index
        page_date = (
            header_dates[idx]
            if header_dates is not None and 0 <= idx < len(header_dates)
            else None
        )
        if isinstance(pattern, TimelinePattern):
            lines, dots, texts = draw_timeline(geo, pattern, page_date)
        else:
            if isinstance(pattern, MidoriPattern):
                lines, dots = draw_midori(geo, pattern)
            else:
                lines, dots = draw_basic(geo, pattern)
            texts = (
                [
                    Text(
                        page.width / 2,
                        page.height - page.footer / 2,
                        str(printed_page_number or doc_page.page_number),
                        font=page_number_font,
                    )
                ]
                if show_page_number
                else []
            )
        # Header date (dates are already expanded to one entry per page)
        if show_header and header_dates is not None and header_date_format is not None:
            show_header = (
                header_parity == "both"
                or (header_parity == "odd" and doc_page.page_number % 2 == 1)
                or (header_parity == "even" and doc_page.page_number % 2 == 0)
            )
            if show_header and 0 <= idx < len(header_dates):
                date_str = format_date(
                    header_dates[idx], header_date_format, locale=header_date_locale
                )
                if header_date_position == "binding":
                    x = (
                        page.binding / 2
                        if geo.binding_side == "left"
                        else page.width - page.binding / 2
                    )
                    anchor = "west" if geo.binding_side == "left" else "east"
                elif header_date_position == "outer":
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
                        size_pt=header_date_size,
                        font=header_date_font or page_number_font,
                        anchor=anchor,
                    )
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
