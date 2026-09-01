"""生成 examples/2027-weekly.json 与 examples/2027-weekly-b6slim.json。

这两个文件是前端导出格式（App.tsx 的 Section 状态，非后端 RunPipelineRequest），
本脚本按同样结构重建，输出与前端 JSON.stringify(obj, null, 2) 逐字节一致（无尾随换行）。

运行：`uv run python scripts/gen_2027_weekly.py`（或直接 python3，仅用标准库）。
"""

import calendar
import json
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXAMPLES = ROOT / "examples"

YEAR = 2027

# 前端默认值（来自 App.tsx 导出的样例；与后端 serde 默认不同，勿混用）
LINE = "#7a7a7a"
LINE_SOFT = "#b0b0b0"


def month_weeks(year: int, month: int) -> tuple[date, date]:
    """该月周视图起止：月初后第一个周一起，到含月末那周的周日止。"""
    first = date(year, month, 1)
    last = date(year, month, calendar.monthrange(year, month)[1])
    start = first + timedelta(days=(0 - first.weekday()) % 7)
    end = last + timedelta(days=6 - last.weekday())
    return start, end


def base_section(
    sid: str, width: int, height: int, *, header=False, footer=True, outer=False, watermark="binding"
) -> dict:
    """空白模式：页眉/页脚/外侧仅保留留白，不印内容。
    watermark：水印文字 base6 印在装订边 binding 或外侧 outer。"""
    return {
        "id": sid,
        "expanded": False,
        "headerEnabled": header,
        "headerMode": "text",
        "footerEnabled": footer,
        "footerMode": "text",
        "pageNumber": True,
        "watermarkEnabled": watermark == "binding",
        "page": {
            "width": width,
            "height": height,
            "header": 10,
            "footer": 10,
            "binding": 15,
            # 外侧水印与装订边同逻辑：留白对称取 15mm（两行落在 5/10mm），
            # 内容区宽度与装订边版本完全一致。
            "non_binding": 15 if watermark == "outer" else 8,
        },
        "document": {
            "binding_text": "base6" if watermark == "binding" else "",
            "binding_text_2": "",
            "binding_text_size": 8,
            "binding_text_2_size": 8,
            "binding_text_spacing": 5,
            "binding_text_edge": None,
            "binding_text_color": LINE,
            "binding_text_font": "0xProto Nerd Font",
            "header_text": "",
            "header_text_2": "",
            "header_text_size": 8,
            "header_text_2_size": 8,
            "header_text_spacing": 5,
            "header_text_color": LINE,
            "footer_text": "",
            "footer_text_2": "",
            "footer_text_size": 8,
            "footer_text_2_size": 8,
            "footer_text_spacing": 5,
            "footer_text_color": LINE,
            "non_binding_text": "base6" if watermark == "outer" else "",
            "non_binding_text_2": "",
            "non_binding_text_size": 8,
            "non_binding_text_2_size": 8,
            "non_binding_text_spacing": 5,
            "non_binding_text_edge": None,
            "non_binding_text_color": LINE,
            "lunar": False,
        },
        "nonBindingEnabled": outer or watermark == "outer",
    }


def basic_pattern() -> dict:
    return {
        "kind": "basic",
        "pages": 2,
        "spacing": 8,
        "line_width": 0.2,
        "line_color": LINE_SOFT,
        "line_style": "solid",
        "draw_hlines": False,
        "draw_vlines": False,
        "draw_dots": False,
        "hline_top_color": LINE_SOFT,
        "hline_top_width": 0.2,
        "hline_top_style": "solid",
        "hline_bottom_color": LINE_SOFT,
        "hline_bottom_width": 0.2,
        "hline_bottom_style": "solid",
        "hline_center_color": LINE_SOFT,
        "hline_center_width": 0.2,
        "hline_center_style": "solid",
        "vline_left_color": LINE_SOFT,
        "vline_left_width": 0.2,
        "vline_left_style": "solid",
        "vline_right_color": LINE_SOFT,
        "vline_right_width": 0.2,
        "vline_right_style": "solid",
        "vline_center_color": LINE_SOFT,
        "vline_center_width": 0.2,
        "vline_center_style": "solid",
        "dot_center_color": LINE_SOFT,
        "hline_header": False,
        "hline_footer": False,
        "hline_inner": False,
        "hline_outer": False,
        "vline_header": False,
        "vline_footer": False,
        "vline_inner": False,
        "vline_outer": False,
        "dot_header": False,
        "dot_footer": False,
        "dot_inner": False,
        "dot_outer": False,
        "dot_spacing": 8,
        "dot_radius": 0.3,
        "vline_spacing": 8,
        "vline_width": 0.2,
        "vline_color": LINE_SOFT,
        "vline_style": "solid",
        "hline_top": 0,
        "hline_bottom": 0,
        "hline_left": 0,
        "hline_right": 0,
        "vline_top": 0,
        "vline_bottom": 0,
        "vline_left": 0,
        "vline_right": 0,
        "dot_top": 0,
        "dot_bottom": 0,
        "dot_left": 0,
        "dot_right": 0,
    }


