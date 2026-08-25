"""Print imposition: logical document -> output pages (normal or booklet).

Renderers never see pageCount/parity/sheet order — they only draw OutputPage.
"""

from dataclasses import dataclass

from base6_techo.models import (
    ContentPage,
    DocumentPage,
    DocumentSettings,
    PaddingPage,
    PageSettings,
    RuledPattern,
)
from base6_techo.pages import PageDraw, render_page


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


@dataclass(frozen=True)
class BookletSide:
    left: DocumentPage
    right: DocumentPage


@dataclass(frozen=True)
class BookletSheet:
    front: BookletSide
    back: BookletSide


def logical_pages(doc: DocumentSettings) -> list[ContentPage]:
    return [ContentPage(i + 1) for i in range(doc.page_count)]


def pad_for_booklet(pages: list[ContentPage]) -> list[DocumentPage]:
    """Pad to a multiple of 4 with blank pages appended at the end (§54)."""
    target = -(-len(pages) // 4) * 4
    return [*pages, *(PaddingPage() for _ in range(target - len(pages)))]


def booklet_sheets(pages: list[DocumentPage]) -> list[BookletSheet]:
    """Classic saddle stitch: front = high|low, back = low+1|high-1 (§24)."""
    sheets: list[BookletSheet] = []
    low, high = 0, len(pages) - 1
    while low < high:
        sheets.append(
            BookletSheet(
                front=BookletSide(left=pages[high], right=pages[low]),
                back=BookletSide(left=pages[low + 1], right=pages[high - 1]),
            )
        )
        low += 2
        high -= 2
    return sheets


def normal_output(
    page: PageSettings, pattern: RuledPattern, doc: DocumentSettings
) -> list[OutputPage]:
    """1 logical page = 1 PDF page, original order."""
    return [
        OutputPage(
            page.width,
            page.height,
            [Placement(0, render_page(page, pattern, p, doc.show_page_number))],
        )
        for p in logical_pages(doc)
    ]


def booklet_output(
    page: PageSettings, pattern: RuledPattern, doc: DocumentSettings
) -> list[OutputPage]:
    """Each sheet side = one 2W×H PDF page, front then back."""
    padded = pad_for_booklet(logical_pages(doc))

    def side(side_: BookletSide) -> OutputPage:
        return OutputPage(
            page.width * 2,
            page.height,
            [
                Placement(
                    0, render_page(page, pattern, side_.left, doc.show_page_number)
                ),
                Placement(
                    page.width,
                    render_page(page, pattern, side_.right, doc.show_page_number),
                ),
            ],
        )

    return [
        out
        for sheet in booklet_sheets(padded)
        for out in (side(sheet.front), side(sheet.back))
    ]


def booklet_summary(doc: DocumentSettings) -> tuple[int, int, int, int]:
    """(padded pages, padding added, sheets, printed sides)."""
    padded = -(-doc.page_count // 4) * 4
    sheets = padded // 4
    return padded, padded - doc.page_count, sheets, sheets * 2
