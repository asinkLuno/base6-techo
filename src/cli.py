"""CLI: base6-techo render -> whole-notebook .tex (+ optional PDF)."""

import calendar
import json
import shutil
import subprocess
from datetime import date, timedelta
from pathlib import Path

import click
from loguru import logger

from src.basic import BasicPattern
from src.imposition import normal_output
from src.latex import render_latex
from src.midori import MidoriPattern
from src.models import (
    PAGE_PRESETS,
    DocumentSettings,
    PageSettings,
    validate_project,
)
from src.pdfops import blank_pdf, impose_pdf, merge_pdfs
from src.timeline import TimelinePattern

_ENGINES = ("tectonic", "xelatex", "pdflatex")
_LINES_FILE = Path(click.get_app_dir("base6-techo")) / "lines.json"
_MIDORI_FILE = Path(click.get_app_dir("base6-techo")) / "midori.json"


def _generate_dates(start_month: str, end_month: str) -> list[date]:
    """Generate every day in an inclusive yyyy-MM month range."""
    try:
        start = date.fromisoformat(f"{start_month}-01")
        end = date.fromisoformat(f"{end_month}-01")
    except ValueError as e:
        raise ValueError("months must use yyyy-MM format") from e
    if start > end:
        raise ValueError("start month must be <= end month")
    end = end.replace(day=calendar.monthrange(end.year, end.month)[1])
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def _load_lines() -> dict:
    if _LINES_FILE.exists():
        return json.loads(_LINES_FILE.read_text())
    return {}


def _load_midori() -> dict:
    if _MIDORI_FILE.exists():
        return json.loads(_MIDORI_FILE.read_text())
    return {}


@click.group()
def main() -> None:
    """base6-techo: printable ruled-notebook generator."""


