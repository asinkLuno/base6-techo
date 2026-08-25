from click.testing import CliRunner

from base6_techo.cli import main


def test_lines_saved_and_used_by_render(tmp_path, monkeypatch):
    monkeypatch.setattr("base6_techo.cli._LINES_FILE", tmp_path / "lines.json")
    runner = CliRunner()
    r = runner.invoke(
        main,
        ["lines", "--spacing", "10", "--line-color", "#112233", "--dot-spacing", "5"],
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

    # `lines` with no args shows the same saved pattern
    r = runner.invoke(main, ["lines"])
    assert r.exit_code == 0
    assert "10mm" in r.output and "#112233" in r.output
