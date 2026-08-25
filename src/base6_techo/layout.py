"""Layout engine: PageSettings + logical page number -> PageGeometry.

Coordinates are mm, origin at page top-left, y pointing down —
matching both the TikZ output (y=-1mm) and SVG.

Standard left-bound book: odd pages bind on the left, even pages mirror.
"""

import math
from dataclasses import dataclass
from typing import Literal

from base6_techo.models import PageSettings

Side = Literal["left", "right"]


@dataclass(frozen=True)
class Rect:
    x: float
    y: float
    width: float
    height: float


@dataclass(frozen=True)
class PageGeometry:
    page: Rect
    content: Rect
    binding_side: Side


def geometry_for(page: PageSettings, page_number: int) -> PageGeometry:
    """Geometry for a logical page. Odd page: binding on left; even page: mirrored."""
    binding_side: Side = "left" if page_number % 2 == 1 else "right"
    left = page.binding if binding_side == "left" else page.non_binding
    return PageGeometry(
        page=Rect(0, 0, page.width, page.height),
        content=Rect(
            left,
            page.header,
            page.width - page.binding - page.non_binding,
            page.height - page.header - page.footer,
        ),
        binding_side=binding_side,
    )


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
