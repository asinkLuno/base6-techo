"""Basic pattern (版式): parameters plus how it draws itself.

Every pattern lives in its own module and owns both its parameters and its
drawing logic; the page renderer only dispatches. All lengths are mm except
line_width (pt).
"""

import math
import re
from dataclasses import dataclass

from src.layout import PageGeometry, Rect

_HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")


@dataclass(frozen=True)
class Line:
    x1: float
    y1: float
    x2: float
    y2: float
    color: str | None = None  # None = pattern line color
    width: float | None = None  # None = pattern line width (pt)


@dataclass(frozen=True)
class Dot:
    x: float
    y: float
    radius: float
    color: str | None = None  # None = pattern line color


@dataclass(frozen=True)
class BasicPattern:
    """Basic pattern (版式): independent hlines / vlines / dots switches.

    All switches default OFF: nothing is drawn unless explicitly enabled and
    configured. spacing/dot_spacing/margin_x/vline_spacing in mm, line_width
    in pt, colors as #RRGGBB. Vertical lines need margin_color AND (margin_x
    or vline_spacing); dots need dot_spacing."""

    spacing: float = 8
    line_width: float = 0.2
    line_color: str = "#B0B0B0"
    draw_hlines: bool = False
    draw_vlines: bool = False
    draw_dots: bool = False
    hline_edge_color: str | None = None
    hline_edge_width: float | None = None
    vline_edge_color: str | None = None
    vline_edge_width: float | None = None
    dot_center_color: str | None = None
    hline_header: bool = False
    hline_footer: bool = False
    hline_inner: bool = False
    hline_outer: bool = False
    vline_header: bool = False
    vline_footer: bool = False
    vline_inner: bool = False
    vline_outer: bool = False
    dot_header: bool = False
    dot_footer: bool = False
    dot_inner: bool = False
    dot_outer: bool = False
    dot_spacing: float | None = None
    dot_radius: float = 0.3
    margin_x: float | None = None
    margin_color: str | None = None
    vline_spacing: float | None = None

    def __post_init__(self) -> None:
        for n in ("spacing", "line_width", "dot_radius"):
            if getattr(self, n) <= 0:
                raise ValueError(f"{n} must be > 0")
        for n in (
            "dot_spacing",
            "margin_x",
            "vline_spacing",
            "hline_edge_width",
            "vline_edge_width",
        ):
            v = getattr(self, n)
            if v is not None and v <= 0:
                raise ValueError(f"{n} must be > 0")
        for n in (
            "line_color",
            "margin_color",
            "hline_edge_color",
            "vline_edge_color",
            "dot_center_color",
        ):
            v = getattr(self, n)
            if v is not None and not _HEX_COLOR.match(v):
                raise ValueError(f"{n} must be #RRGGBB")


def ruled_ys(geo: PageGeometry, spacing: float) -> list[float]:
    """Y positions (mm) of ruled lines: first line at the vertical center of the
    content area, spreading up/down by spacing; only fully-inside lines, spacing
    is never rescaled to fill the page."""
    c = geo.content
    center = c.y + c.height / 2
    k = math.floor(c.height / 2 / spacing + 1e-9)
    return [center - i * spacing for i in range(k, 0, -1)] + [
        center + i * spacing for i in range(k + 1)
    ]


def dot_xs(content: Rect, spacing: float) -> list[float]:
    """X positions of dots on a line: first dot at the horizontal center of the
    content area, spreading left/right by spacing; symmetric edge gaps."""
    center = content.x + content.width / 2
    k = math.floor(content.width / 2 / spacing + 1e-9)
    return [center - i * spacing for i in range(k, 0, -1)] + [
        center + i * spacing for i in range(k + 1)
    ]


def _region(
    geo: PageGeometry, header: bool, footer: bool, inner: bool, outer: bool
) -> Rect:
    c = geo.content
    binding_left = geo.binding_side == "left"
    left_to_edge = inner if binding_left else outer
    right_to_edge = outer if binding_left else inner
    left = 0 if left_to_edge else c.x
    right = geo.page.width if right_to_edge else c.x + c.width
    top = 0 if header else c.y
    bottom = geo.page.height if footer else c.y + c.height
    return Rect(left, top, right - left, bottom - top)


def _ys(region: Rect, spacing: float) -> list[float]:
    center = region.y + region.height / 2
    k = math.floor(region.height / 2 / spacing + 1e-9)
    return [center - i * spacing for i in range(k, 0, -1)] + [
        center + i * spacing for i in range(k + 1)
    ]


def _xs(region: Rect, spacing: float) -> list[float]:
    center = region.x + region.width / 2
    k = math.floor(region.width / 2 / spacing + 1e-9)
    return [center - i * spacing for i in range(k, 0, -1)] + [
        center + i * spacing for i in range(k + 1)
    ]


def draw(geo: PageGeometry, pattern: BasicPattern) -> tuple[list[Line], list[Dot]]:
    """Generate each element from the center of its own configured region."""
    c = geo.content
    hregion = _region(
        geo,
        pattern.hline_header,
        pattern.hline_footer,
        pattern.hline_inner,
        pattern.hline_outer,
    )
    vregion = _region(
        geo,
        pattern.vline_header,
        pattern.vline_footer,
        pattern.vline_inner,
        pattern.vline_outer,
    )
    dregion = _region(
        geo,
        pattern.dot_header,
        pattern.dot_footer,
        pattern.dot_inner,
        pattern.dot_outer,
    )
    hys = _ys(hregion, pattern.spacing) if pattern.draw_hlines else []
    dys = (
        _ys(dregion, pattern.spacing)
        if pattern.draw_dots and pattern.dot_spacing
        else []
    )
    lines = []
    if pattern.draw_hlines:
        for i, y in enumerate(hys):
            edge = i in (0, len(hys) - 1)
            color = pattern.hline_edge_color if edge else None
            width = pattern.hline_edge_width if edge else None
            lines.append(Line(hregion.x, y, hregion.x + hregion.width, y, color, width))
    if pattern.draw_vlines:
        top, bottom = vregion.y, vregion.y + vregion.height
        if pattern.margin_x is not None and pattern.margin_color is not None:
            x = c.x + pattern.margin_x
            lines.append(
                Line(
                    x,
                    top,
                    x,
                    bottom,
                    pattern.vline_edge_color or pattern.margin_color,
                    pattern.vline_edge_width,
                )
            )
        if pattern.vline_spacing is not None and pattern.margin_color is not None:
            xs = (
                [
                    c.x + pattern.margin_x + i * pattern.vline_spacing
                    for i in range(
                        1,
                        math.floor(
                            (vregion.x + vregion.width - c.x - pattern.margin_x)
                            / pattern.vline_spacing
                        )
                        + 1,
                    )
                ]
                if pattern.margin_x is not None
                else _xs(vregion, pattern.vline_spacing)
            )
            for i, x in enumerate(xs):
                color = (
                    pattern.vline_edge_color
                    if i == 0 and pattern.margin_x is None
                    else pattern.margin_color
                )
                if color is None:
                    color = pattern.margin_color
                lines.append(
                    Line(
                        x,
                        top,
                        x,
                        bottom,
                        color,
                        pattern.vline_edge_width if i == 0 else None,
                    )
                )
    dots = []
    if pattern.draw_dots and pattern.dot_spacing:
        cx = dregion.x + dregion.width / 2
        cy = dregion.y + dregion.height / 2
        for y in dys:
            for x in _xs(dregion, pattern.dot_spacing):
                color = pattern.dot_center_color if (x == cx and y == cy) else None
                dots.append(Dot(x, y, pattern.dot_radius, color))
    return lines, dots
