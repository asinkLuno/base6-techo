from pathlib import Path

import api
import pytest
from api import Pipeline, PipelineContext, RenderStage, _RenderSections
from models import DocumentSettings, PageSettings
from pypdf import PdfReader
from template.basic import BasicPattern

A5 = PageSettings(148, 210)


def test_numbered_sections_continue_without_counting_unnumbered(tmp_path: Path):
    pattern = BasicPattern(draw_hlines=True)
    context = PipelineContext(tmp_path)
    _RenderSections(
        (
            RenderStage(pattern, A5, DocumentSettings(page_count=2)),
            RenderStage(
                pattern,
                A5,
                DocumentSettings(page_count=3, show_page_number=False),
            ),
            RenderStage(pattern, A5, DocumentSettings(page_count=2)),
        )
    )(context)

    numbers = [
        text.content
        for page, _ in context.generated_pages
        for placement in page.placements
        for text in placement.draw.texts
        if text.y == A5.height - A5.footer / 2
    ]
    assert numbers == ["1", "2", "3", "4"]


def test_compile_uses_bundled_tectonic(tmp_path: Path, monkeypatch):
    tectonic = tmp_path / "tectonic"
    tex = tmp_path / "page.tex"
    tex.write_text("")
    monkeypatch.setenv("BASE6_TECTONIC", str(tectonic))
    monkeypatch.setattr(api.shutil, "which", lambda executable: executable)

    def run(command, **_kwargs):
        assert command == [str(tectonic), "page.tex"]
        tex.with_suffix(".pdf").touch()
        return type("Result", (), {"returncode": 0})()

    monkeypatch.setattr(api.subprocess, "run", run)
    assert api._compile(tex, None) == tex.with_suffix(".pdf")


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
    assert result.document_pages == 4
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
    assert float(PdfReader(output).pages[0].mediabox.width) == pytest.approx(
        839.06, abs=0.02
    )


def test_pipeline_runs_custom_step_before_binding(tmp_path: Path):
    observed = []

    def observe(context: PipelineContext) -> None:
        observed.append((context.document_pages, context.sheets))

    result = (
        Pipeline(
            BasicPattern(draw_hlines=True),
            A5,
            DocumentSettings(page_count=1, show_page_number=False),
        )
        .add_pages(trailing=3)
        .append(observe)
        .bind("booklet")
        .run(tmp_path / "custom.pdf")
    )

    assert observed == [(4, None)]
    assert result.sheets == 1
