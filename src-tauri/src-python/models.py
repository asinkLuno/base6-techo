"""Data model: page / document / print settings.

All user-facing lengths are in mm; font size is in pt.
"""

from dataclasses import dataclass
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

MIN_FOOTER_FOR_PAGE_NUMBER = 5  # mm
MAX_PAGE_COUNT = 500


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
    show_page_number: bool = True
    binding_text: str | None = None
    binding_text_2: str | None = None
    binding_text_size: float = 8
    binding_text_2_size: float = 8
    binding_text_spacing: float = 5
    page_number_font: str = r"\sffamily"
    binding_text_font: str = r"\sffamily"
    header_dates: tuple[date, ...] | None = None
    header_date_format: str | None = None
    header_date_locale: str = "zh_CN"
    header_parity: Literal["odd", "even", "both"] = "both"
    header_date_size: float = 8
    header_date_font: str | None = None  # None -> page_number_font
    header_date_position: Literal["center", "binding", "outer"] = "center"

    def __post_init__(self) -> None:
        if not 1 <= self.page_count <= MAX_PAGE_COUNT:
            raise ValueError(f"page_count must be in 1..{MAX_PAGE_COUNT}")
        for name, v in (
            ("binding_text_size", self.binding_text_size),
            ("binding_text_2_size", self.binding_text_2_size),
        ):
            if v <= 0:
                raise ValueError(f"{name} must be > 0")
        if self.binding_text_spacing < 0:
            raise ValueError("binding_text_spacing must be >= 0")
        if not self.page_number_font.strip() or not self.binding_text_font.strip():
            raise ValueError("font declarations must not be empty")
        if self.header_parity not in ("odd", "even", "both"):
            raise ValueError("header_parity must be odd, even, or both")
        if self.header_date_size <= 0:
            raise ValueError("header_date_size must be > 0")
        if self.header_date_position not in ("center", "binding", "outer"):
            raise ValueError("header_date_position must be center, binding, or outer")
        if self.header_dates is not None:
            if len(self.header_dates) == 0:
                raise ValueError("header_dates must not be empty")
            if len(self.header_dates) != self.page_count:
                raise ValueError(
                    f"header_dates length ({len(self.header_dates)}) must match "
                    f"page_count ({self.page_count})"
                )


def validate_project(page: PageSettings, doc: DocumentSettings) -> None:
    if doc.show_page_number and page.footer < MIN_FOOTER_FOR_PAGE_NUMBER:
        raise ValueError(
            f"页脚高度不足（{page.footer}mm < {MIN_FOOTER_FOR_PAGE_NUMBER}mm），无法打印页码"
        )


@dataclass(frozen=True)
class ContentPage:
    page_number: int


@dataclass(frozen=True)
class PaddingPage:
    """Auto-added blank page to reach a multiple of 4; never shows a page number."""


DocumentPage = ContentPage | PaddingPage


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
    show_page_number: bool = True
    binding_text: str | None = None
    binding_text_2: str | None = None
    binding_text_size: float = 8
    binding_text_2_size: float = 8
    binding_text_spacing: float = 5
    page_number_font: str = r"\sffamily"
    binding_text_font: str = r"\sffamily"
    header_date: date | None = None
    header_date_format: str = "yyyy-MM-dd"
    header_date_locale: str = "zh_CN"
    header_parity: Literal["odd", "even", "both"] = "both"
    header_date_size: float = 8
    header_date_font: str | None = None
    header_date_position: Literal["center", "binding", "outer"] = "center"

    def to_settings(self) -> DocumentSettings:
        header_dates = (
            tuple(self.header_date for _ in range(self.page_count))
            if self.header_date is not None
            else None
        )
        return DocumentSettings(
            page_count=self.page_count,
            show_header=self.show_header,
            show_page_number=self.show_page_number,
            binding_text=self.binding_text,
            binding_text_2=self.binding_text_2,
            binding_text_size=self.binding_text_size,
            binding_text_2_size=self.binding_text_2_size,
            binding_text_spacing=self.binding_text_spacing,
            page_number_font=self.page_number_font,
            binding_text_font=self.binding_text_font,
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
    line_color: str = "#99FFFF"
    dot_color: str = "#99FFFF"
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
    swap: bool = False
    line_color: str = "#7A7A7A"
    line_width: float = 0.4 / (25.4 / 72.27)
    label_size: float = 10.2
    city_name: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    timezone: str | None = None
    daylight_color: str = "#E5B93F"
    night_color: str = "#496A9F"


PatternRequest = Annotated[
    BasicPatternRequest | MidoriPatternRequest | TimelinePatternRequest,
    Field(discriminator="kind"),
]


class RenderSectionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: PageRequest = Field(default_factory=PageRequest)
    document: DocumentRequest = Field(default_factory=DocumentRequest)
    pattern: PatternRequest


class AddPagesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    leading: int = Field(default=0, ge=0)
    trailing: int = Field(default=2, ge=0)


class BindRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["booklet", "thread"] | None = "booklet"
    sheets_per_group: int = Field(default=4, ge=1)


class RunPipelineRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    output: str
    sections: list[RenderSectionRequest] = Field(min_length=1)
    add_pages: AddPagesRequest = Field(default_factory=AddPagesRequest)
    bind: BindRequest = Field(default_factory=BindRequest)
