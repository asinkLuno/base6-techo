"""Public Python API for building printable notebook PDFs.

The pipeline is deliberately small and ordered:

1. render the selected pattern with page metadata;
2. optionally append other PDFs and add blank pages;
3. optionally impose the result for printing/binding.

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
from typing import Literal, Protocol

from imposition import normal_output
from latex import render_latex
from models import DocumentSettings, PageSettings, validate_project
from pages import Pattern
from pdfops import blank_pdf, impose_pdf, merge_pdfs
from template.basic import BasicPattern
from template.midori import MidoriPattern
from template.timeline import TimelinePattern

BindingMode = Literal["booklet", "thread"]


@dataclass(frozen=True)
class PipelineResult:
    """Files and counts produced by :meth:`Pipeline.run`."""

    pdf: Path
    logical_pages: int
    merged_pages: int
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
    merged_pages: int = 0
    sheets: int | None = None
    generated_pdfs: list[Path] = field(default_factory=list)


class PipelineStep(Protocol):
    """A synchronous filter that reads or updates the pipeline context."""

    def __call__(self, context: PipelineContext) -> None: ...


@dataclass(frozen=True)
class _RenderSections:
    sections: tuple[RenderStage, ...]

    def __call__(self, context: PipelineContext) -> None:
        for index, section in enumerate(self.sections):
            tex = context.workdir / f"section-{index}.tex"
            tex.write_text(
                render_latex(
                    normal_output(section.page, section.pattern, section.document),
                    section.pattern,
                )
            )
            context.generated_pdfs.append(_compile(tex, context.engine))
        context.logical_pages = sum(
            section.document.page_count for section in self.sections
        )


@dataclass(frozen=True)
class _MergePdfs:
    inputs: tuple[Path, ...]

    def __call__(self, context: PipelineContext) -> None:
        inputs = [*context.generated_pdfs, *self.inputs]
        context.current_pdf = inputs[0]
        context.merged_pages = context.logical_pages
        if len(inputs) > 1:
            context.current_pdf = context.workdir / "merged.pdf"
            context.merged_pages = merge_pdfs(inputs, context.current_pdf)


@dataclass(frozen=True)
class _AddPages:
    leading: int
    trailing: int

    def __call__(self, context: PipelineContext) -> None:
        if not (self.leading or self.trailing):
            return
        source = _current_pdf(context)
        context.current_pdf = context.workdir / "padded.pdf"
        context.merged_pages = blank_pdf(
            source, context.current_pdf, self.leading, self.trailing
        )


@dataclass(frozen=True)
class _Bind:
    mode: BindingMode | None
    sheets_per_group: int

    def __call__(self, context: PipelineContext) -> None:
        if self.mode is None:
            return
        source = _current_pdf(context)
        context.current_pdf = context.workdir / "imposed.pdf"
        context.sheets = impose_pdf(
            source, context.current_pdf, self.mode, self.sheets_per_group
        )


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
            .merge("appendix.pdf")
            .add_pages(trailing=2)
            .bind("booklet")
            .run("notebook.pdf")
        )

    ``pattern``, ``page`` and ``document`` are the first stage. ``merge`` and
    ``add_pages`` operate on the generated PDF, and ``bind`` is always last.
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
        self._inputs: list[Path] = []
        self._leading = 0
        self._trailing = 0
        self._binding: BindingMode | None = None
        self._sheets_per_group = 4
        self._custom_steps: list[PipelineStep] = []

    def add_section(
        self,
        pattern: Pattern,
        document: DocumentSettings,
        page: PageSettings | None = None,
    ) -> Pipeline:
        """Generate another section before merge/padding/binding.

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

    def merge(self, *pdfs: str | Path) -> Pipeline:
        """Append existing PDFs after the generated notebook."""
        paths = [Path(pdf) for pdf in pdfs]
        missing = [str(path) for path in paths if not path.is_file()]
        if missing:
            raise FileNotFoundError(", ".join(missing))
        self._inputs.extend(paths)
        return self

    def add_pages(self, *, leading: int = 0, trailing: int = 0) -> Pipeline:
        """Add blank pages before and/or after the merged document."""
        if leading < 0 or trailing < 0:
            raise ValueError("leading and trailing must be >= 0")
        self._leading += leading
        self._trailing += trailing
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

    def append(self, step: PipelineStep) -> Pipeline:
        """Run a custom step after padding and before binding."""
        self._custom_steps.append(step)
        return self

    def run(self, output: str | Path, *, engine: str | None = None) -> PipelineResult:
        """Render and execute all configured stages, writing ``output``."""
        output = Path(output)
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="base6-techo-") as directory:
            context = PipelineContext(Path(directory), engine)
            steps: list[PipelineStep] = [
                _RenderSections(tuple(self._sections)),
                _MergePdfs(tuple(self._inputs)),
                _AddPages(self._leading, self._trailing),
                *self._custom_steps,
                _Bind(self._binding, self._sheets_per_group),
            ]
            for step in steps:
                step(context)
            shutil.copyfile(_current_pdf(context), output)
            return PipelineResult(
                output,
                context.logical_pages,
                context.merged_pages,
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
    "PipelineStep",
    "RenderStage",
    "TimelinePattern",
]
