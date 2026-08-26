import pytest
from imposition import normal_output
from layout import Rect, geometry_for
from models import (
    ContentPage,
    DocumentSettings,
    PaddingPage,
    PageSettings,
    validate_project,
)
from pages import Text, render_page
from template.basic import BasicPattern, draw, ruled_ys

A5 = PageSettings(
    width=148, height=210, header=10, footer=10, binding=15, non_binding=8
)
RULED = BasicPattern(spacing=8, draw_hlines=True)


def test_parity_mirrors_binding():
    odd = geometry_for(A5, 1)
    even = geometry_for(A5, 2)
    assert odd.content == Rect(15, 10, 125, 190) and odd.binding_side == "left"
    assert even.content == Rect(8, 10, 125, 190) and even.binding_side == "right"


def test_ruled_lines_centered_and_symmetric():
    ys = ruled_ys(geometry_for(A5, 1), 8)  # content 10..200, height 190, center 105
    assert ys[0] == 17  # 105 - 88: keep the 7mm top gap, never stretch spacing
    assert ys[-1] == 193  # 105 + 88: same gap mirrored at the bottom
    assert all(10 <= y <= 200 for y in ys)
    assert 105 in ys and len(ys) % 2 == 1  # center line always present


def test_dot_grid_without_lines():
    lines, dots = draw(
        geometry_for(A5, 1),
        BasicPattern(spacing=8, draw_hlines=False, draw_dots=True, dot_spacing=8),
    )
    assert lines == []
    assert dots and dots[0].y == 17  # same ys as ruled lines would have
    assert dots[0].x == 21.5  # dot_xs: center 77.5, 7 steps of 8


def test_dot_grid_disabled_without_dot_spacing():
    lines, dots = draw(geometry_for(A5, 1), BasicPattern(spacing=8, draw_hlines=False))
    assert lines == [] and dots == []  # blank page is allowed but useless


def test_draw_switches_suppress_independently():
    p = BasicPattern(
        spacing=8,
        draw_hlines=False,
        draw_vlines=False,
        draw_dots=False,
        dot_spacing=8,
        margin_x=20,
        margin_color="#CC0000",
    )
    lines, dots = draw(geometry_for(A5, 1), p)
    assert lines == [] and dots == []

    p = BasicPattern(spacing=8, draw_hlines=True, dot_spacing=8, draw_dots=False)
    lines, dots = draw(geometry_for(A5, 1), p)
    assert lines and dots == []

    p = BasicPattern(spacing=8, margin_x=20, margin_color="#CC0000", draw_vlines=False)
    lines, _ = draw(geometry_for(A5, 1), p)
    assert not any(l.x1 == l.x2 for l in lines)  # margin suppressed


def test_edge_and_center_colors_configurable():
    p = BasicPattern(
        spacing=8,
        draw_hlines=True,
        draw_vlines=True,
        draw_dots=True,
        hline_edge_color="#111111",
        hline_edge_width=0.5,
        vline_spacing=40,
        margin_color="#CC0000",
        vline_edge_color="#222222",
        vline_edge_width=0.5,
        dot_spacing=8,
        dot_center_color="#333333",
    )
    lines, dots = draw(geometry_for(A5, 1), p)
    hs = [l for l in lines if l.y1 == l.y2]
    verts = [l for l in lines if l.x1 == l.x2]
    assert hs[0].color == "#111111" and hs[-1].color == "#111111"  # top/bottom
    assert hs[0].width == 0.5 and hs[-1].width == 0.5
    assert all(l.color is None for l in hs[1:-1])
    assert all(l.width is None for l in hs[1:-1])
    assert verts[0].color == "#222222"  # leftmost vline
    assert verts[0].width == 0.5
    assert all(l.color == "#CC0000" for l in verts[1:])
    center = [d for d in dots if d.x == 77.5 and d.y == 105]
    assert len(center) == 1 and center[0].color == "#333333"
    assert all(d.color is None for d in dots if d is not center[0])


def test_margin_line_requires_both_x_and_color():
    lines, _ = draw(geometry_for(A5, 1), BasicPattern(spacing=8, margin_x=20))
    assert not any(l.x1 == l.x2 for l in lines)  # color unset → no vertical lines
    lines, _ = draw(geometry_for(A5, 1), BasicPattern(spacing=8, vline_spacing=40))
    assert not any(l.x1 == l.x2 for l in lines)  # same without margin_color


def test_french_grid_vertical_lines_every_spacing():
    lines, _ = draw(
        geometry_for(A5, 1),
        BasicPattern(
            spacing=8,
            vline_spacing=40,
            margin_color="#CC0000",
            draw_vlines=True,
            draw_hlines=True,
        ),
    )
    verts = [l for l in lines if l.x1 == l.x2]
    # generated from center: content center 77.5, one 40mm step each side
    assert [l.x1 for l in verts] == [37.5, 77.5, 117.5]
    assert all(l.y1 == 10 and l.y2 == 200 for l in verts)  # full content height
    assert all(l.color == "#CC0000" for l in verts)


