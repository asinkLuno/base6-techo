"""PDF post-processing: merge, blank padding, booklet/thread imposition.

Operates on finished PDFs (page headers/footers already rendered), not LaTeX.
"""

from pathlib import Path

from pypdf import PdfReader, PdfWriter, Transformation


def merge_pdfs(inputs: list[Path], out: Path) -> int:
    """Concatenate PDFs in order; returns the total page count."""
    writer = PdfWriter()
    for path in inputs:
        writer.append(PdfReader(path))
    with out.open("wb") as f:
        writer.write(f)
    return len(writer.pages)


def blank_pdf(src: Path, out: Path, leading: int = 0, trailing: int = 0) -> int:
    """Insert blank pages before/after the existing pages; returns page count."""
    if leading < 0 or trailing < 0:
        raise ValueError("leading and trailing must be >= 0")
    reader = PdfReader(src)
    writer = PdfWriter()
    if reader.pages:
        w, h = reader.pages[0].mediabox.width, reader.pages[0].mediabox.height
    else:
        w = h = 595.276  # A4 pt; empty input still yields usable blank pages
    for _ in range(leading):
        writer.add_blank_page(width=w, height=h)
    writer.append(reader)
    for _ in range(trailing):
        writer.add_blank_page(width=w, height=h)
    with out.open("wb") as f:
        writer.write(f)
    return len(writer.pages)


def booklet_pairs(n: int) -> list[tuple[tuple[int, int], tuple[int, int]]]:
    """Saddle-stitch (front, back) page-index pairs for ``n`` logical pages.

    Front sheet = high|low, back = low+1|high-1, repeated inward.
    """
    pairs: list[tuple[tuple[int, int], tuple[int, int]]] = []
    low, high = 0, n - 1
    while low < high:
        pairs.append(((high, low), (low + 1, high - 1)))
        low += 2
        high -= 2
    return pairs


def impose_pdf(
    src: Path,
    out: Path,
    mode: str = "booklet",
    sheets_per_group: int = 4,
) -> int:
    """Reimpose a PDF: pad to complete signatures, then place two logical
    pages per sheet side (2W×H). Returns the number of paper sheets.
    """
    if mode not in ("booklet", "thread"):
        raise ValueError("mode must be booklet or thread")
    if sheets_per_group < 1:
        raise ValueError("sheets_per_group must be >= 1")
    reader = PdfReader(src)
    n = len(reader.pages)
    w = reader.pages[0].mediabox.width
    h = reader.pages[0].mediabox.height
    pages: list = list(reader.pages)

    writer = PdfWriter()
    if mode == "booklet":
        target = -(-n // 4) * 4
        pages += [None] * (target - n)
        pairs = booklet_pairs(target)
        for front, back in pairs:
            _emit_sheet(writer, pages[front[0]], pages[front[1]], w, h)
            _emit_sheet(writer, pages[back[0]], pages[back[1]], w, h)
        sheet_count = len(pairs)
    else:
        stride = sheets_per_group * 4
        target = -(-n // stride) * stride
        pages += [None] * (target - n)
        sheet_count = 0
        for start in range(0, target, stride):
            for front, back in booklet_pairs(stride):
                _emit_sheet(
                    writer, pages[start + front[0]], pages[start + front[1]], w, h
                )
                _emit_sheet(
                    writer, pages[start + back[0]], pages[start + back[1]], w, h
                )
                sheet_count += 1
    with out.open("wb") as f:
        writer.write(f)
    return sheet_count


def _emit_sheet(writer: PdfWriter, left, right, w: float, h: float) -> None:
    sheet = writer.add_blank_page(width=w * 2, height=h)
    if left is not None:
        sheet.merge_page(left, over=True)
    if right is not None:
        sheet.merge_transformed_page(right, Transformation().translate(w, 0), over=True)
