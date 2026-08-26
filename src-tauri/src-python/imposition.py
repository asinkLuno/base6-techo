"""Logical document -> normal or imposed output pages."""

from dataclasses import dataclass, replace

from models import ContentPage, DocumentSettings, PageSettings
from pages import PageDraw, Pattern, render_page


@dataclass(frozen=True)
class Placement:
    dx: float  # mm offset added to a finished PageDraw
    draw: PageDraw


@dataclass(frozen=True)
class OutputPage:
    """One PDF page: final print size + the logical pages placed on it."""

    width: float
    height: float
    placements: list[Placement]


def normal_output(
    page: PageSettings,
    pattern: Pattern,
    doc: DocumentSettings,
    page_number_start: int = 1,
    physical_page_start: int = 1,
) -> list[OutputPage]:
    """1 logical page = 1 PDF page, original order."""
    return [
        OutputPage(
            page.width,
            page.height,
            [
                Placement(
                    0,
                    _resolve_style(
                        render_page(
                            page,
                            pattern,
                            ContentPage(physical_page_start + i),
                            doc.show_page_number,
                            doc.binding_text,
                            doc.binding_text_2,
                            doc.binding_text_size,
                            doc.binding_text_2_size,
                            doc.binding_text_spacing,
                            doc.page_number_font,
                            doc.binding_text_font,
                            doc.header_dates,
                            doc.header_date_format,
                            doc.header_date_locale,
                            doc.header_parity,
                            doc.header_date_size,
                            doc.header_date_font,
                            doc.header_date_position,
                            page_number_start + i,
                            i,
                            doc.show_header,
                        ),
                        pattern,
                    ),
                )
            ],
        )
        for i in range(doc.page_count)
    ]


def _resolve_style(draw: PageDraw, pattern: Pattern) -> PageDraw:
    """Freeze pattern defaults before pages from different sections are mixed."""
    return PageDraw(
        [
            replace(
                line,
                color=line.color or pattern.line_color,
                width=pattern.line_width if line.width is None else line.width,
            )
            for line in draw.lines
        ],
        draw.texts,
        [replace(dot, color=dot.color or pattern.line_color) for dot in draw.dots],
    )


def impose_output(
    pages: list[OutputPage], mode: str, sheets_per_group: int = 4
) -> tuple[list[OutputPage], int]:
    """Pad and impose same-sized logical pages for booklet/thread printing."""
    if not pages:
        return [], 0
    width, height = pages[0].width, pages[0].height
    if any((p.width, p.height) != (width, height) for p in pages):
        raise ValueError("all pages must use the same physical page size")
    stride = 4 if mode == "booklet" else sheets_per_group * 4
    padded: list[OutputPage | None] = [*pages]
    padded += [None] * (-len(padded) % stride)
    output: list[OutputPage] = []
    for start in range(0, len(padded), stride):
        for sheet in range(stride // 4):
            end = start + stride - 1
            left = start + sheet * 2
            right = left + 1
            for a, b in ((end - sheet * 2, left), (right, end - sheet * 2 - 1)):
                placements = []
                if padded[a] is not None:
                    placements.extend(padded[a].placements)
                if padded[b] is not None:
                    placements.extend(
                        Placement(width + p.dx, p.draw) for p in padded[b].placements
                    )
                output.append(OutputPage(width * 2, height, placements))
    return output, len(padded) // 4
