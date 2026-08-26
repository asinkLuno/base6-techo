"""Data model: page / document / print settings.

All user-facing lengths are in mm; font size is in pt.
"""

import re
from dataclasses import dataclass
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

MIN_FOOTER_FOR_TEXT = 5  # mm
MAX_PAGE_COUNT = 500

_HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")


@dataclass(frozen=True)
class PageSettings:
    """Physical page and reserved areas, all in mm."""

    width: float
    height: float
    header: float = 10
    footer: float = 10
    binding: float = 15
    non_binding: float = 8

    def __post_init__(self) -> None:
        if self.width <= 0 or self.height <= 0:
            raise ValueError("width and height must be > 0")
        for name, v in (
            ("header", self.header),
            ("footer", self.footer),
            ("binding", self.binding),
            ("non_binding", self.non_binding),
        ):
            if v < 0:
                raise ValueError(f"{name} must be >= 0")
        if self.binding + self.non_binding >= self.width:
            raise ValueError("binding + non_binding must be < width")
        if self.header + self.footer >= self.height:
            raise ValueError("header + footer must be < height")


@dataclass(frozen=True)
class DocumentSettings:
    """Whole-notebook settings. page_count = finished usable pages, never sheet count."""

    page_count: int = 32
    show_header: bool = True
    binding_text: str | None = None
    binding_text_2: str | None = None
    binding_text_size: float = 8
    binding_text_2_size: float = 8
    binding_text_spacing: float = 5
    binding_text_edge: float | None = None  # None -> 边距居中
    binding_text_font: str = r"\sffamily"
    binding_text_color: str = "#7a7a7a"
    header_dates: tuple[date | None, ...] | None = None
    header_date_format: str | None = None
    header_date_locale: str = "zh_CN"
    header_parity: Literal["odd", "even", "both"] = "both"
    header_date_size: float = 8
    header_date_font: str | None = None  # None -> \sffamily
    header_date_position: Literal["center", "binding", "outer"] = "center"
    header_text: str | None = None
    header_text_2: str | None = None
    header_text_size: float = 8
    header_text_2_size: float = 8
    header_text_spacing: float = 5
    header_text_color: str = "#7a7a7a"
    non_binding_text: str | None = None
    non_binding_text_2: str | None = None
    non_binding_text_size: float = 8
    non_binding_text_2_size: float = 8
    non_binding_text_spacing: float = 5
    non_binding_text_edge: float | None = None  # None -> 边距居中
    non_binding_text_color: str = "#7a7a7a"
    footer_text: str | None = None
    footer_text_2: str | None = None
    footer_text_size: float = 8
    footer_text_2_size: float = 8
    footer_text_spacing: float = 5
    footer_text_color: str = "#7a7a7a"

    def __post_init__(self) -> None:
        if not 1 <= self.page_count <= MAX_PAGE_COUNT:
            raise ValueError(f"page_count must be in 1..{MAX_PAGE_COUNT}")
        for name, v in (
            ("binding_text_size", self.binding_text_size),
            ("binding_text_2_size", self.binding_text_2_size),
            ("non_binding_text_size", self.non_binding_text_size),
            ("non_binding_text_2_size", self.non_binding_text_2_size),
            ("footer_text_size", self.footer_text_size),
            ("footer_text_2_size", self.footer_text_2_size),
            ("header_text_size", self.header_text_size),
            ("header_text_2_size", self.header_text_2_size),
        ):
            if v <= 0:
                raise ValueError(f"{name} must be > 0")
        if (
            self.binding_text_spacing < 0
            or self.non_binding_text_spacing < 0
            or self.footer_text_spacing < 0
            or self.header_text_spacing < 0
        ):
            raise ValueError("binding_text_spacing must be >= 0")
        if (self.binding_text_edge is not None and self.binding_text_edge < 0) or (
            self.non_binding_text_edge is not None and self.non_binding_text_edge < 0
        ):
            raise ValueError("text edge distance must be >= 0")
        if not self.binding_text_font.strip():
            raise ValueError("binding_text_font must not be empty")
        for name in (
            "binding_text_color",
            "header_text_color",
            "footer_text_color",
            "non_binding_text_color",
        ):
            if not _HEX_COLOR.match(getattr(self, name)):
                raise ValueError(f"{name} must be #RRGGBB")
        if self.header_parity not in ("odd", "even", "both"):
            raise ValueError("header_parity must be odd, even, or both")
        if self.header_date_size <= 0:
            raise ValueError("header_date_size must be > 0")
        if self.header_date_position not in ("center", "binding", "outer"):
            raise ValueError("header_date_position must be center, binding, or outer")
        if self.header_dates is not None:
            if len(self.header_dates) == 0:
                raise ValueError("header_dates must not be empty")
            if len(self.header_dates) > self.page_count:
                raise ValueError(
                    f"header_dates length ({len(self.header_dates)}) must not exceed "
                    f"page_count ({self.page_count})"
                )


