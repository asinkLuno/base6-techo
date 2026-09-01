"""base6-techo 打印笔记本生成 SDK。

与 `src-tauri/src/backend.rs`（及 `backend/*.rs`）的 serde 类型一一对应，
类似前端的 `src/pipeline-request.generated.ts`：改 Rust 类型时需同步本文件。

约定：
- 每个模型 `extra="forbid"`，对应 Rust 的 `deny_unknown_fields`。
- 字段默认值 = Rust `Default` impl。
- 颜色、数值范围、跨字段约束等廉价校验在本地复刻；
  chrono 日期格式（`validate_date_format`）、页脚高度 vs 页边距等跨结构约束
  仍由 Rust 侧权威校验（CLI 会报错）。
- `generate()` 通过 techo-pipeline CLI 生成 PDF（需已编译，见 AGENTS.md 之外无特殊要求；
  可用环境变量 `TECHO_PIPELINE_BIN` 指定二进制路径）。
"""

from __future__ import annotations

import os
import re
import subprocess
import datetime
from typing import Annotated, Literal, Optional, Union
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, AfterValidator, model_validator

# 与 backend/colors.rs 一致
GRAY = "#7a7a7a"
PHASE_GOLD = "#e5b93f"
TIMELINE_NIGHT = "#496a9f"
BUNKWAN_GREEN = "#31584a"
BUNKWAN_FAINT = "#82968e"
MIDORI_GREEN = "#a9d1ae"

MM_PER_PT = 25.4 / 72.27  # backend.rs

_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
_YM = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def _check_color(v: Optional[str]) -> Optional[str]:
    if v is not None and not _COLOR.fullmatch(v):
        raise ValueError(f"{v} must be #RRGGBB")
    return v


Color = Annotated[str, AfterValidator(_check_color)]
WeekdayLang = Literal["zh", "en", "ja"]
LineStyle = Literal["solid", "dashed", "dotted", "dash-dot", "double-solid"]
BindingMode = Literal["booklet", "thread"]
AxisSide = Literal["right", "left"]


class PageSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    width: float = 148.0
    height: float = 210.0
    header: float = 10.0
    footer: float = 10.0
    binding: float = 15.0
    non_binding: float = 8.0

    @model_validator(mode="after")
    def _check(self) -> "PageSettings":
        if self.width <= 0 or self.height <= 0:
            raise ValueError("width and height must be > 0")
        if min(self.header, self.footer, self.binding, self.non_binding) < 0:
            raise ValueError("page margins must be >= 0")
        if self.binding + self.non_binding >= self.width:
            raise ValueError("binding + non_binding must be < width")
        if self.header + self.footer >= self.height:
            raise ValueError("header + footer must be < height")
        return self


class BandSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: Optional[str] = None
    text_2: Optional[str] = None
    text_size: float = 8.0
    text_2_size: float = 8.0
    text_spacing: float = 5.0
    text_color: Color = GRAY
    page_number: bool = False

    @model_validator(mode="after")
    def _check(self) -> "BandSettings":
        if self.text_size <= 0 or self.text_2_size <= 0:
            raise ValueError("text sizes must be > 0")
        if self.text_spacing < 0:
            raise ValueError("text spacing must be >= 0")
        return self


class DocumentSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page_number: bool = True
    header: BandSettings = Field(default_factory=BandSettings)
    footer: BandSettings = Field(default_factory=BandSettings)
    binding_text: Optional[str] = None
    binding_text_2: Optional[str] = None
    binding_text_size: float = 8.0
    binding_text_2_size: float = 8.0
    binding_text_spacing: float = 5.0
    binding_text_edge: Optional[float] = None
    binding_text_font: str = r"\sffamily"
    binding_text_color: Color = GRAY
    lunar: bool = False
    non_binding_text: Optional[str] = None
    non_binding_text_2: Optional[str] = None
    non_binding_text_size: float = 8.0
    non_binding_text_2_size: float = 8.0
    non_binding_text_spacing: float = 5.0
    non_binding_text_edge: Optional[float] = None
    non_binding_text_color: Color = GRAY

    @model_validator(mode="after")
    def _check(self) -> "DocumentSettings":
        sizes = [
            self.binding_text_size,
            self.binding_text_2_size,
            self.non_binding_text_size,
            self.non_binding_text_2_size,
        ]
        if any(s <= 0 for s in sizes):
            raise ValueError("text sizes must be > 0")
        if min(self.binding_text_spacing, self.non_binding_text_spacing) < 0:
            raise ValueError("text spacing must be >= 0")
        edges = [
            e for e in (self.binding_text_edge, self.non_binding_text_edge) if e is not None
        ]
        if any(e < 0 for e in edges):
            raise ValueError("text edge distance must be >= 0")
        if not self.binding_text_font.strip():
            raise ValueError("binding_text_font must not be empty")
        return self