@main.command()
@click.option("--spacing", type=float, default=None, help="Ruled line spacing in mm.")
@click.option(
    "--line-width", "line_width", type=float, default=None, help="Line width in pt."
)
@click.option("--line-color", "line_color", default=None, help="Line color, #RRGGBB.")
@click.option(
    "--hlines/--no-hlines",
    "draw_hlines",
    default=None,
    help="Draw horizontal ruled lines.",
)
@click.option(
    "--vlines/--no-vlines",
    "draw_vlines",
    default=None,
    help="Draw vertical lines (margin/grid) when configured.",
)
@click.option(
    "--dots/--no-dots",
    "draw_dots",
    default=None,
    help="Draw dots when dot-spacing configured.",
)
@click.option(
    "--hline-header/--no-hline-header",
    default=None,
    help="Extend horizontal lines to the paper header.",
)
@click.option(
    "--hline-footer/--no-hline-footer",
    default=None,
    help="Extend horizontal lines to the paper footer.",
)
@click.option(
    "--hline-inner/--no-hline-inner",
    default=None,
    help="Extend horizontal lines to the binding-side edge.",
)
@click.option(
    "--hline-outer/--no-hline-outer",
    default=None,
    help="Extend horizontal lines to the outer edge.",
)
@click.option(
    "--vline-header/--no-vline-header",
    default=None,
    help="Extend vertical lines to the paper header.",
)
@click.option(
    "--vline-footer/--no-vline-footer",
    default=None,
    help="Extend vertical lines to the paper footer.",
)
@click.option(
    "--vline-inner/--no-vline-inner",
    default=None,
    help="Extend vertical lines to the binding-side edge.",
)
@click.option(
    "--vline-outer/--no-vline-outer",
    default=None,
    help="Extend vertical lines to the outer edge.",
)
@click.option(
    "--dot-header/--no-dot-header",
    default=None,
    help="Extend dots to the paper header.",
)
@click.option(
    "--dot-footer/--no-dot-footer",
    default=None,
    help="Extend dots to the paper footer.",
)
@click.option(
    "--dot-inner/--no-dot-inner",
    default=None,
    help="Extend dots to the binding-side edge.",
)
@click.option(
    "--dot-outer/--no-dot-outer",
    default=None,
    help="Extend dots to the outer edge.",
)
@click.option(
    "--hline-edge-color",
    "hline_edge_color",
    default=None,
    help="Color of the topmost/bottommost hlines, #RRGGBB.",
)
@click.option(
    "--hline-edge-width",
    "hline_edge_width",
    type=float,
    default=None,
    help="Line width (pt) of the topmost/bottommost hlines.",
)
@click.option(
    "--vline-edge-color",
    "vline_edge_color",
    default=None,
    help="Color of the leftmost vline, #RRGGBB.",
)
@click.option(
    "--vline-edge-width",
    "vline_edge_width",
    type=float,
    default=None,
    help="Line width (pt) of the leftmost vline.",
)
@click.option(
    "--dot-center-color",
    "dot_center_color",
    default=None,
    help="Color of the center dot, #RRGGBB.",
)
@click.option(
    "--dot-spacing",
    "dot_spacing",
    type=float,
    default=None,
    help="Also draw dots on the lines every N mm (centered, spreading outward).",
)
@click.option(
    "--dot-radius", "dot_radius", type=float, default=None, help="Dot radius in mm."
)
@click.option(
    "--margin-x",
    "margin_x",
    type=float,
    default=None,
    help="Left margin vertical line, mm from content left (US notebook).",
)
@click.option(
    "--margin-color",
    "margin_color",
    default=None,
    help="Margin line color, #RRGGBB.",
)
@click.option(
    "--vline-spacing",
    "vline_spacing",
    type=float,
    default=None,
    help="Vertical grid lines every N mm from content left (French Seyes).",
)
@click.option(
    "--reset", is_flag=True, help="Back to default pattern (keeps --* overrides)."
)
def lines(**kw):
    """Configure the basic pattern; saved for render. No options = show."""
    reset = kw.pop("reset")
    cfg = {} if reset else _load_lines()
    changed = reset
    for name, value in kw.items():
        if value is not None:
            cfg[name] = value
            changed = True
    try:
        pattern = BasicPattern(**cfg)
    except (ValueError, TypeError) as e:
        raise click.ClickException(str(e))
    if changed:
        _LINES_FILE.parent.mkdir(parents=True, exist_ok=True)
        _LINES_FILE.write_text(json.dumps(cfg, indent=2))
        click.echo(f"lines 配置已保存到 {_LINES_FILE}")
    if pattern.draw_hlines:
        click.echo(
            f"横线 间距 {pattern.spacing:g}mm · 线宽 {pattern.line_width:g}pt · 颜色 {pattern.line_color}"
        )
        if pattern.hline_edge_color:
            click.echo(f"横线 顶底颜色 {pattern.hline_edge_color}")
        if pattern.hline_edge_width:
            click.echo(f"横线 顶底线宽 {pattern.hline_edge_width:g}pt")
    else:
        click.echo("横线 不画")
    if pattern.dot_spacing and pattern.draw_dots:
        click.echo(
            f"圆点 间距 {pattern.dot_spacing:g}mm · 半径 {pattern.dot_radius:g}mm"
        )
        if pattern.dot_center_color:
            click.echo(f"圆点 中心颜色 {pattern.dot_center_color}")
    if (
        pattern.margin_x is not None
        and pattern.margin_color is not None
        and pattern.draw_vlines
    ):
        click.echo(f"边线 左距 {pattern.margin_x:g}mm · 颜色 {pattern.margin_color}")
    if (
        pattern.vline_spacing is not None
        and pattern.margin_color is not None
        and pattern.draw_vlines
    ):
        click.echo(
            f"竖线 间距 {pattern.vline_spacing:g}mm · 颜色 {pattern.margin_color}"
        )
        if pattern.vline_edge_color:
            click.echo(f"竖线 最左颜色 {pattern.vline_edge_color}")
        if pattern.vline_edge_width:
            click.echo(f"竖线 最左线宽 {pattern.vline_edge_width:g}pt")


# Keep the original `lines` command while exposing the pattern-level name too.
main.add_command(lines, "basic")


