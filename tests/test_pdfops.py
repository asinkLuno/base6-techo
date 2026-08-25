from pathlib import Path

from pypdf import PdfReader, PdfWriter

from src.pdfops import blank_pdf, booklet_pairs, impose_pdf, merge_pdfs


def _pdf(tmp_path: Path, name: str, pages: int, w: float = 100, h: float = 200) -> Path:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=w, height=h)
    path = tmp_path / name
    with path.open("wb") as f:
        writer.write(f)
    return path


def test_booklet_pairs_saddle_stitch_order():
    assert booklet_pairs(8) == [
        ((7, 0), (1, 6)),
        ((5, 2), (3, 4)),
    ]
    assert booklet_pairs(4) == [((3, 0), (1, 2))]


def test_merge_pdfs_concatenates(tmp_path):
    a = _pdf(tmp_path, "a.pdf", 2)
    b = _pdf(tmp_path, "b.pdf", 3)
    out = tmp_path / "merged.pdf"
    assert merge_pdfs([a, b], out) == 5
    assert len(PdfReader(out).pages) == 5


def test_blank_pdf_inserts_leading_and_trailing(tmp_path):
    src = _pdf(tmp_path, "src.pdf", 3)
    out = tmp_path / "blanked.pdf"
    assert blank_pdf(src, out, leading=2, trailing=1) == 6
    reader = PdfReader(out)
    assert len(reader.pages) == 6
    assert reader.pages[0].mediabox.width == 100


def test_impose_booklet_pads_and_sheets(tmp_path):
    src = _pdf(tmp_path, "src.pdf", 5)  # pads to 8
    out = tmp_path / "imposed.pdf"
    assert impose_pdf(src, out, "booklet") == 2  # 2 sheets, 4 printed sides
    reader = PdfReader(out)
    assert len(reader.pages) == 4  # front/back of 2 sheets
    assert all(
        p.mediabox.width == 200 and p.mediabox.height == 200 for p in reader.pages
    )


def test_impose_thread_groups(tmp_path):
    src = _pdf(tmp_path, "src.pdf", 6)  # 2 sheets/group -> group size 8, pads to 8
    out = tmp_path / "thread.pdf"
    assert impose_pdf(src, out, "thread", sheets_per_group=2) == 2
    assert len(PdfReader(out).pages) == 4
