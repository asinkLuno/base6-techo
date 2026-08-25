"""Binding-edge hour timeline pattern."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

from src.basic import Dot, Line
from src.layout import PageGeometry

if TYPE_CHECKING:
    from src.pages import Text

_HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")
MAX_HOUR = 99
MM_PER_PT = 25.4 / 72.27


def page_range(
    start: int, end: int, pages: int, swap: bool, is_odd: bool
) -> tuple[int, int]:
    """Return the hour range drawn on one page of a spread."""
    if pages == 1:
        return start, end
    midpoint = (start + end) // 2
    first, second = (start, midpoint), (midpoint, end)
    # A spread is even/left then odd/right: earlier hours belong on the left.
    return (
        (second if not is_odd else first) if swap else (first if not is_odd else second)
    )


@dataclass(frozen=True)
class TimelinePattern:
    """Vertical binding-edge hour axis, with optional spread splitting."""

    start: int = 0
    end: int = 26
    pages: int = 1
    swap: bool = False
    line_color: str = "#7A7A7A"
    line_width: float = 0.4 / MM_PER_PT  # 0.4mm, expressed in pt
    label_size: float = 10.2

    def __post_init__(self) -> None:
        if not 0 <= self.start < MAX_HOUR:
            raise ValueError(f"start must be in [0, {MAX_HOUR - 1}]")
        if not self.start < self.end <= MAX_HOUR:
            raise ValueError(f"end must satisfy start < end <= {MAX_HOUR}")
        if self.pages not in (1, 2):
            raise ValueError("pages must be 1 or 2")
        if not _HEX_COLOR.match(self.line_color):
            raise ValueError("line_color must be #RRGGBB")
        if self.line_width <= 0 or self.label_size <= 0:
            raise ValueError("line_width and label_size must be > 0")


def draw(
    geo: PageGeometry, pattern: TimelinePattern
) -> tuple[list[Line], list[Dot], list[Text]]:
    """Draw timeline ticks, half-hour guide dots, and hour labels."""
    from src.pages import Text

    start, end = page_range(
        pattern.start,
        pattern.end,
        pattern.pages,
        pattern.swap,
        geo.binding_side == "left",
    )
    span = end - start
    usable = geo.content.height
    hour_height = usable / span
    axis = (
        geo.content.x
        if geo.binding_side == "left"
        else geo.page.width - (geo.page.width - (geo.content.x + geo.content.width))
    )
    direction = 1 if geo.binding_side == "left" else -1
    extension = geo.page.width * (2 / 3 if geo.binding_side == "left" else 1 / 3)
    tick_width_mm = pattern.line_width * MM_PER_PT
    lines: list[Line] = []
    dots: list[Dot] = []
    texts: list[Text] = []

    for hour in range(start, end + 1):
        y = geo.content.y + (hour - start) / span * usable
        tick_x = axis + direction * 7
        lines.append(Line(axis, y, tick_x, y, None, pattern.line_width))
        dot_count = math.ceil(abs(extension - tick_x) / (hour_height / 2)) - 1
        for index in range(1, max(0, dot_count) + 1):
            dots.append(
                Dot(
                    tick_x + direction * index * hour_height / 2,
                    y,
                    tick_width_mm / 2,
                    None,
                    square=True,
                )
            )
        label_x = axis - direction * 3
        texts.append(
            Text(
                label_x,
                y,
                f"{hour:02d}",
                size_pt=pattern.label_size,
                color=pattern.line_color,
                font="0xProto Nerd Font",
            )
        )
        if hour < end:
            half_y = y + hour_height / 2
            lines.append(
                Line(
                    axis,
                    half_y,
                    axis + direction * 3,
                    half_y,
                    None,
                    pattern.line_width,
                )
            )
    return lines, dots, texts
