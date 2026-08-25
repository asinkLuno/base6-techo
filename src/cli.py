"""CLI: base6-techo render -> whole-notebook .tex (+ optional PDF)."""

import calendar
import json
from datetime import date, timedelta
from pathlib import Path

import click
from loguru import logger

from src.basic import BasicPattern
from src.midori import MidoriPattern
from src.pdfops import blank_pdf, impose_pdf, merge_pdfs

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


from src.render_cli import make_render

main.add_command(make_render(_load_lines, _load_midori, _generate_dates, _ENGINES))


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
