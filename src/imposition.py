"""Print imposition: logical document -> output pages (normal only).

Blank padding and booklet/thread imposition operate on finished PDFs via
the `blank` and `impose` commands (src/pdfops.py).
"""

from dataclasses import dataclass

from src.models import ContentPage, DocumentSettings, PageSettings
from src.pages import PageDraw, Pattern, render_page


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
    page: PageSettings, pattern: Pattern, doc: DocumentSettings
) -> list[OutputPage]:
    """1 logical page = 1 PDF page, original order."""
    return [
        OutputPage(
            page.width,
            page.height,
            [
                Placement(
                    0,
                    render_page(
                        page,
                        pattern,
                        ContentPage(i + 1),
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
                    ),
                )
            ],
        )
        for i in range(doc.page_count)
    ]
