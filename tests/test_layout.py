from typing import cast

import pytest

from base6_techo.imposition import (
    booklet_output,
    booklet_sheets,
    booklet_summary,
    logical_pages,
    normal_output,
    pad_for_booklet,
)
from base6_techo.layout import Rect, geometry_for, ruled_ys
from base6_techo.models import (
    ContentPage,
    DocumentSettings,
    PaddingPage,
    PageSettings,
    RuledPattern,
    validate_project,
)
from base6_techo.pages import dot_xs, render_page

A5 = PageSettings(
    width=148, height=210, header=10, footer=10, binding=15, non_binding=8
)
RULED = RuledPattern(spacing=8)


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


def test_page_number_belongs_to_logical_page():
    d = render_page(A5, RULED, ContentPage(17), show_page_number=True)
    (t,) = d.texts
    assert t.content == "17"
    assert t.x == 74 and t.y == 205  # centered in footer: w/2, h - footer/2
    assert render_page(A5, RULED, ContentPage(17), show_page_number=False).texts == []


def test_padding_pages_are_blank():
    d = render_page(A5, RULED, PaddingPage(), show_page_number=True)
    assert d.lines == [] and d.texts == []


def test_pad_for_booklet_appends_at_end():
    padded = pad_for_booklet(logical_pages(DocumentSettings(page_count=30)))
    assert len(padded) == 32
    assert all(isinstance(p, ContentPage) for p in padded[:30])
    assert all(isinstance(p, PaddingPage) for p in padded[30:])


def test_booklet_sheets_8_pages():
    sheets = booklet_sheets(
        pad_for_booklet(logical_pages(DocumentSettings(page_count=8)))
    )
    assert [
        (
            cast("ContentPage", s.front.left).page_number,
            cast("ContentPage", s.front.right).page_number,
            cast("ContentPage", s.back.left).page_number,
            cast("ContentPage", s.back.right).page_number,
        )
        for s in sheets
    ] == [
        (8, 1, 2, 7),
        (6, 3, 4, 5),
    ]


def test_booklet_30_pages_acceptance():
    doc = DocumentSettings(page_count=30, show_page_number=True)
    assert booklet_summary(doc) == (32, 2, 8, 16)
    sheets = booklet_sheets(pad_for_booklet(logical_pages(doc)))
    # sheet 1 front: padding(32) | 1 ; back: 2 | padding(31)
    assert isinstance(sheets[0].front.left, PaddingPage)
    assert sheets[0].front.right == ContentPage(1)
    assert sheets[0].back.left == ContentPage(2)
    assert isinstance(sheets[0].back.right, PaddingPage)


def test_normal_output_one_page_per_logical():
    out = normal_output(A5, RULED, DocumentSettings(page_count=30))
    assert len(out) == 30
    assert all(
        o.width == 148 and o.height == 210 and len(o.placements) == 1 for o in out
    )
    assert out[16].placements[0].draw.texts[0].content == "17"


def test_booklet_output_size_and_order():
    out = booklet_output(A5, RULED, DocumentSettings(page_count=30))
    assert len(out) == 16  # 8 sheets × front/back
    assert all(
        o.width == 296 and o.height == 210 and len(o.placements) == 2 for o in out
    )
    # front of sheet 1: left half blank (padding), right half is page 1 at dx=148
    assert out[0].placements[0].draw.lines == []
    assert out[0].placements[1].dx == 148
    assert out[0].placements[1].draw.texts[0].content == "1"


def test_dots_on_lines_centered_symmetric():
    d = render_page(A5, RuledPattern(spacing=8, dot_spacing=5), ContentPage(1), True)
    xs = sorted({dot.x for dot in d.dots})
    center = 15 + 125 / 2  # 77.5
    assert center in xs and len(xs) % 2 == 1  # first dot at horizontal center
    assert xs[0] == 17.5 and xs[-1] == 137.5  # 12 dots each side, symmetric 5mm gaps
    assert {dot.y for dot in d.dots} == {l.y1 for l in d.lines}  # dots sit on the lines
    assert all(d.dots[0].radius > 0 for _ in [0])


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
        RuledPattern(spacing=0)
    with pytest.raises(ValueError):
        RuledPattern(dot_spacing=0)
