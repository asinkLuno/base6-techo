from datetime import date

import pytest
from layout import geometry_for
from models import ContentPage, PageSettings
from pages import render_page
from template.timeline import TimelinePattern, draw, page_range

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
    assert odd.texts[0].anchor == even.texts[0].anchor == "north"
    assert odd.texts[-1].anchor == even.texts[-1].anchor == "south"
    assert odd.dots


def test_timeline_colors_daylight_from_header_date_and_location():
    pattern = TimelinePattern(
        latitude=31.23,
        longitude=121.47,
        timezone="Asia/Shanghai",
        daylight_color="#FFFF00",
        night_color="#0000FF",
    )
    lines, _, _ = draw(geometry_for(A5, 1), pattern, date(2025, 6, 21))
    hour_ticks = lines[::2]

    assert hour_ticks[0].color == "#0000FF"
    assert hour_ticks[12].color == "#FFFF00"
    assert hour_ticks[20].color == "#0000FF"


def test_timeline_location_is_all_or_nothing():
    with pytest.raises(ValueError, match="must be set together"):
        TimelinePattern(latitude=31.23)