@main.command()
@click.option("--spacing", type=float, default=None, help="Grid cell size in mm.")
@click.option(
    "--gap",
    type=float,
    default=None,
    help="Gap before each vertical grid segment in mm.",
)
@click.option(
    "--edge-extension",
    type=float,
    default=None,
    help="Length of short edge extensions in mm.",
)
@click.option(
    "--dot-frequency",
    type=int,
    default=None,
    help="Place helper dots every N grid cells.",
)
@click.option("--dot-radius", type=float, default=None, help="Helper dot radius in mm.")
@click.option("--line-width", type=float, default=None, help="Grid line width in pt.")
@click.option("--line-color", default=None, help="Grid line color, #RRGGBB.")
@click.option("--dot-color", default=None, help="Helper dot color, #RRGGBB.")
@click.option(
    "--header/--no-header", default=None, help="Extend the grid into the page header."
)
@click.option(
    "--footer/--no-footer", default=None, help="Extend the grid into the page footer."
)
@click.option(
    "--inner/--no-inner", default=None, help="Extend the grid to the binding-side edge."
)
@click.option(
    "--outer/--no-outer", default=None, help="Extend the grid to the outer edge."
)
@click.option("--reset", is_flag=True, help="Back to the default Midori pattern.")
def midori(**kw):
    """Configure the Midori pattern; saved for render."""
    reset = kw.pop("reset")
    cfg = {} if reset else _load_midori()
    changed = reset
    for name, value in kw.items():
        if value is not None:
            cfg[name] = value
            changed = True
    try:
        pattern = MidoriPattern(**cfg)
    except (ValueError, TypeError) as e:
        raise click.ClickException(str(e))
    if changed:
        _MIDORI_FILE.parent.mkdir(parents=True, exist_ok=True)
        _MIDORI_FILE.write_text(json.dumps(cfg, indent=2))
        click.echo(f"midori 配置已保存到 {_MIDORI_FILE}")
    click.echo(
        f"Midori {pattern.spacing:g}mm 网格 · 间隙 {pattern.gap:g}mm · "
        f"线宽 {pattern.line_width:g}pt · 颜色 {pattern.line_color}"
    )


@main.command()
@click.option(
    "--preset",
    "--size",
    "preset",
    default="A5",
    show_default=True,
    type=click.Choice(sorted(PAGE_PRESETS)),
    help="Paper preset (also accepted as --size).",
)
@click.option("--start", default=0, show_default=True, type=click.IntRange(0, 98))
@click.option("--end", default=26, show_default=True, type=click.IntRange(1, 99))
@click.option(
    "--pages",
    default="1",
    show_default=True,
    type=click.Choice(["1", "2"]),
    help="1: full range on every page; 2: split across the spread.",
)
@click.option(
    "--swap", is_flag=True, help="Swap the two halves when --pages 2 is used."
)
@click.option(
    "--color", default="#7A7A7A", show_default=True, help="Timeline color, #RRGGBB."
)
@click.option(
    "--header-date-range",
    nargs=2,
    type=str,
    default=None,
    metavar="START END",
    help="Add one yyyy-MM-dd header date per page for this inclusive yyyy-MM range.",
)
@click.option(
    "--header-pages",
    "--header-parity",
    "header_parity",
    type=click.Choice(["odd", "even", "both"]),
    default="both",
    show_default=True,
    help="Pages that receive date headers: odd, even, or both.",
)
@click.option(
    "--pdf", is_flag=True, help="Also compile to PDF if a LaTeX engine is installed."
)
@click.argument("out", type=click.Path(), default="timeline.tex")
def timeline(
    preset, start, end, pages, swap, color, header_date_range, header_parity, pdf, out
):
    """Generate a two-page binding-edge hour timeline."""
    try:
        page = PageSettings(*PAGE_PRESETS[preset])
        pattern = TimelinePattern(
            start, end, int(pages), swap, f"#{color.lstrip('#').upper()}"
        )
        dates = (
            tuple(
                day
                for date in _generate_dates(*header_date_range)
                for day in (
                    (date, date) if header_parity in ("odd", "even") else (date,)
                )
            )
            if header_date_range is not None
            else None
        )
        doc = DocumentSettings(
            page_count=len(dates) if dates else 2,
            show_page_number=False,
            header_dates=dates,
            header_date_format="yyyy-MM-dd" if dates else None,
            header_date_locale="en_US",
            header_parity=header_parity,
            page_number_font="0xProto Nerd Font",
        )
        output_pages = normal_output(page, pattern, doc)
    except ValueError as e:
        raise click.ClickException(str(e))

    out_path = Path(out)
    out_path.write_text(render_latex(output_pages, pattern))
    date_count = (
        len(dates) // (2 if header_parity in ("odd", "even") else 1) if dates else 0
    )
    click.echo(
        f"时间线 {start:02d}–{end:02d} · {preset} · "
        f"{f'{date_count} 天' if dates else '2 页'} · PDF {len(output_pages)} 页"
    )
    logger.info(f"wrote {out_path}")
    if pdf:
        engine = next((e for e in _ENGINES if shutil.which(e)), None)
        if engine is None:
            raise click.ClickException(f"no LaTeX engine found: {'/'.join(_ENGINES)}")
        cmd = (
            [engine, out_path.name]
            if engine == "tectonic"
            else [engine, "-interaction=nonstopmode", "-halt-on-error", out_path.name]
        )
        result = subprocess.run(
            cmd, cwd=out_path.parent, capture_output=True, text=True, check=False
        )
        if result.returncode != 0:
            raise click.ClickException(
                f"{engine} failed:\n{result.stdout[-2000:]}{result.stderr[-2000:]}"
            )


