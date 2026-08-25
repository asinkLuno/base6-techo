from pathlib import Path

from pypdf import PdfReader, PdfWriter

from src.api import Pipeline
from src.models import DocumentSettings, PageSettings
from src.template.basic import BasicPattern

A5 = PageSettings(148, 210)


def test_pipeline_stages_and_result(tmp_path: Path, monkeypatch):
    appendix = tmp_path / "appendix.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=200)
    with appendix.open("wb") as file:
        writer.write(file)

    generated = tmp_path / "generated.pdf"
    Pipeline(
        BasicPattern(spacing=8, draw_hlines=True),
        A5,
        DocumentSettings(page_count=1, show_page_number=False),
    ).merge(appendix).add_pages(trailing=1).run(generated)

    assert generated.is_file()
    assert PdfReader(generated).pages
    assert len(PdfReader(generated).pages) == 3


def test_pipeline_supports_multiple_generated_sections(tmp_path: Path):
    output = tmp_path / "sections.pdf"
    result = (
        Pipeline(
            BasicPattern(draw_hlines=True),
            A5,
            DocumentSettings(page_count=1, show_page_number=False),
        )
        .add_section(
            BasicPattern(spacing=5, draw_dots=True, dot_spacing=5),
            DocumentSettings(page_count=2, show_page_number=False),
        )
        .add_pages(trailing=1)
        .bind("booklet")
        .run(output)
    )

    assert result.logical_pages == 3
    assert result.merged_pages == 4
    assert len(PdfReader(output).pages) == 2

    output = tmp_path / "booklet.pdf"
    result = (
        Pipeline(
            BasicPattern(draw_hlines=True),
            A5,
            DocumentSettings(page_count=1, show_page_number=False),
        )
        .add_pages(trailing=3)
        .bind("booklet")
        .run(output)
    )

    assert result.sheets == 1
    assert len(PdfReader(output).pages) == 2
    assert PdfReader(output).pages[0].mediabox.width == 839.06
