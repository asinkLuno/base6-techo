"""Binding-edge hour timeline pattern."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from functools import lru_cache
from typing import TYPE_CHECKING
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from astral import Observer
from astral.sun import elevation, sunrise, sunset
from layout import PageGeometry

from template.basic import Dot, Line

if TYPE_CHECKING:
    from pages import Text

_HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")
MAX_HOUR = 30
MM_PER_PT = 25.4 / 72.27


def page_range(start: int, end: int, pages: int, is_odd: bool) -> tuple[int, int]:
    """Return the hour range drawn on one page of a spread."""
    if pages == 1:
        return start, end
    midpoint = (start + end) // 2
    first, second = (start, midpoint), (midpoint, end)
    # A spread is even/left then odd/right: earlier hours belong on the left.
    return first if not is_odd else second


@dataclass(frozen=True)
class TimelinePattern:
    """Vertical binding-edge hour axis, with optional spread splitting."""

    start: int = 0
    end: int = 26
    pages: int = 1
    line_color: str = "#7A7A7A"
    line_width: float = 0.4 / MM_PER_PT  # 0.4mm, expressed in pt
    label_size: float = 10.2
    city_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    timezone: str | None = None
    daylight_color: str = "#ffd700"
    night_color: str = "#0047ab"

    def __post_init__(self) -> None:
        if not 0 <= self.start < MAX_HOUR:
            raise ValueError(f"start must be in [0, {MAX_HOUR - 1}]")
        if not self.start < self.end <= MAX_HOUR:
            raise ValueError(f"end must satisfy start < end <= {MAX_HOUR}")
        if self.pages not in (1, 2):
            raise ValueError("pages must be 1 or 2")
        for name in ("line_color", "daylight_color", "night_color"):
            if not _HEX_COLOR.match(getattr(self, name)):
                raise ValueError(f"{name} must be #RRGGBB")
        location = (self.latitude, self.longitude, self.timezone)
        if any(value is not None for value in location) and any(
            value is None for value in location
        ):
            raise ValueError("latitude, longitude and timezone must be set together")
        if self.latitude is not None and not -90 <= self.latitude <= 90:
            raise ValueError("latitude must be in [-90, 90]")
        if self.longitude is not None and not -180 <= self.longitude <= 180:
            raise ValueError("longitude must be in [-180, 180]")
        if self.timezone is not None:
            try:
                ZoneInfo(self.timezone)
            except ZoneInfoNotFoundError as error:
                raise ValueError(f"unknown timezone: {self.timezone}") from error
        if self.line_width <= 0 or self.label_size <= 0:
            raise ValueError("line_width and label_size must be > 0")


def draw(
    geo: PageGeometry,
    pattern: TimelinePattern,
    page_date: date | None = None,
    font: str = r"\sffamily",
) -> tuple[list[Line], list[Dot], list[Text]]:
    """Draw timeline ticks, half-hour guide dots, and hour labels."""
    from pages import Text

    start, end = page_range(
        pattern.start,
        pattern.end,
        pattern.pages,
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
        color = _color(pattern, page_date, hour * 60)
        y = geo.content.y + (hour - start) / span * usable
        tick_x = axis + direction * 7
        lines.append(Line(axis, y, tick_x, y, color, pattern.line_width))
        dot_count = math.ceil(abs(extension - tick_x) / (hour_height / 2)) - 1
        for index in range(1, max(0, dot_count) + 1):
            dots.append(
                Dot(
                    tick_x + direction * index * hour_height / 2,
                    y,
                    tick_width_mm / 2,
                    color,
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
                color=color or pattern.line_color,
                font=font,
                anchor="center",
            )
        )
        if hour < end:
            half_color = _color(pattern, page_date, hour * 60 + 30)
            half_y = y + hour_height / 2
            lines.append(
                Line(
                    axis,
                    half_y,
                    axis + direction * 3,
                    half_y,
                    half_color,
                    pattern.line_width,
                )
            )
    return lines, dots, texts


def _color(pattern: TimelinePattern, page_date: date | None, minute: int) -> str | None:
    if (
        page_date is None
        or pattern.latitude is None
        or pattern.longitude is None
        or pattern.timezone is None
    ):
        return None
    moment = datetime.combine(
        page_date, time(), ZoneInfo(pattern.timezone)
    ) + timedelta(minutes=minute)
    return (
        pattern.daylight_color
        if _is_daylight(pattern.latitude, pattern.longitude, moment)
        else pattern.night_color
    )


@lru_cache(maxsize=32)
def _is_daylight(latitude: float, longitude: float, moment: datetime) -> bool:
    observer = Observer(latitude, longitude)
    try:
        return (
            sunrise(observer, moment.date(), moment.tzinfo)
            <= moment
            <= sunset(observer, moment.date(), moment.tzinfo)
        )
    except ValueError:  # polar day/night
        return elevation(observer, moment) > 0
