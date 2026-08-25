"""Click command group for rendering the three page-pattern types."""

import shutil
import subprocess
from pathlib import Path

import click
from loguru import logger

from src.basic import BasicPattern
from src.imposition import OutputPage, normal_output
from src.latex import render_latex
from src.midori import MidoriPattern
from src.models import PAGE_PRESETS, DocumentSettings, PageSettings, validate_project
from src.timeline import TimelinePattern


def make_render(load_lines, load_midori, generate_dates, engines):
    @click.group()
    @click.option("--preset", "--size", type=click.Choice(sorted(PAGE_PRESETS)))
    @click.option("--width", type=float)
    @click.option("--height", type=float)
    @click.option("--header", type=float, default=10, show_default=True)
    @click.option("--footer", type=float, default=10, show_default=True)
    @click.option("--binding", type=float, default=15, show_default=True)
    @click.option("--non-binding", type=float, default=8, show_default=True)
    @click.option("--pages", type=click.IntRange(1, 500))
    @click.option("--page-number/--no-page-number", default=None)
    @click.option("--leading-blank", is_flag=True)
    @click.option("--binding-text")
    @click.option("--binding-text-2")
    @click.option("--binding-text-size", type=float, default=8, show_default=True)
    @click.option("--binding-text-2-size", type=float, default=8, show_default=True)
    @click.option("--binding-text-spacing", type=float, default=5, show_default=True)
    @click.option("--page-number-font", default=r"\sffamily", show_default=True)
    @click.option("--binding-text-font", default=r"\sffamily", show_default=True)
    @click.option("--header-date-range", nargs=2, metavar="START END")
    @click.option("--header-locale", type=click.Choice(["zh_CN", "en_US"]))
    @click.option("--header-date-format")
    @click.option(
        "--header-pages",
        "--header-parity",
        "header_parity",
        type=click.Choice(["odd", "even", "both"]),
        default="both",
        show_default=True,
    )
    @click.option("--header-date-size", type=float, default=8, show_default=True)
    @click.option("--header-date-font")
    @click.option(
        "--header-date-position",
        type=click.Choice(["center", "binding", "outer"]),
        default="center",
        show_default=True,
    )
    @click.option("--pdf", is_flag=True)
    @click.pass_context
    def render(ctx, **options):
        """Render a basic, Midori, or timeline document."""
        ctx.obj = options

    def run(common, pattern, out, default_pages, default_page_number):
        preset, width, height = common["preset"], common["width"], common["height"]
        if preset and (width is not None or height is not None):
            raise click.ClickException(
                "--preset is mutually exclusive with --width/--height"
            )
        if preset:
            width, height = PAGE_PRESETS[preset]
        elif width is None and height is None:
            width, height = PAGE_PRESETS["A5"]
        elif width is None or height is None:
            raise click.ClickException("--width and --height must be used together")

        pages = common["pages"] or default_pages
        header_dates = None
        date_format = common["header_date_format"]
        if date_format and not common["header_date_range"]:
            raise click.ClickException(
                "--header-date-format requires --header-date-range"
            )
        if common["header_date_range"]:
            try:
                dates = generate_dates(*common["header_date_range"])
            except ValueError as error:
                raise click.ClickException(str(error))
            stride = 2 if common["header_parity"] in ("odd", "even") else 1
            days = min(pages // stride, len(dates)) if common["pages"] else len(dates)
            pages = days * stride
            header_dates = tuple(
                value
                for day in dates[:days]
                for value in ((day, day) if stride == 2 else (day,))
            )
            date_format = date_format or (
                "yyyy-MM-dd"
                if isinstance(pattern, TimelinePattern)
                else "yyyy年M月d日EEEE"
            )

        if common["leading_blank"]:
            pages += 1
            if header_dates:
                header_dates = (header_dates[0], *header_dates)
        try:
            page = PageSettings(
                width,
                height,
                common["header"],
                common["footer"],
                common["binding"],
                common["non_binding"],
            )
            doc = DocumentSettings(
                page_count=pages,
                show_page_number=(
                    default_page_number
                    if common["page_number"] is None
                    else common["page_number"]
                ),
                binding_text=common["binding_text"],
                binding_text_2=common["binding_text_2"],
                binding_text_size=common["binding_text_size"],
                binding_text_2_size=common["binding_text_2_size"],
                binding_text_spacing=common["binding_text_spacing"],
                page_number_font=common["page_number_font"],
                binding_text_font=common["binding_text_font"],
                header_dates=header_dates,
                header_date_format=date_format,
                header_date_locale=common["header_locale"]
                or ("en_US" if isinstance(pattern, TimelinePattern) else "zh_CN"),
                header_parity=common["header_parity"],
                header_date_size=common["header_date_size"],
                header_date_font=common["header_date_font"],
                header_date_position=common["header_date_position"],
            )
            validate_project(page, doc)
        except ValueError as error:
            raise click.ClickException(str(error))

        output_pages = normal_output(page, pattern, doc)
        if common["leading_blank"]:
            output_pages[0] = OutputPage(page.width, page.height, [])
        out_path = Path(out)
        out_path.write_text(render_latex(output_pages, pattern))
        click.echo(f"成品 {doc.page_count} 页 · PDF {len(output_pages)} 页")
        click.echo(f"页面尺寸 {page.width:g} × {page.height:g} mm")
        logger.info(f"wrote {out_path}")
        if not common["pdf"]:
            return
        engine = next((item for item in engines if shutil.which(item)), None)
        if engine is None:
            raise click.ClickException(f"no LaTeX engine found: {'/'.join(engines)}")
        command = (
            [engine, out_path.name]
            if engine == "tectonic"
            else [engine, "-interaction=nonstopmode", "-halt-on-error", out_path.name]
        )
        result = subprocess.run(
            command, cwd=out_path.parent, capture_output=True, text=True, check=False
        )
        if result.returncode:
            raise click.ClickException(
                f"{engine} failed:\n{result.stdout[-2000:]}{result.stderr[-2000:]}"
            )
        for suffix in (".log", ".aux"):
            out_path.with_suffix(suffix).unlink(missing_ok=True)

    @render.command("basic")
    @click.argument("out", type=click.Path(), default="techo.tex")
    @click.pass_obj
    def basic(common, out):
        """Render the saved basic pattern."""
        try:
            pattern = BasicPattern(**load_lines())
        except (ValueError, TypeError) as error:
            raise click.ClickException(f"basic 配置无效: {error}")
        run(common, pattern, out, 32, True)

    @render.command("midori")
    @click.argument("out", type=click.Path(), default="techo.tex")
    @click.pass_obj
    def midori(common, out):
        """Render the saved Midori pattern."""
        try:
            pattern = MidoriPattern(**load_midori())
        except (ValueError, TypeError) as error:
            raise click.ClickException(f"midori 配置无效: {error}")
        run(common, pattern, out, 32, True)

    @render.command("timeline")
    @click.option("--start", default=0, show_default=True, type=click.IntRange(0, 98))
    @click.option("--end", default=26, show_default=True, type=click.IntRange(1, 99))
    @click.option(
        "--split-pages",
        default="2",
        show_default=True,
        type=click.Choice(["1", "2"]),
    )
    @click.option("--swap", is_flag=True)
    @click.option("--color", default="#7A7A7A", show_default=True)
    @click.argument("out", type=click.Path(), default="timeline.tex")
    @click.pass_obj
    def timeline(common, start, end, split_pages, swap, color, out):
        """Render a binding-edge hour timeline."""
        try:
            pattern = TimelinePattern(
                start, end, int(split_pages), swap, f"#{color.lstrip('#').upper()}"
            )
        except ValueError as error:
            raise click.ClickException(str(error))
        run(common, pattern, out, 2, False)

    return render
