from datetime import date

import pytest
from layout import geometry_for
from models import ContentPage, PageSettings
from pages import render_page
from template.timeline import TimelinePattern, draw, page_range

A5 = PageSettings(148, 210, header=10, footer=10, binding=15, non_binding=8)


def test_timeline_range_matches_techo():
    assert page_range(0, 26, 1, True) == (0, 26)
    assert page_range(0, 26, 2, False) == (0, 13)  # left page: small half
    assert page_range(0, 26, 2, True) == (13, 26)  # right page: large half


def test_timeline_draws_binding_axis_and_labels():
    pattern = TimelinePattern(pages=2)
    odd = render_page(A5, pattern, ContentPage(1))
    even = render_page(A5, pattern, ContentPage(2))
    assert odd.lines[0].x1 == 15
    assert even.lines[0].x1 == 133
    assert odd.texts[0].content == "13"
    assert even.texts[0].content == "00"
    assert all(t.anchor == "center" for t in odd.texts + even.texts)
    assert odd.dots


def test_hours_after_24_roll_to_next_day():
    pattern = TimelinePattern(
        start=0,
        end=29,
        latitude=31.23,
        longitude=121.47,
        timezone="Asia/Shanghai",
        daylight_color="#FFFF00",
        night_color="#0000FF",
    )
    lines, _, _ = draw(geometry_for(A5, 1), pattern, date(2025, 6, 21))
    hour_y = {hour: 10 + hour / 29 * 190 for hour in range(30)}
    color_of = {
        hour: next(
            l.color
            for l in lines
            if l.y1 == hour_y[hour] and round(l.x2 - l.x1, 6) == 7
        )
        for hour in range(30)
    }
    assert color_of[28] == "#0000FF"  # 次日 04:00，日出 04:50 之前
    assert color_of[29] == "#FFFF00"  # 次日 05:00，已日出


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


def test_half_hour_short_lines_carry_the_transition():
    pattern = TimelinePattern(
        latitude=31.23,
        longitude=121.47,
        timezone="Asia/Shanghai",
        daylight_color="#FFFF00",
        night_color="#0000FF",
    )
    lines, dots, _ = draw(geometry_for(A5, 1), pattern, date(2025, 6, 21))
    # 整点长线（7mm）与同行的圆点统一为整点色
    hour_18_y = 10 + 18 / 26 * (210 - 10 - 10)
    (long,) = [l for l in lines if l.y1 == hour_18_y and round(l.x2 - l.x1, 6) == 7]
    row = [d for d in dots if d.y == hour_18_y]
    assert long.color == "#FFFF00"  # 18:00 白天
    assert all(d.color == "#FFFF00" for d in row)  # 行内圆点统一
    # 半点短线（3mm）：18:30 白天、19:30 夜间（日落 ~19:01）
    half_by_y = {round(l.y1, 3): l.color for l in lines if round(l.x2 - l.x1, 6) == 3}
    assert half_by_y[round(10 + 18.5 / 26 * 190, 3)] == "#FFFF00"
    assert half_by_y[round(10 + 19.5 / 26 * 190, 3)] == "#0000FF"


def test_timeline_location_is_all_or_nothing():
    with pytest.raises(ValueError, match="must be set together"):
        TimelinePattern(latitude=31.23)
