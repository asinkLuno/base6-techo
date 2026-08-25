"""Print imposition: logical document -> output pages.

Renderers never see pageCount/parity/sheet order - they only draw OutputPage.
"""

from dataclasses import dataclass

from src.models import (
    ContentPage,
    DocumentPage,
    DocumentSettings,
    PaddingPage,
    PageSettings,
)
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


def pad_for_thread(
    pages: list[ContentPage], sheets_per_group: int
) -> list[DocumentPage]:
    """Pad to complete thread-bound groups of ``sheets_per_group`` sheets."""
    if sheets_per_group < 1:
        raise ValueError("sheets_per_group must be >= 1")
    group_size = sheets_per_group * 4
    target = -(-len(pages) // group_size) * group_size
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


def thread_sheets(
    pages: list[DocumentPage], sheets_per_group: int
) -> list[BookletSheet]:
    """Impose each thread-bound group independently as a folded signature."""
    if sheets_per_group < 1:
        raise ValueError("sheets_per_group must be >= 1")
    group_size = sheets_per_group * 4
    if len(pages) % group_size:
        raise ValueError("pages must be padded to a complete thread group")
    return [
        sheet
        for start in range(0, len(pages), group_size)
        for sheet in booklet_sheets(pages[start : start + group_size])
    ]


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
                        p,
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
                    ),
                )
            ],
        )
        for p in logical_pages(doc)
    ]


def _two_up_output(
    page: PageSettings,
    pattern: Pattern,
    sheets: list[BookletSheet],
    doc: DocumentSettings,
) -> list[OutputPage]:
    def side(side_: BookletSide) -> OutputPage:
        return OutputPage(
            page.width * 2,
            page.height,
            [
                Placement(
                    0,
                    render_page(
                        page,
                        pattern,
                        side_.left,
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
                    ),
                ),
                Placement(
                    page.width,
                    render_page(
                        page,
                        pattern,
                        side_.right,
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
                    ),
                ),
            ],
        )

    return [out for sheet in sheets for out in (side(sheet.front), side(sheet.back))]


def booklet_output(
    page: PageSettings, pattern: Pattern, doc: DocumentSettings
) -> list[OutputPage]:
    """Each sheet side = one 2W×H PDF page, front then back."""
    padded = pad_for_booklet(logical_pages(doc))
    return _two_up_output(page, pattern, booklet_sheets(padded), doc)


def thread_output(
    page: PageSettings,
    pattern: Pattern,
    doc: DocumentSettings,
    sheets_per_group: int,
) -> list[OutputPage]:
    """Each thread-bound group is imposed separately, two-up, front then back."""
    padded = pad_for_thread(logical_pages(doc), sheets_per_group)
    return _two_up_output(page, pattern, thread_sheets(padded, sheets_per_group), doc)


def booklet_summary(doc: DocumentSettings) -> tuple[int, int, int, int]:
    """(padded pages, padding added, sheets, printed sides)."""
    padded = -(-doc.page_count // 4) * 4
    sheets = padded // 4
    return padded, padded - doc.page_count, sheets, sheets * 2


def thread_summary(
    doc: DocumentSettings, sheets_per_group: int
) -> tuple[int, int, int, int]:
    """(padded pages, padding added, sheets, printed sides) for thread groups."""
    if sheets_per_group < 1:
        raise ValueError("sheets_per_group must be >= 1")
    group_size = sheets_per_group * 4
    padded = -(-doc.page_count // group_size) * group_size
    sheets = padded // 4
    return padded, padded - doc.page_count, sheets, sheets * 2
