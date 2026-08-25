"""CLI: base6-techo render -> whole-notebook .tex (+ optional PDF)."""

import shutil
import subprocess
from pathlib import Path

import click
from loguru import logger

from base6_techo.imposition import booklet_output, booklet_summary, normal_output
from base6_techo.latex import render_latex
from base6_techo.models import (
    PAGE_PRESETS,
    DocumentSettings,
    PageSettings,
    RuledPattern,
    validate_project,
)

_ENGINES = ("tectonic", "xelatex", "pdflatex")


@click.group()
def main() -> None:
    """base6-techo: printable ruled-notebook generator."""


@main.command()
@click.option(
    "--preset",
    type=click.Choice(sorted(PAGE_PRESETS)),
    help="Paper preset; fills width/height.",
)
@click.option("--width", type=float, default=148, help="Page width in mm.")
@click.option("--height", type=float, default=210, help="Page height in mm.")
@click.option("--header", type=float, default=10, help="Header height in mm.")
@click.option("--footer", type=float, default=10, help="Footer height in mm.")
@click.option("--binding", type=float, default=15, help="Binding-side margin in mm.")
@click.option(
    "--non-binding",
    "non_binding",
    type=float,
    default=8,
    help="Non-binding-side margin in mm.",
)
@click.option("--spacing", type=float, default=8, help="Ruled line spacing in mm.")
@click.option(
    "--line-width", "line_width", type=float, default=0.2, help="Line width in pt."
)
@click.option(
    "--line-color", "line_color", default="#B0B0B0", help="Line color, #RRGGBB."
)
@click.option(
    "--dot-spacing",
    "dot_spacing",
    type=float,
    default=None,
    help="Also draw dots on the lines every N mm (centered, spreading outward).",
)
@click.option(
    "--dot-radius", "dot_radius", type=float, default=0.3, help="Dot radius in mm."
)
@click.option("--pages", type=int, default=32, help="Finished notebook page count.")
@click.option(
    "--page-number/--no-page-number",
    "page_number",
    default=True,
    help="Print page numbers in footer.",
)
@click.option(
    "--mode",
    "print_mode",
    type=click.Choice(["normal", "booklet"]),
    default="normal",
    help="normal: 1 page per PDF page; booklet: saddle-stitch imposition.",
)
@click.option(
    "--pdf", is_flag=True, help="Also compile to PDF if a LaTeX engine is installed."
)
@click.argument("out", type=click.Path(), default="techo.tex")
def render(
    preset,
    width,
    height,
    header,
    footer,
    binding,
    non_binding,
    spacing,
    line_width,
    line_color,
    dot_spacing,
    dot_radius,
    pages,
    page_number,
    print_mode,
    pdf,
    out,
):
    """Generate a complete printable ruled notebook."""
    if preset:
        width, height = PAGE_PRESETS[preset]
    try:
        page = PageSettings(
            width=width,
            height=height,
            header=header,
            footer=footer,
            binding=binding,
            non_binding=non_binding,
        )
        doc = DocumentSettings(page_count=pages, show_page_number=page_number)
        pattern = RuledPattern(
            spacing=spacing,
            line_width=line_width,
            line_color=line_color,
            dot_spacing=dot_spacing,
            dot_radius=dot_radius,
        )
        validate_project(page, doc)
    except ValueError as e:
        raise click.ClickException(str(e))

    if print_mode == "booklet":
        output_pages = booklet_output(page, pattern, doc)
        _padded, pad_added, sheets, sides = booklet_summary(doc)
        click.echo(
            f"成品 {doc.page_count} 页 · 补白 {pad_added} 页 · 打印纸 {sheets} 张 · 打印面 {sides} 面"
        )
        click.echo(
            f"打印纸尺寸 {output_pages[0].width:g} × {output_pages[0].height:g} mm"
        )
        click.echo("打印后：双面打印 → 叠放 → 对折 → 装订")
    else:
        output_pages = normal_output(page, pattern, doc)
        click.echo(f"成品 {doc.page_count} 页 · PDF {len(output_pages)} 页")
        click.echo(f"页面尺寸 {page.width:g} × {page.height:g} mm")

    out_path = Path(out)
    out_path.write_text(render_latex(output_pages, pattern))
    logger.info(f"wrote {out_path}")

    if pdf:
        engine = next((e for e in _ENGINES if shutil.which(e)), None)
        if engine is None:
            raise click.ClickException(f"no LaTeX engine found: {'/'.join(_ENGINES)}")
        cmd = (
            [engine, str(out_path)]
            if engine == "tectonic"
            else [engine, "-interaction=nonstopmode", "-halt-on-error", str(out_path)]
        )
        r = subprocess.run(
            cmd, cwd=out_path.parent, capture_output=True, text=True, check=False
        )
        if r.returncode != 0:
            raise click.ClickException(
                f"{engine} failed:\n{r.stdout[-2000:]}{r.stderr[-2000:]}"
            )
        logger.info(f"wrote {out_path.with_suffix('.pdf')}")