class RuledPattern(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["ruled"] = "ruled"
    pages: int = Field(default=1, ge=1, le=500)
    spacing: float = Field(default=8.0, gt=0)
    color: Color = GRAY
    width: float = Field(default=0.2, gt=0)


class SeyesPattern(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["seyes"] = "seyes"
    pages: int = Field(default=1, ge=1, le=500)
    spacing: float = Field(default=8.0, gt=0)
    margin_line: int = Field(default=7, ge=0)
    main_color: Color = "#9db0cf"
    main_width: float = Field(default=0.2, gt=0)
    fine_color: Color = "#c5d0e4"
    fine_width: float = Field(default=0.1, gt=0)
    vline_color: Color = "#c5d0e4"
    vline_width: float = Field(default=0.1, gt=0)
    margin_color: Color = "#d96a6a"
    margin_width: float = Field(default=0.4, gt=0)


class UsRuledPattern(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["us-ruled"] = "us-ruled"
    pages: int = Field(default=1, ge=1, le=500)
    spacing: float = Field(default=8.7, gt=0)
    rule_color: Color = "#8fb0d8"
    rule_width: float = Field(default=0.2, gt=0)
    margin_x: float = Field(default=25.0, ge=0)
    margin_color: Color = "#d96a6a"
    margin_width: float = Field(default=0.4, gt=0)


class DotsPattern(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["dots"] = "dots"
    pages: int = Field(default=1, ge=1, le=500)
    spacing: float = Field(default=5.0, gt=0)
    column_spacing: float = Field(default=5.0, gt=0)
    radius: float = Field(default=0.3, gt=0)
    color: Color = GRAY


class GridPattern(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["grid"] = "grid"
    pages: int = Field(default=1, ge=1, le=500)
    spacing: float = Field(default=5.0, gt=0)
    color: Color = GRAY
    width: float = Field(default=0.2, gt=0)


class BunkwanPattern(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["bunkwan"] = "bunkwan"
    line_color: Color = BUNKWAN_GREEN
    faint_color: Color = BUNKWAN_FAINT
    line_width: float = Field(default=0.4, gt=0)


def _current_week() -> tuple[datetime.date, datetime.date]:
    """本周一至周日（对应 Rust EightPattern 的 Default）。"""
    today = datetime.date.today()
    monday = today - datetime.timedelta(days=today.weekday())
    return monday, monday + datetime.timedelta(days=6)


class EightPattern(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["eight"] = "eight"
    start_date: datetime.date = Field(default_factory=lambda: _current_week()[0])
    end_date: datetime.date = Field(default_factory=lambda: _current_week()[1])
    date_format: str = "%-d"
    date_locale: str = "zh-CN"
    weekday_lang: WeekdayLang = "zh"
    line_color: Color = GRAY
    line_width: float = Field(default=0.4, gt=0)
    line_style: LineStyle = "solid"
    center_gap: float = Field(default=2.0, ge=0)
    date_size: float = Field(default=10.0, gt=0)

    @model_validator(mode="after")
    def _check(self) -> "EightPattern":
        if self.end_date < self.start_date:
            raise ValueError("结束日期必须晚于或等于开始日期")
        if self.start_date.weekday() != 0:
            raise ValueError("开始日期必须是星期一")
        if self.end_date.weekday() != 6:
            raise ValueError("结束日期必须是星期日")
        return self


class GraphPattern(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["graph"] = "graph"
    axis: AxisSide = "right"
    line_color: Color = GRAY
    line_width: float = Field(default=0.2, gt=0)
    date_size: float = Field(default=8.0, gt=0)


class MidoriPattern(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["midori"] = "midori"
    spacing: float = Field(default=5.0, gt=0)
    gap: float = Field(default=1.0, gt=0)
    edge_extension: float = Field(default=1.2, gt=0)
    dot_frequency: int = Field(default=10, gt=0)
    dot_radius: float = Field(default=0.4, gt=0)
    line_width: float = Field(default=0.7, gt=0)
    line_color: Color = MIDORI_GREEN
    dot_color: Color = MIDORI_GREEN
    header: bool = False
    footer: bool = False
    inner: bool = False
    outer: bool = False


class MonthPattern(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["month"] = "month"
    year: int = Field(default_factory=lambda: datetime.date.today().year)
    month: int = Field(default_factory=lambda: datetime.date.today().month, ge=1, le=12)
    phase_color: Color = PHASE_GOLD
    line_color: Color = GRAY
    line_width: float = Field(default=0.4, gt=0)
    date_size: float = Field(default=8.0, gt=0)
    weekday_lang: WeekdayLang = "en"
    two_page: bool = False


class TimelinePattern(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["timeline"] = "timeline"
    start: int = Field(default=0, ge=0)
    end: int = Field(default=26, le=30)
    pages: int = Field(default=1)
    line_color: Color = GRAY
    line_width: float = Field(default=0.4 / MM_PER_PT, gt=0)
    label_size: float = Field(default=10.2, gt=0)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = None
    daylight_color: Color = PHASE_GOLD
    night_color: Color = TIMELINE_NIGHT
    date: Optional[datetime.date] = None

    @model_validator(mode="after")
    def _check(self) -> "TimelinePattern":
        if not (0 <= self.start < self.end <= 30):
            raise ValueError("timeline hours must satisfy 0 <= start < end <= 30")
        if self.pages not in (1, 2):
            raise ValueError("pages must be 1 or 2")
        present = [
            self.latitude is not None,
            self.longitude is not None,
            self.timezone is not None,
        ]
        if any(present) and not all(present):
            raise ValueError("latitude, longitude and timezone must be set together")
        if self.latitude is not None and not -90 <= self.latitude <= 90:
            raise ValueError("invalid latitude")
        if self.longitude is not None and not -180 <= self.longitude <= 180:
            raise ValueError("invalid longitude")
        if self.timezone is not None:
            try:
                ZoneInfo(self.timezone)
            except Exception:
                raise ValueError(f"unknown timezone: {self.timezone}")
        return self


class TrackerPattern(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["tracker"] = "tracker"
    year: int = Field(default_factory=lambda: datetime.date.today().year)
    month: int = Field(default_factory=lambda: datetime.date.today().month, ge=1, le=12)
    items: int = Field(default=4, ge=1, le=30)
    line_color: Color = GRAY
    line_width: float = Field(default=0.4, gt=0)
    date_size: float = Field(default=8.0, gt=0)


class YearPattern(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["year"] = "year"
    start: str = Field(default_factory=lambda: f"{datetime.date.today().year}-01")
    end: str = Field(default_factory=lambda: f"{datetime.date.today().year}-12")
    rows: int = Field(default=1, ge=1, le=12)
    cols: int = Field(default=2, ge=1, le=12)
    date_size: float = Field(default=6.0, gt=0)
    weekday_lang: WeekdayLang = "zh"

    @model_validator(mode="after")
    def _check(self) -> "YearPattern":
        for name in ("start", "end"):
            if not _YM.fullmatch(getattr(self, name)):
                raise ValueError(f"{name} 格式应为 YYYY-MM")
        if self.start > self.end:
            raise ValueError("结束月份必须晚于或等于开始月份")
        return self


Pattern = Annotated[
    Union[
        DotsPattern,
        GridPattern,
        BunkwanPattern,
        EightPattern,
        GraphPattern,
        MidoriPattern,
        MonthPattern,
        RuledPattern,
        SeyesPattern,
        UsRuledPattern,
        TimelinePattern,
        TrackerPattern,
        YearPattern,
    ],
    Field(discriminator="kind"),
]


class RenderSectionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: PageSettings = Field(default_factory=PageSettings)
    document: DocumentSettings = Field(default_factory=DocumentSettings)
    pattern: Pattern
    holidays: Optional[dict[str, str]] = None  # "YYYY-MM-DD" -> 节日名
    title: Optional[str] = None


class BindRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Optional[BindingMode] = "booklet"  # 显式传 None 表示不装订
    sheets_per_group: int = Field(default=4, ge=1)


class RunPipelineRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    output: str
    sections: list[RenderSectionRequest] = Field(min_length=1)
    bind: BindRequest = Field(default_factory=BindRequest)


def generate(request: RunPipelineRequest, binary: Optional[str] = None) -> str:
    """生成 PDF 并写入 request.output，返回该路径。

    binary: techo-pipeline 可执行文件；默认取环境变量 `TECHO_PIPELINE_BIN`，
    否则在 PATH 中查找。校验失败或生成失败抛 RuntimeError。
    """
    bin_path = binary or os.environ.get("TECHO_PIPELINE_BIN") or "techo-pipeline"
    proc = subprocess.run(
        [bin_path], input=request.model_dump_json().encode(), capture_output=True
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.decode().strip())
    return proc.stdout.decode().strip()