def validate_project(page: PageSettings, doc: DocumentSettings) -> None:
    if (doc.footer_text or doc.footer_text_2) and page.footer < MIN_FOOTER_FOR_TEXT:
        raise ValueError(
            f"页脚高度不足（{page.footer}mm < {MIN_FOOTER_FOR_TEXT}mm），无法打印页脚文字"
        )


@dataclass(frozen=True)
class ContentPage:
    page_number: int


class PageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    width: float = 148
    height: float = 210
    header: float = 10
    footer: float = 10
    binding: float = 15
    non_binding: float = 8

    def to_settings(self) -> PageSettings:
        return PageSettings(**self.model_dump())


class DocumentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page_count: int = Field(default=32, ge=1, le=MAX_PAGE_COUNT)
    show_header: bool = True
    binding_text: str | None = None
    binding_text_2: str | None = None
    binding_text_size: float = 8
    binding_text_2_size: float = 8
    binding_text_spacing: float = 5
    binding_text_edge: float | None = Field(default=None, ge=0)
    binding_text_font: str = r"\sffamily"
    binding_text_color: str = "#7a7a7a"
    header_date: date | None = None
    header_date_end: date | None = None
    header_date_format: str = "yyyy-MM-dd"
    header_date_locale: str = "zh_CN"
    header_parity: Literal["odd", "even", "both"] = "both"
    header_date_size: float = 8
    header_date_font: str | None = None
    header_date_position: Literal["center", "binding", "outer"] = "center"
    header_text: str | None = None
    header_text_2: str | None = None
    header_text_size: float = 8
    header_text_2_size: float = 8
    header_text_spacing: float = 5
    header_text_color: str = "#7a7a7a"
    non_binding_text: str | None = None
    non_binding_text_2: str | None = None
    non_binding_text_size: float = 8
    non_binding_text_2_size: float = 8
    non_binding_text_spacing: float = 5
    non_binding_text_edge: float | None = Field(default=None, ge=0)
    non_binding_text_color: str = "#7a7a7a"
    footer_text: str | None = None
    footer_text_2: str | None = None
    footer_text_size: float = 8
    footer_text_2_size: float = 8
    footer_text_spacing: float = 5
    footer_text_color: str = "#7a7a7a"

    @model_validator(mode="after")
    def _end_date_not_before_start(self) -> "DocumentRequest":
        if (
            self.header_date is not None
            and self.header_date_end is not None
            and self.header_date_end < self.header_date
        ):
            raise ValueError("结束日期必须晚于或等于开始日期")
        return self

    def to_settings(self) -> DocumentSettings:
        header_dates = None
        if self.header_date is not None:
            days = (
                max((self.header_date_end - self.header_date).days + 1, 1)
                if self.header_date_end is not None
                else None  # 单日期：每个可见页重复
            )
            # both：一天一页；odd/even：一天一个跨页，两页共享同一天
            arr: list[date | None] = [None] * self.page_count
            if self.header_parity == "both":
                n = self.page_count if days is None else min(days, self.page_count)
                for k in range(n):
                    arr[k] = (
                        self.header_date
                        if days is None
                        else date.fromordinal(self.header_date.toordinal() + k)
                    )
            else:
                n = (
                    self.page_count
                    if days is None
                    else min(days, (self.page_count + 1) // 2)
                )
                for k in range(n):
                    day = (
                        self.header_date
                        if days is None
                        else date.fromordinal(self.header_date.toordinal() + k)
                    )
                    arr[2 * k] = day
                    if 2 * k + 1 < self.page_count:
                        arr[2 * k + 1] = day
            header_dates = tuple(arr)
        return DocumentSettings(
            page_count=self.page_count,
            show_header=self.show_header,
            binding_text=self.binding_text,
            binding_text_2=self.binding_text_2,
            binding_text_size=self.binding_text_size,
            binding_text_2_size=self.binding_text_2_size,
            binding_text_spacing=self.binding_text_spacing,
            binding_text_edge=self.binding_text_edge,
            non_binding_text=self.non_binding_text,
            non_binding_text_2=self.non_binding_text_2,
            non_binding_text_size=self.non_binding_text_size,
            non_binding_text_2_size=self.non_binding_text_2_size,
            non_binding_text_spacing=self.non_binding_text_spacing,
            non_binding_text_edge=self.non_binding_text_edge,
            non_binding_text_color=self.non_binding_text_color,
            footer_text=self.footer_text,
            footer_text_2=self.footer_text_2,
            footer_text_size=self.footer_text_size,
            footer_text_2_size=self.footer_text_2_size,
            footer_text_spacing=self.footer_text_spacing,
            footer_text_color=self.footer_text_color,
            binding_text_font=self.binding_text_font,
            binding_text_color=self.binding_text_color,
            header_text=self.header_text,
            header_text_2=self.header_text_2,
            header_text_size=self.header_text_size,
            header_text_2_size=self.header_text_2_size,
            header_text_spacing=self.header_text_spacing,
            header_text_color=self.header_text_color,
            header_dates=header_dates,
            header_date_format=self.header_date_format if header_dates else None,
            header_date_locale=self.header_date_locale,
            header_parity=self.header_parity,
            header_date_size=self.header_date_size,
            header_date_font=self.header_date_font,
            header_date_position=self.header_date_position,
        )


class BasicPatternRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["basic"] = "basic"
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


class MidoriPatternRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["midori"] = "midori"
    spacing: float = 5
    gap: float = 1
    edge_extension: float = 1.2
    dot_frequency: int = 10
    dot_radius: float = 0.4
    line_width: float = 0.7
    line_color: str = "#a9d1ae"
    dot_color: str = "#a9d1ae"
    header: bool = False
    footer: bool = False
    inner: bool = False
    outer: bool = False


class TimelinePatternRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["timeline"] = "timeline"
    start: int = 0
    end: int = 26
    pages: Literal[1, 2] = 1
    line_color: str = "#7A7A7A"
    line_width: float = 0.4 / (25.4 / 72.27)
    label_size: float = 10.2
    city_name: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    timezone: str | None = None
    daylight_color: str = "#ffd700"
    night_color: str = "#0047ab"


PatternRequest = Annotated[
    BasicPatternRequest | MidoriPatternRequest | TimelinePatternRequest,
    Field(discriminator="kind"),
]


class RenderSectionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: PageRequest = Field(default_factory=PageRequest)
    document: DocumentRequest = Field(default_factory=DocumentRequest)
    pattern: PatternRequest


class BindRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["booklet", "thread"] | None = "booklet"
    sheets_per_group: int = Field(default=4, ge=1)


class RunPipelineRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    output: str
    sections: list[RenderSectionRequest] = Field(min_length=1)
    bind: BindRequest = Field(default_factory=BindRequest)
