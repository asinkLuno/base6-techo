"""Midori pattern: a square grid with hollow intersections.

The grid is centered inside the selected page region.  ``header``/``footer``
and ``inner``/``outer`` extend that region in the same way as ``basic``.
"""

import math
from dataclasses import dataclass

from base6_techo.layout import PageGeometry
from base6_techo.template.basic import _HEX_COLOR, Dot, Line, _region


@dataclass(frozen=True)
class MidoriPattern:
    """Midori's 5 mm grid, independently configurable by page region."""

    spacing: float = 5
    gap: float = 1
    edge_extension: float = 1.2
    dot_frequency: int = 10
    dot_radius: float = 0.4
    line_width: float = 0.7
    line_color: str = "#99FFFF"
    dot_color: str = "#99FFFF"
    header: bool = False
    footer: bool = False
    inner: bool = False
    outer: bool = False

    def __post_init__(self) -> None:
        for name in (
            "spacing",
            "gap",
            "edge_extension",
            "dot_radius",
            "line_width",
        ):
            if getattr(self, name) <= 0:
                raise ValueError(f"{name} must be > 0")
        if self.dot_frequency < 1:
            raise ValueError("dot_frequency must be >= 1")
        for name in ("line_color", "dot_color"):
            if not _HEX_COLOR.match(getattr(self, name)):
                raise ValueError(f"{name} must be #RRGGBB")


def _dot_indices(cells: int, frequency: int) -> set[int]:
    middle = cells // 2
    return {
        index
        for step in range(cells)
        for index in (middle - step * frequency, middle + step * frequency)
        if 0 < index < cells
    }


def draw(geo: PageGeometry, pattern: MidoriPattern) -> tuple[list[Line], list[Dot]]:
    """Draw one centered Midori grid inside the configured page region."""
    region = _region(geo, pattern.header, pattern.footer, pattern.inner, pattern.outer)
    inset = pattern.gap + pattern.edge_extension
    cells_x = max(0, math.floor((region.width - 2 * inset) / pattern.spacing))
    cells_y = max(0, math.floor((region.height - 2 * inset) / pattern.spacing))
    if not cells_x or not cells_y:
        return [], []

    grid_width = cells_x * pattern.spacing
    grid_height = cells_y * pattern.spacing
    start_x = region.x + (region.width - grid_width) / 2
    start_y = region.y + (region.height - grid_height) / 2
    x_dots = _dot_indices(cells_x, pattern.dot_frequency)
    y_dots = _dot_indices(cells_y, pattern.dot_frequency)
    lines: list[Line] = []

    for row in range(cells_y + 1):
        y = start_y + row * pattern.spacing
        lines.append(Line(start_x, y, start_x + grid_width, y))
        if row % 2 == 0 and row not in y_dots and 0 < row < cells_y:
            lines.append(
                Line(
                    start_x - pattern.gap - pattern.edge_extension,
                    y,
                    start_x - pattern.gap,
                    y,
                )
            )
            lines.append(
                Line(
                    start_x + grid_width + pattern.gap,
                    y,
                    start_x + grid_width + pattern.gap + pattern.edge_extension,
                    y,
                )
            )

    for column in range(cells_x + 1):
        x = start_x + column * pattern.spacing
        if column % 2 == 0 and column not in x_dots and 0 < column < cells_x:
            lines.append(
                Line(
                    x,
                    start_y - pattern.gap - pattern.edge_extension,
                    x,
                    start_y - pattern.gap,
                )
            )
            lines.append(
                Line(
                    x,
                    start_y + grid_height + pattern.gap,
                    x,
                    start_y + grid_height + pattern.gap + pattern.edge_extension,
                )
            )
        for row in range(cells_y):
            lines.append(
                Line(
                    x,
                    start_y + row * pattern.spacing + pattern.gap,
                    x,
                    start_y + (row + 1) * pattern.spacing,
                )
            )

    dots: list[Dot] = []
    for column in sorted(x_dots):
        x = start_x + column * pattern.spacing
        dots.extend(
            (
                Dot(x, start_y - 1.5, pattern.dot_radius, pattern.dot_color),
                Dot(
                    x,
                    start_y + grid_height + 1.5,
                    pattern.dot_radius,
                    pattern.dot_color,
                ),
            )
        )
    for row in sorted(y_dots):
        y = start_y + row * pattern.spacing
        dots.extend(
            (
                Dot(start_x - 1.5, y, pattern.dot_radius, pattern.dot_color),
                Dot(
                    start_x + grid_width + 1.5, y, pattern.dot_radius, pattern.dot_color
                ),
            )
        )
    return lines, dots
