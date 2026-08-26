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
    binding_text: str | None = None,
    binding_text_2: str | None = None,
    binding_text_size: float = 8,
    binding_text_2_size: float = 8,
    binding_text_spacing: float = 5,
    binding_text_font: str = r"\sffamily",
    header_dates: tuple[date, ...] | None = None,
    header_date_format: str | None = None,
    header_date_locale: str = "zh_CN",
    header_parity: str = "both",
    header_date_size: float = 8,
    header_date_font: str | None = None,
    header_date_position: str = "center",
    header_index: int | None = None,
    show_header: bool = True,
    header_text: str | None = None,
    header_text_2: str | None = None,
    header_text_size: float = 8,
    header_text_2_size: float = 8,
    header_text_spacing: float = 5,
    non_binding_text: str | None = None,
    non_binding_text_2: str | None = None,
    non_binding_text_size: float = 8,
    non_binding_text_2_size: float = 8,
    non_binding_text_spacing: float = 5,
    footer_text: str | None = None,
    footer_text_2: str | None = None,
    footer_text_size: float = 8,
    footer_text_2_size: float = 8,
    footer_text_spacing: float = 5,
) -> PageDraw:
    """Render one complete logical page. Footer and binding text belong to
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
            texts = []
        # Header date (dates are already expanded to one entry per page)
        if show_header and header_dates is not None and header_date_format is not None:
            header_page_number = idx + 1
            show_header = (
                header_parity == "both"
                or (header_parity == "odd" and header_page_number % 2 == 1)
                or (header_parity == "even" and header_page_number % 2 == 0)
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
                        font=header_date_font or r"\sffamily",
                        anchor=anchor,
                    )
                )
        binding_lines = [
            (binding_text, binding_text_size),
            (binding_text_2, binding_text_2_size),
        ]
        visible_lines = [(content, size) for content, size in binding_lines if content]
        if visible_lines:
            offset = (len(visible_lines) - 1) * binding_text_spacing / 2

            # Binding side (vertical): drawn whenever binding text is set
            center_x = (
                page.binding / 2
                if geo.binding_side == "left"
                else page.width - page.binding / 2
            )
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

        # Non-binding side (vertical), own text lines
        non_binding_lines = [
            (non_binding_text, non_binding_text_size),
            (non_binding_text_2, non_binding_text_2_size),
        ]
        nb_visible = [(content, size) for content, size in non_binding_lines if content]
        if nb_visible:
            nb_offset = (len(nb_visible) - 1) * non_binding_text_spacing / 2
            center_x = (
                page.non_binding / 2
                if geo.binding_side == "left"
                else page.width - page.non_binding / 2
            )
            direction = -1 if geo.binding_side == "left" else 1
            for index, (content, size) in enumerate(nb_visible):
                texts.append(
                    Text(
                        center_x + direction * (index * non_binding_text_spacing - nb_offset),
                        page.height / 2,
                        content,
                        size_pt=size,
                        rotation=90,
                        font=binding_text_font,
                    )
                )

        # Header text (horizontal), own text lines
        header_lines = [
            (header_text, header_text_size),
            (header_text_2, header_text_2_size),
        ]
        h_visible = [(content, size) for content, size in header_lines if content]
        if h_visible:
            h_offset = (len(h_visible) - 1) * header_text_spacing / 2
            center_y = page.header / 2
            for index, (content, size) in enumerate(h_visible):
                texts.append(
                    Text(
                        page.width / 2,
                        center_y - h_offset + index * header_text_spacing,
                        content,
                        size_pt=size,
                        font=binding_text_font,
                        anchor="center",
                    )
                )

        # Footer text (horizontal)
        footer_lines = [
            (footer_text, footer_text_size),
            (footer_text_2, footer_text_2_size),
        ]
        f_visible = [(content, size) for content, size in footer_lines if content]
        if f_visible:
            f_offset = (len(f_visible) - 1) * footer_text_spacing / 2
            center_y = page.height - page.footer / 2
            for index, (content, size) in enumerate(f_visible):
                texts.append(
                    Text(
                        page.width / 2,
                        center_y - f_offset + index * footer_text_spacing,
                        content,
                        size_pt=size,
                        font=binding_text_font,
                        anchor="center",
                    )
                )
    return PageDraw(lines, texts, dots)
