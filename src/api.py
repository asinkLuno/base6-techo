"""Public Python API for building printable notebook PDFs.

The pipeline is deliberately small and ordered:

1. render the selected pattern with page metadata;
2. optionally append other PDFs and add blank pages;
3. optionally impose the result for printing/binding.

No command-line parsing is involved. Paths are accepted at the file boundary;
the drawing and PDF stages remain ordinary Python calls.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from src.imposition import normal_output
from src.latex import render_latex
from src.models import DocumentSettings, PageSettings, validate_project
from src.pages import Pattern
from src.pdfops import blank_pdf, impose_pdf, merge_pdfs
from src.template.basic import BasicPattern
from src.template.midori import MidoriPattern
from src.template.timeline import TimelinePattern

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

    def run(self, output: str | Path, *, engine: str | None = None) -> PipelineResult:
        """Render and execute all configured stages, writing ``output``."""
        output = Path(output)
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="base6-techo-") as directory:
            work = Path(directory)
            generated_files: list[Path] = []
            for index, section in enumerate(self._sections):
                tex = work / f"section-{index}.tex"
                tex.write_text(
                    render_latex(
                        [
                            *normal_output(
                                section.page, section.pattern, section.document
                            )
                        ],
                        section.pattern,
                    )
                )
                generated = work / f"section-{index}.pdf"
                _compile(tex, generated, engine)
                generated_files.append(generated)

            current = generated_files[0]
            logical_pages = sum(
                section.document.page_count for section in self._sections
            )
            merged_pages = logical_pages
            if len(generated_files) > 1 or self._inputs:
                merged = work / "merged.pdf"
                merged_pages = merge_pdfs([*generated_files, *self._inputs], merged)
                current = merged
            if self._leading or self._trailing:
                padded = work / "padded.pdf"
                merged_pages = blank_pdf(current, padded, self._leading, self._trailing)
                current = padded
            sheets = None
            if self._binding is not None:
                imposed = work / "imposed.pdf"
                sheets = impose_pdf(
                    current,
                    imposed,
                    self._binding,
                    self._sheets_per_group,
                )
                current = imposed
            shutil.copyfile(current, output)
        return PipelineResult(output, logical_pages, merged_pages, sheets)


def _compile(tex: Path, pdf: Path, engine: str | None) -> None:
    """Compile a generated TeX file without exposing a CLI concern publicly."""
    engines = [engine] if engine else ["tectonic", "xelatex", "pdflatex"]
    executable = next((name for name in engines if name and shutil.which(name)), None)
    if executable is None:
        raise RuntimeError("no LaTeX engine found: tectonic/xelatex/pdflatex")
    command = (
        [executable, tex.name]
        if executable == "tectonic"
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
    shutil.move(produced, pdf)
    for suffix in (".log", ".aux"):
        tex.with_suffix(suffix).unlink(missing_ok=True)


__all__ = [
    "BasicPattern",
    "BindingMode",
    "DocumentSettings",
    "MidoriPattern",
    "PageSettings",
    "Pipeline",
    "PipelineResult",
    "RenderStage",
    "TimelinePattern",
]
