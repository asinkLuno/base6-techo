"""Public Python API for building printable notebook PDFs.

The pipeline is deliberately small and ordered:

1. render the selected pattern with page metadata;
2. optionally impose the result for printing/binding.

No command-line parsing is involved. Paths are accepted at the file boundary;
the drawing and PDF stages remain ordinary Python calls.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from imposition import OutputPage, impose_output, normal_output
from latex import render_sections_latex
from models import DocumentSettings, PageSettings, validate_project
from pages import Pattern
from template.basic import BasicPattern
from template.midori import MidoriPattern
from template.timeline import TimelinePattern

BindingMode = Literal["booklet", "thread"]


@dataclass(frozen=True)
class PipelineResult:
    """Files and counts produced by :meth:`Pipeline.run`."""

    pdf: Path
    logical_pages: int
    sheets: int | None


@dataclass(frozen=True)
class RenderStage:
    """One generated section in a pipeline."""

    pattern: Pattern
    page: PageSettings
    document: DocumentSettings


@dataclass
class PipelineContext:
    """Mutable state passed through each pipeline step."""

    workdir: Path
    engine: str | None = None
    current_pdf: Path | None = None
    logical_pages: int = 0
    sheets: int | None = None
    generated_pages: list[tuple[OutputPage, Pattern]] = field(default_factory=list)


@dataclass(frozen=True)
class _RenderSections:
    sections: tuple[RenderStage, ...]

    def __call__(self, context: PipelineContext) -> None:
        page_number = 1
        physical_page = 1
        for section in self.sections:
            pages = normal_output(
                section.page,
                section.pattern,
                section.document,
                page_number,
                physical_page,
            )
            context.generated_pages.extend((page, section.pattern) for page in pages)
            if section.document.show_page_number:
                page_number += section.document.page_count
            physical_page += section.document.page_count
        context.logical_pages = sum(
            section.document.page_count for section in self.sections
        )


@dataclass(frozen=True)
class _Bind:
    mode: BindingMode | None
    sheets_per_group: int

    def __call__(self, context: PipelineContext) -> None:
        if self.mode is None:
            return
        pages, context.sheets = impose_output(
            [page for page, _ in context.generated_pages],
            self.mode,
            self.sheets_per_group,
        )
        pattern_by_draw = {
            id(placement.draw): pattern
            for page, pattern in context.generated_pages
            for placement in page.placements
        }
        fallback = context.generated_pages[0][1]
        context.generated_pages = [
            (
                page,
                next((pattern_by_draw[id(p.draw)] for p in page.placements), fallback),
            )
            for page in pages
        ]


def _current_pdf(context: PipelineContext) -> Path:
    if context.current_pdf is None:
        raise RuntimeError("pipeline has not produced a PDF")
    return context.current_pdf


class Pipeline:
    """Build one printable PDF through a small, ordered pipeline.

    Example::

        result = (
            Pipeline(
                pattern=BasicPattern(spacing=8, draw_hlines=True),
                page=PageSettings(148, 210),
                document=DocumentSettings(page_count=32, binding_text="base-6"),
            )
            .bind("booklet")
            .run("notebook.pdf")
        )

    ``pattern``, ``page`` and ``document`` are the first stage, and ``bind``
    is always last.
    The methods return ``self`` so a request can be assembled declaratively.
    """

    def __init__(
        self,
        pattern: Pattern,
        page: PageSettings,
        document: DocumentSettings,
    ) -> None:
        validate_project(page, document)
        self.pattern = pattern
        self.page = page
        self.document = document
        self._sections: list[RenderStage] = [RenderStage(pattern, page, document)]
        self._binding: BindingMode | None = None
        self._sheets_per_group = 4

    def add_section(
        self,
        pattern: Pattern,
        document: DocumentSettings,
        page: PageSettings | None = None,
    ) -> Pipeline:
        """Generate another section before binding.

        The existing page settings are reused unless ``page`` is supplied.
        Sections should use the same physical paper size when they will be
        imposed together.
        """
        page = page or self.page
        validate_project(page, document)
        if (page.width, page.height) != (self.page.width, self.page.height):
            raise ValueError("all sections must use the same physical page size")
        self._sections.append(RenderStage(pattern, page, document))
        return self

    def bind(
        self,
        mode: BindingMode | None,
        *,
        sheets_per_group: int = 4,
    ) -> Pipeline:
        """Choose print binding: ``booklet``, ``thread``, or ``None``."""
        if mode not in (None, "booklet", "thread"):
            raise ValueError("mode must be booklet, thread, or None")
        if sheets_per_group < 1:
            raise ValueError("sheets_per_group must be >= 1")
        self._binding = mode
        self._sheets_per_group = sheets_per_group
        return self

    def run(self, output: str | Path, *, engine: str | None = None) -> PipelineResult:
        """Render and execute all configured stages, writing ``output``."""
        output = Path(output)
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="base6-techo-") as directory:
            context = PipelineContext(Path(directory), engine)
            _RenderSections(tuple(self._sections))(context)
            _Bind(self._binding, self._sheets_per_group)(context)
            tex = context.workdir / "document.tex"
            tex.write_text(render_sections_latex(context.generated_pages))
            context.current_pdf = _compile(tex, context.engine)
            shutil.copyfile(_current_pdf(context), output)
            return PipelineResult(
                output,
                context.logical_pages,
                context.sheets,
            )


def _compile(tex: Path, engine: str | None) -> Path:
    """Compile a generated TeX file without exposing a CLI concern publicly."""
    bundled = os.environ.get("BASE6_TECTONIC")
    engines = [engine] if engine else [bundled, "tectonic", "xelatex", "pdflatex"]
    executable = next((name for name in engines if name and shutil.which(name)), None)
    if executable is None:
        raise RuntimeError("no LaTeX engine found: tectonic/xelatex/pdflatex")
    command = (
        [executable, tex.name]
        if Path(executable).stem == "tectonic"
        else [executable, "-interaction=nonstopmode", "-halt-on-error", tex.name]
    )
    result = subprocess.run(
        command, cwd=tex.parent, capture_output=True, text=True, check=False
    )
    if result.returncode:
        details = f"{result.stdout[-2000:]}{result.stderr[-2000:]}"
        raise RuntimeError(f"{executable} failed:\n{details}")
    produced = tex.with_suffix(".pdf")
    if not produced.is_file():
        raise RuntimeError(f"{executable} did not produce {produced.name}")
    for suffix in (".log", ".aux"):
        tex.with_suffix(suffix).unlink(missing_ok=True)
    return produced


__all__ = [
    "BasicPattern",
    "BindingMode",
    "DocumentSettings",
    "MidoriPattern",
    "PageSettings",
    "Pipeline",
    "PipelineContext",
    "PipelineResult",
    "RenderStage",
    "TimelinePattern",
]
