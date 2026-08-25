"""Ruled-line pattern (版式): parameters plus how it draws itself.

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


@dataclass(frozen=True)
class Dot:
    x: float
    y: float
    radius: float


@dataclass(frozen=True)
class RuledPattern:
    """Ruled-paper pattern, optionally with dots on the lines.

    spacing/dot_spacing in mm, line_width in pt, line_color as #RRGGBB.
    dot_spacing=None means plain ruled paper."""

    type: str = "ruled"
    spacing: float = 8
    line_width: float = 0.2
    line_color: str = "#B0B0B0"
    dot_spacing: float | None = None
    dot_radius: float = 0.3

    def __post_init__(self) -> None:
        if self.spacing <= 0:
            raise ValueError("spacing must be > 0")
        if self.line_width <= 0:
            raise ValueError("line_width must be > 0")
        if not _HEX_COLOR.match(self.line_color):
            raise ValueError("line_color must be #RRGGBB")
        if self.dot_spacing is not None and self.dot_spacing <= 0:
            raise ValueError("dot_spacing must be > 0")
        if self.dot_radius <= 0:
            raise ValueError("dot_radius must be > 0")


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


def draw(geo: PageGeometry, pattern: RuledPattern) -> tuple[list[Line], list[Dot]]:
    """Generate this pattern's lines/dots for a page geometry."""
    c = geo.content
    lines = [Line(c.x, y, c.x + c.width, y) for y in ruled_ys(geo, pattern.spacing)]
    dots = (
        [
            Dot(x, line.y1, pattern.dot_radius)
            for line in lines
            for x in dot_xs(c, pattern.dot_spacing)
        ]
        if pattern.dot_spacing
        else []
    )
    return lines, dots