def test_grid_starts_after_margin_line():
    lines, _ = draw(
        geometry_for(A5, 1),
        BasicPattern(
            margin_x=15,
            margin_color="#88AEC7",
            vline_spacing=8,
            draw_vlines=True,
        ),
    )
    assert [line.x1 for line in lines if line.x1 == line.x2][:4] == [30, 38, 46, 54]


def test_margin_line_vertical_full_content_height():
    lines, _ = draw(
        geometry_for(A5, 1),
        BasicPattern(
            spacing=8,
            margin_x=20,
            margin_color="#CC0000",
            draw_vlines=True,
            draw_hlines=True,
        ),
    )
    (margin,) = [l for l in lines if l.x1 == l.x2]
    assert margin.x1 == margin.x2 == 35  # content x=15 + 20
    assert margin.y1 == 10 and margin.y2 == 200  # full content height
    assert margin.color == "#CC0000"


def test_page_number_belongs_to_logical_page():
    d = render_page(A5, RULED, ContentPage(17), show_page_number=True)
    (t,) = d.texts
    assert t.content == "17"
    assert t.x == 74 and t.y == 205  # centered in footer: w/2, h - footer/2
    assert render_page(A5, RULED, ContentPage(17), show_page_number=False).texts == []


def test_page_number_and_binding_fonts():
    d = render_page(
        A5,
        RULED,
        ContentPage(17),
        True,
        "watermark",
        page_number_font=r"\rmfamily",
        binding_text_font=r"\ttfamily",
    )
    assert d.texts[0].font == r"\rmfamily"
    assert d.texts[1].font == r"\ttfamily"

    odd = render_page(A5, RULED, ContentPage(1), False, "base-6")
    even = render_page(A5, RULED, ContentPage(2), False, "base-6")
    assert odd.texts == [Text(7.5, 105, "base-6", rotation=90)]
    assert even.texts == [Text(140.5, 105, "base-6", rotation=90)]
    assert render_page(A5, RULED, PaddingPage(), False, "base-6").texts == []


def test_binding_text_supports_two_lines_and_sizes():
    d = render_page(
        A5,
        RULED,
        ContentPage(1),
        False,
        "top",
        "bottom",
        10,
        6,
        12,
    )
    assert d.texts == [
        Text(1.5, 105, "top", size_pt=10, rotation=90),
        Text(13.5, 105, "bottom", size_pt=6, rotation=90),
    ]


def test_binding_text_spacing_validation():
    with pytest.raises(ValueError, match="binding_text_size"):
        DocumentSettings(binding_text_size=0)
    with pytest.raises(ValueError, match="binding_text_spacing"):
        DocumentSettings(binding_text_spacing=-1)


def test_normal_output_one_page_per_logical():
    out = normal_output(A5, RULED, DocumentSettings(page_count=30))
    assert len(out) == 30
    assert all(
        o.width == 148 and o.height == 210 and len(o.placements) == 1 for o in out
    )
    assert out[16].placements[0].draw.texts[0].content == "17"


def test_dots_on_lines_centered_symmetric():
    d = render_page(
        A5,
        BasicPattern(spacing=8, draw_hlines=True, draw_dots=True, dot_spacing=5),
        ContentPage(1),
        True,
    )
    xs = sorted({dot.x for dot in d.dots})
    center = 15 + 125 / 2  # 77.5
    assert center in xs and len(xs) % 2 == 1  # first dot at horizontal center
    assert xs[0] == 17.5 and xs[-1] == 137.5  # 12 dots each side, symmetric 5mm gaps
    assert {dot.y for dot in d.dots} == {l.y1 for l in d.lines}  # dots sit on the lines
    assert d.dots[0].radius > 0


def test_no_dots_by_default():
    assert render_page(A5, RULED, ContentPage(1), True).dots == []


def test_validation():
    with pytest.raises(ValueError):
        DocumentSettings(page_count=0)
    with pytest.raises(ValueError):
        DocumentSettings(page_count=501)
    with pytest.raises(ValueError):
        validate_project(
            PageSettings(width=148, height=210, footer=3),
            DocumentSettings(show_page_number=True),
        )  # footer < 5mm
    with pytest.raises(ValueError):
        PageSettings(width=20, height=210, binding=15, non_binding=8)
    with pytest.raises(ValueError):
        BasicPattern(spacing=0)
    with pytest.raises(ValueError):
        BasicPattern(dot_spacing=0)