def month_pattern(year: int, month: int) -> dict:
    return {
        "kind": "month",
        "year": year,
        "month": month,
        "phase_color": "#e5b93f",
        "line_color": LINE,
        "line_width": 0.4,
        "date_size": 8,
        "weekday_lang": "en",
    }


def tracker_pattern(year: int, month: int) -> dict:
    return {
        "kind": "tracker",
        "year": year,
        "month": month,
        "items": 5,
        "line_color": LINE,
        "line_width": 0.4,
        "date_size": 8,
    }


def weeks_pattern(year: int, month: int) -> dict:
    start, end = month_weeks(year, month)
    return {
        "kind": "eight",
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "date_format": "%-d",
        "date_locale": "zh-CN",
        "weekday_lang": "en",
        "line_color": LINE,
        "line_width": 0.4,
        "line_style": "solid",
        "center_gap": 2,
        "date_size": 10,
    }
def year_pattern() -> dict:
    """全年日历：4×3 一页排满 12 个月，表头英文。"""
    return {
        "kind": "year",
        "start": f"{YEAR}-01",
        "end": f"{YEAR}-12",
        "rows": 4,
        "cols": 3,
        "date_size": 6,
        "weekday_lang": "en",
    }

def notebook(
    width: int, height: int, page_size: str, watermark: str = "binding",
    *, cover: bool = True, weekly: bool = True, binding: str | None = None,
) -> dict:
    """cover：空白封面页；weekly：月打卡+八分周视图；binding：None=顺序，booklet=骑马订。"""
    sections = [
        base_section(f"{YEAR}-year", width, height, watermark=watermark) | {"pattern": year_pattern()},  # 最前面：全年日历
    ]
    if cover:
        sections.append(base_section("blank-1", width, height, watermark=watermark) | {"pattern": basic_pattern()})
    for month in range(1, 13):
        mid = f"{YEAR}-{month:02d}"
        # 月视图：页眉/页脚/外侧全开（空白模式）；八分周视图：全关。
        sections.append(
            base_section(f"{mid}-month", width, height, header=True, footer=True, outer=True, watermark=watermark)
            | {"pattern": month_pattern(YEAR, month)}
        )
        if weekly:
            sections.append(base_section(f"{mid}-tracker", width, height, watermark=watermark) | {"pattern": tracker_pattern(YEAR, month)})
            sections.append(
                base_section(f"{mid}-weeks", width, height, header=False, footer=False, outer=False, watermark=watermark)
                | {"pattern": weeks_pattern(YEAR, month)}
            )
    return {
        "sections": sections,
        "binding": binding,  # None=顺序出页；booklet=骑马订；thread=锁线
        "sheetsPerGroup": 4,
        "size": {"width": width, "height": height},
        "pageSize": page_size,
        "holidays": {},
    }


def _check_invariants(year: int) -> None:
    """周视图区间不变量：起为周一、止为周日、覆盖整个月。"""
    for month in range(1, 13):
        start, end = month_weeks(year, month)
        first = date(year, month, 1)
        last = date(year, month, calendar.monthrange(year, month)[1])
        assert start.weekday() == 0 and end.weekday() == 6
        assert start >= first and end >= last
        # start 是月初之后（含当日）的第一个周一
        assert (start - first).days in range(0, 7) and start.weekday() == 0


def _find_cli() -> str:
    """techo-pipeline 二进制：优先 target/release，其次 debug，最后 PATH。"""
    for profile in ("release", "debug"):
        candidate = ROOT / "target" / profile / "techo-pipeline"
        if candidate.is_file():
            return str(candidate)
    return "techo-pipeline"


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="重建 2027 周计划样例 JSON（可选直接生成 PDF）")
    parser.add_argument("--pdf", action="store_true",
                        help="同时生成各尺寸 PDF（需先 cargo build --bin techo-pipeline）")
    args = parser.parse_args()
    _check_invariants(YEAR)
    notebooks = [
        ("2027-weekly.json", 148, 210, "A5", "binding", {}),
        ("2027-weekly-b6slim.json", 98, 176, "B6Slim", "binding", {}),
        ("2027-weekly-a6personal.json", 95, 171, "A6Personal", "binding", {}),
        # A6：无基础版式封面，外侧水印，骑马订。
        ("2027-weekly-a6.json", 105, 148, "A6", "outer", {"cover": False, "binding": "booklet"}),
    ]
    for name, width, height, page_size, watermark, kw in notebooks:
        path = EXAMPLES / name
        path.write_text(json.dumps(notebook(width, height, page_size, watermark, **kw), ensure_ascii=False, indent=2))
    if args.pdf:
        from base6_techo import generate
        from base6_techo.frontend import state_to_request
        for name, *_ in notebooks:
            state = json.loads((EXAMPLES / name).read_text())
            out = EXAMPLES / (Path(name).stem + ".pdf")
            print("generated:", generate(state_to_request(state, output=str(out)), binary=_find_cli()))


if __name__ == "__main__":
    main()
