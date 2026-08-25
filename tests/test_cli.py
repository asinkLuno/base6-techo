from click.testing import CliRunner

from src.cli import main


def test_lines_saved_and_used_by_render(tmp_path, monkeypatch):
    monkeypatch.setattr("src.cli._LINES_FILE", tmp_path / "lines.json")
    runner = CliRunner()
    r = runner.invoke(
        main,
        [
            "lines",
            "--hlines",
            "--vlines",
            "--dots",
            "--spacing",
            "10",
            "--line-color",
            "#112233",
            "--dot-spacing",
            "5",
            "--margin-x",
            "20",
            "--margin-color",
            "#CC0000",
            "--vline-spacing",
            "40",
            "--hline-edge-color",
            "#111111",
            "--vline-edge-color",
            "#222222",
            "--dot-center-color",
            "#333333",
        ],
    )
    assert r.exit_code == 0, r.output
    assert "10mm" in r.output

    r = runner.invoke(
        main, ["render", "--preset", "A5", "--pages", "4", str(tmp_path / "out.tex")]
    )
    assert r.exit_code == 0, r.output
    tex = (tmp_path / "out.tex").read_text()
    assert "112233" in tex
    assert "line width=0.2pt" in tex
    assert "circle (" in tex
    assert "definecolor{cCC0000}{HTML}{CC0000}" in tex
    assert (
        "\\draw (35,10) -- (35,200);" in tex
    )  # margin line, content x=15+20, full height
    assert "\\draw (75,10) -- (75,200);" in tex  # first grid line, 40mm after margin
    assert "definecolor{c111111}{HTML}{111111}" in tex
    assert "definecolor{c222222}{HTML}{222222}" in tex
    assert "definecolor{c333333}{HTML}{333333}" in tex

    # margin_x without margin_color -> nothing drawn (fresh config)
    runner.invoke(main, ["lines", "--reset", "--margin-x", "20"])
    r = runner.invoke(
        main, ["render", "--preset", "A5", "--pages", "4", str(tmp_path / "out2.tex")]
    )
    assert r.exit_code == 0, r.output
    tex2 = (tmp_path / "out2.tex").read_text()
    assert "definecolor{c" not in tex2  # no special colors at all
    assert r"\draw (35,10) -- (35,200);" not in tex2

    # dot grid: dots on, lines off (all off by default, explicit --dots)
    runner.invoke(main, ["lines", "--reset", "--dots", "--dot-spacing", "8"])
    r = runner.invoke(
        main, ["render", "--preset", "A5", "--pages", "4", str(tmp_path / "out3.tex")]
    )
    assert r.exit_code == 0, r.output
    tex3 = (tmp_path / "out3.tex").read_text()
    assert "\\draw" not in tex3
    assert "circle (" in tex3

    # dots configured but --no-dots -> no circles
    runner.invoke(main, ["lines", "--reset", "--no-dots", "--dot-spacing", "8"])
    r = runner.invoke(
        main, ["render", "--preset", "A5", "--pages", "4", str(tmp_path / "out4.tex")]
    )
    assert r.exit_code == 0, r.output
    assert "circle (" not in (tmp_path / "out4.tex").read_text()

    # `lines` with no args: margin_x alone is inert (no color -> nothing drawn)
    r = runner.invoke(main, ["lines"])
    assert r.exit_code == 0
    r = runner.invoke(
        main,
        [
            "render",
            "--preset",
            "A5",
            "--pages",
            "1",
            "--page-number-font",
            r"\rmfamily",
            "--binding-text",
            "wm",
            "--binding-text-font",
            r"\ttfamily",
            str(tmp_path / "fonts.tex"),
        ],
    )
    assert r.exit_code == 0, r.output
    tex = (tmp_path / "fonts.tex").read_text()
    assert r"font={\rmfamily\fontsize" in tex
    assert r"font={\ttfamily\fontsize" in tex


def test_header_dates_use_babel_locale_and_format(tmp_path):
    runner = CliRunner()
    r = runner.invoke(
        main,
        [
            "render",
            "--preset",
            "A5",
            "--pages",
            "1",
            "--header-date-range",
            "2026-09",
            "2026-09",
            str(tmp_path / "dates.tex"),
        ],
    )
    assert r.exit_code == 0, r.output
    assert "2026年9月1日星期二" in (tmp_path / "dates.tex").read_text()

    r = runner.invoke(
        main,
        [
            "render",
            "--preset",
            "A5",
            "--pages",
            "1",
            "--header-date-range",
            "2026年9月",
            "2026-09",
            str(tmp_path / "invalid-dates.tex"),
        ],
    )
    assert r.exit_code != 0


def test_header_date_position_and_size(tmp_path):
    runner = CliRunner()
    r = runner.invoke(
        main,
        [
            "render",
            "--preset",
            "A5",
            "--pages",
            "1",
            "--header-date-range",
            "2026-09",
            "2026-09",
            "--header-date-position",
            "binding",
            "--header-date-size",
            "12",
            str(tmp_path / "dates.tex"),
        ],
    )
    assert r.exit_code == 0, r.output
    tex = (tmp_path / "dates.tex").read_text()
    # A5 width 148, binding 15 -> date centered at binding/2 = 7.5mm, header/2 = 5mm
    assert "at (7.5,5) {2026年9月1日星期二}" in tex
    assert r"\fontsize{12}{14.4}" in tex
