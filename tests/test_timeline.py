from datetime import date
from pathlib import Path

from click.testing import CliRunner

from src.cli import main
from src.models import ContentPage, PageSettings
from src.pages import render_page
from src.timeline import TimelinePattern, page_range

A5 = PageSettings(148, 210, header=10, footer=10, binding=15, non_binding=8)


def test_timeline_range_matches_techo():
    assert page_range(0, 26, 1, False, True) == (0, 26)
    assert page_range(0, 26, 2, False, False) == (0, 13)  # left page: small half
    assert page_range(0, 26, 2, False, True) == (13, 26)  # right page: large half
    assert page_range(0, 26, 2, True, False) == (13, 26)  # swapped
    assert page_range(0, 26, 2, True, True) == (0, 13)


def test_timeline_draws_binding_axis_and_labels():
    pattern = TimelinePattern(pages=2)
    odd = render_page(A5, pattern, ContentPage(1), False)
    even = render_page(A5, pattern, ContentPage(2), False)
    assert odd.lines[0].x1 == 15
    assert even.lines[0].x1 == 133
    assert odd.texts[0].content == "13"
    assert even.texts[0].content == "00"
    assert odd.dots


def test_timeline_leading_blank_participates_in_page_parity():
    with CliRunner().isolated_filesystem():
        result = CliRunner().invoke(
            main,
            [
                "render",
                "--width",
                "148",
                "--height",
                "210",
                "--pages",
                "2",
                "--leading-blank",
                "timeline",
                "timeline.tex",
            ],
        )
        assert result.exit_code == 0
        assert "PDF 3 页" in result.output
        tex = Path("timeline.tex").read_text()
        assert tex.split(r"\end{tikzpicture}", 1)[0].count(r"\draw") == 0
        assert "{00}" in tex.split(r"\end{tikzpicture}", 2)[1]


def test_header_parity_odd_shows_one_date_per_spread():
    # dates are pre-expanded: one entry per page, spread (1,2) shares 09-01
    dates = (date(2026, 9, 1), date(2026, 9, 1), date(2026, 9, 2), date(2026, 9, 2))
    p1 = render_page(
        A5,
        TimelinePattern(),
        ContentPage(1),
        False,
        header_dates=dates,
        header_date_format="yyyy-MM-dd",
        header_parity="odd",
    )
    p2 = render_page(
        A5,
        TimelinePattern(),
        ContentPage(2),
        False,
        header_dates=dates,
        header_date_format="yyyy-MM-dd",
        header_parity="odd",
    )
    p3 = render_page(
        A5,
        TimelinePattern(),
        ContentPage(3),
        False,
        header_dates=dates,
        header_date_format="yyyy-MM-dd",
        header_parity="odd",
    )
    p4 = render_page(
        A5,
        TimelinePattern(),
        ContentPage(4),
        False,
        header_dates=dates,
        header_date_format="yyyy-MM-dd",
        header_parity="odd",
    )
    assert [t.content for t in p1.texts if t.y == 5] == ["2026-09-01"]
    assert [t.content for t in p2.texts if t.y == 5] == []
    assert [t.content for t in p3.texts if t.y == 5] == ["2026-09-02"]
    assert [t.content for t in p4.texts if t.y == 5] == []


def test_header_parity_even_shows_other_page_of_spread():
    dates = (date(2026, 9, 1), date(2026, 9, 1), date(2026, 9, 2), date(2026, 9, 2))
    p2 = render_page(
        A5,
        TimelinePattern(),
        ContentPage(2),
        False,
        header_dates=dates,
        header_date_format="yyyy-MM-dd",
        header_parity="even",
    )
    assert [t.content for t in p2.texts if t.y == 5] == ["2026-09-01"]


def test_header_parity_both_indexes_every_page():
    dates = (date(2026, 9, 1), date(2026, 9, 1), date(2026, 9, 2), date(2026, 9, 2))
    p2 = render_page(
        A5,
        TimelinePattern(),
        ContentPage(2),
        False,
        header_dates=dates,
        header_date_format="yyyy-MM-dd",
        header_parity="both",
    )
    assert [t.content for t in p2.texts if t.y == 5] == ["2026-09-01"]
