from base6_techo.models import ContentPage, PageSettings
from base6_techo.pages import render_page
from base6_techo.template.timeline import TimelinePattern, page_range

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