@main.command()
@click.option(
    "--preset",
    type=click.Choice(sorted(PAGE_PRESETS)),
    help="Paper preset; mutually exclusive with --width/--height.",
)
@click.option("--width", type=float, default=None, help="Page width in mm.")
@click.option("--height", type=float, default=None, help="Page height in mm.")
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
@click.option("--pages", type=int, default=32, help="Finished notebook page count.")
@click.option(
    "--page-number/--no-page-number",
    "page_number",
    default=True,
    help="Print page numbers in footer.",
)
@click.option(
    "--binding-text",
    default=None,
    help="First line of the text watermark along the binding-side margin.",
)
@click.option(
    "--binding-text-2",
    default=None,
    help="Second line of the text watermark along the binding-side margin.",
)
@click.option(
    "--binding-text-size",
    type=float,
    default=8,
    show_default=True,
    help="Font size of the first binding watermark line in pt.",
)
@click.option(
    "--binding-text-2-size",
    type=float,
    default=8,
    show_default=True,
    help="Font size of the second binding watermark line in pt.",
)
@click.option(
    "--binding-text-spacing",
    type=float,
    default=5,
    show_default=True,
    help="Center-to-center spacing between binding watermark lines in mm.",
)
@click.option(
    "--page-number-font",
    default=r"\sffamily",
    show_default=True,
    help="LaTeX font declaration for page numbers.",
)
@click.option(
    "--binding-text-font",
    default=r"\sffamily",
    show_default=True,
    help="LaTeX font declaration for binding watermarks.",
)
@click.option(
    "--pattern",
    "pattern_name",
    type=click.Choice(["basic", "midori"]),
    default="basic",
    show_default=True,
    help="Page pattern configured by `lines` or `midori`.",
)
@click.option(
    "--header-date-range",
    "header_date_range",
    nargs=2,
    type=str,
    default=None,
    help="Start and end months (yyyy-MM) for auto-dating pages.",
)
@click.option(
    "--header-locale",
    "header_date_locale",
    type=click.Choice(["zh_CN", "en_US"]),
    default="zh_CN",
    show_default=True,
    help="Locale used to format header dates.",
)
@click.option(
    "--header-date-format",
    "header_date_format",
    type=str,
    default=None,
    help="Date format for header (ICU pattern, e.g., yyyy年M月d日EEEE). Defaults to yyyy年M月d日EEEE.",
)
@click.option(
    "--header-pages",
    "--header-parity",
    "header_parity",
    type=click.Choice(["odd", "even", "both"]),
    default="both",
    show_default=True,
    help="Pages that receive date headers: odd, even, or both.",
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
    pages,
    page_number,
    binding_text,
    binding_text_2,
    binding_text_size,
    binding_text_2_size,
    binding_text_spacing,
    page_number_font,
    binding_text_font,
    pattern_name,
    header_date_range,
    header_date_locale,
    header_date_format,
    header_parity,
    pdf,
    out,
):
    """Generate a complete printable ruled notebook (lines config from `lines`)."""
    # Validate header date options
    if header_date_format is not None and header_date_range is None:
        raise click.ClickException("--header-date-format requires --header-date-range")
    header_dates: tuple[date, ...] | None = None
    if header_date_range is not None:
        header_date_format = header_date_format or "yyyy年M月d日EEEE"
        try:
            all_dates = _generate_dates(header_date_range[0], header_date_range[1])
        except ValueError as e:
            raise click.ClickException(str(e))
        # Cap pages at the number of days (two-page mode: one date per spread)
        stride = 2 if header_parity in ("odd", "even") else 1
        days = min(pages // stride, len(all_dates))
        effective_pages = days * stride
        header_dates = tuple(
            day for d in all_dates[:days] for day in ((d, d) if stride == 2 else (d,))
        )
        if effective_pages != pages:
            click.echo(
                f"页数从 {pages} 调整为 {effective_pages}（日期范围共 {len(all_dates)} 天）"
            )
        pages = effective_pages

    if preset:
        if width is not None or height is not None:
            raise click.ClickException(
                "--preset is mutually exclusive with --width/--height"
            )
        width, height = PAGE_PRESETS[preset]
    elif width is not None and height is not None:
        pass
    else:
        raise click.ClickException(
            "must specify either --preset or both --width and --height"
        )
    try:
        page = PageSettings(
            width=width,
            height=height,
            header=header,
            footer=footer,
            binding=binding,
            non_binding=non_binding,
        )
        doc = DocumentSettings(
            page_count=pages,
            show_page_number=page_number,
            binding_text=binding_text,
            binding_text_2=binding_text_2,
            binding_text_size=binding_text_size,
            binding_text_2_size=binding_text_2_size,
            binding_text_spacing=binding_text_spacing,
            page_number_font=page_number_font,
            binding_text_font=binding_text_font,
            header_dates=header_dates,
            header_date_format=header_date_format,
            header_date_locale=header_date_locale,
            header_parity=header_parity,
        )
        validate_project(page, doc)
    except ValueError as e:
        raise click.ClickException(str(e))
    try:
        pattern = (
            MidoriPattern(**_load_midori())
            if pattern_name == "midori"
            else BasicPattern(**_load_lines())
        )
    except (ValueError, TypeError) as e:
        raise click.ClickException(f"{pattern_name} 配置无效: {e}")

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
            [engine, out_path.name]
            if engine == "tectonic"
            else [engine, "-interaction=nonstopmode", "-halt-on-error", out_path.name]
        )
        r = subprocess.run(
            cmd, cwd=out_path.parent, capture_output=True, text=True, check=False
        )
        if r.returncode != 0:
            raise click.ClickException(
                f"{engine} failed:\n{r.stdout[-2000:]}{r.stderr[-2000:]}"
            )
        log = out_path.with_suffix(".log")
        if log.exists():
            log.unlink()
        aux = out_path.with_suffix(".aux")
        if aux.exists():
            aux.unlink()
        logger.info(f"wrote {out_path.with_suffix('.pdf')}")


