from click.testing import CliRunner

from src.cli import main
from src.layout import geometry_for
from src.midori import MidoriPattern, draw
from src.models import ContentPage, PageSettings
from src.pages import render_page

A5 = PageSettings(
    width=148, height=210, header=10, footer=10, binding=15, non_binding=8
)


def test_midori_grid_stays_inside_selected_region():
    geo = geometry_for(A5, 1)
    pattern = MidoriPattern()
    lines, dots = draw(geo, pattern)

    assert lines and dots
    assert all(15 <= p <= 140 for line in lines for p in (line.x1, line.x2))
    assert all(10 <= p <= 200 for line in lines for p in (line.y1, line.y2))

    full = MidoriPattern(header=True, footer=True, inner=True, outer=True)
    full_lines, _ = draw(geo, full)
    assert min(line.x1 for line in full_lines) >= 0
    assert max(line.x2 for line in full_lines) <= 148
    assert min(line.y1 for line in full_lines) >= 0
    assert max(line.y2 for line in full_lines) <= 210


def test_midori_keeps_page_footer_and_binding_watermark():
    page_draw = render_page(
        A5,
        MidoriPattern(),
        ContentPage(1),
        show_page_number=True,
        binding_text="base-6",
    )

    assert any(text.content == "1" and text.y == 205 for text in page_draw.texts)
    assert any(text.content == "base-6" and text.x == 7.5 for text in page_draw.texts)


def test_midori_command_configures_render_pattern(tmp_path, monkeypatch):
    monkeypatch.setattr("src.cli._MIDORI_FILE", tmp_path / "midori.json")
    runner = CliRunner()

    configured = runner.invoke(
        main,
        ["midori", "--reset", "--spacing", "5", "--line-color", "#123456"],
    )
    assert configured.exit_code == 0, configured.output

    rendered = runner.invoke(
        main,
        [
            "render",
            "--pattern",
            "midori",
            "--preset",
            "A5",
            "--pages",
            "1",
            str(tmp_path / "midori.tex"),
        ],
    )
    assert rendered.exit_code == 0, rendered.output
    tex = (tmp_path / "midori.tex").read_text()
    assert "definecolor{patterncolor}{HTML}{123456}" in tex
    assert "line width=0.7pt" in tex