@main.command()
@click.argument(
    "inputs", nargs=-1, type=click.Path(exists=True, dir_okay=False, path_type=Path)
)
@click.argument("out", type=click.Path(path_type=Path))
def merge(inputs, out):
    """Concatenate PDFs in order into one PDF."""
    if not inputs:
        raise click.ClickException("at least one input PDF is required")
    count = merge_pdfs(list(inputs), Path(out))
    click.echo(f"合并 {len(inputs)} 个 PDF · 共 {count} 页 → {out}")
    logger.info(f"wrote {out}")


@main.command()
@click.argument("src", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.argument("out", type=click.Path(path_type=Path))
@click.option(
    "--leading",
    type=click.IntRange(min=0),
    default=0,
    show_default=True,
    help="Blank pages inserted before page 1.",
)
@click.option(
    "--trailing",
    type=click.IntRange(min=0),
    default=0,
    show_default=True,
    help="Blank pages appended at the end.",
)
def blank(src, out, leading, trailing):
    """Insert blank pages at the start/end of a PDF."""
    count = blank_pdf(Path(src), Path(out), leading, trailing)
    click.echo(f"补白 {leading}+{trailing} 页 · 共 {count} 页 → {out}")
    logger.info(f"wrote {out}")


@main.command()
@click.argument("src", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.argument("out", type=click.Path(path_type=Path))
@click.option(
    "--mode",
    type=click.Choice(["booklet", "thread"]),
    default="booklet",
    show_default=True,
    help="booklet: saddle stitch; thread: grouped signatures.",
)
@click.option(
    "--sheets-per-group",
    type=click.IntRange(min=1),
    default=4,
    show_default=True,
    help="Sheets in each thread-bound group (only used with --mode thread).",
)
def impose(src, out, mode, sheets_per_group):
    """Reimpose a PDF: pad to signatures, two logical pages per sheet side."""
    sheets = impose_pdf(Path(src), Path(out), mode, sheets_per_group)
    click.echo(f"{mode} · 打印纸 {sheets} 张 · 双面 {sheets * 2} 面 → {out}")
    logger.info(f"wrote {out}")
