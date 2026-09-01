"""前端导出格式（App.tsx 的 Section 状态，如 examples/*.json）→ RunPipelineRequest。

与 src/App.tsx 的 sectionRequest()/bandRequest()/cleanPattern()/patternNames 一一对应；
改动前端导出格式时需同步本文件。
"""

from __future__ import annotations

from typing import Optional

from . import BindRequest, DocumentSettings, PageSettings, RenderSectionRequest, RunPipelineRequest

# 与 App.tsx 的 patternNames 一致（用作 PDF 书签标题）
PATTERN_NAMES = {
    "dots": "点阵",
    "grid": "网格",
    "ruled": "横线",
    "us-ruled": "美式横线",
    "seyes": "法文格",
    "bunkwan": "博文馆当用日历",
    "eight": "八分视图",
    "graph": "制图网格",
    "midori": "Midori",
    "month": "月历",
    "timeline": "时间轴",
    "tracker": "月打卡",
    "year": "年历",
}


def _clean_pattern(pattern: dict) -> dict:
    """cleanPattern：删掉后端不认识的字段。"""
    p = dict(pattern)
    kind = p.get("kind")
    if kind == "bunkwan":
        p.pop("date_size", None)
    elif kind == "timeline":
        for key in ("latitude", "longitude", "timezone", "date"):
            p[key] = p.get(key) or None
    return p


def _band(values: dict, prefix: str, enabled: bool, mode: str) -> dict:
    """bandRequest：页头/页脚带状区域。"""
    text = enabled and mode == "text"
    return {
        "text": (values.get(f"{prefix}_text") or None) if text else None,
        "text_2": (values.get(f"{prefix}_text_2") or None) if text else None,
        "text_size": values[f"{prefix}_text_size"],
        "text_2_size": values[f"{prefix}_text_2_size"],
        "text_spacing": values[f"{prefix}_text_spacing"],
        "text_color": values[f"{prefix}_text_color"],
        "page_number": enabled and mode == "number",
    }


def section_to_request(section: dict, holidays: Optional[dict] = None) -> RenderSectionRequest:
    """单个前端 Section → RenderSectionRequest。"""
    page, doc = section["page"], section["document"]
    return RenderSectionRequest(
        page=PageSettings(
            width=page["width"],
            height=page["height"],
            header=page["header"] if section["headerEnabled"] else 0,
            footer=page["footer"] if section["footerEnabled"] else 0,
            binding=page["binding"] if section["watermarkEnabled"] else 0,
            non_binding=page["non_binding"] if section["nonBindingEnabled"] else 0,
        ),
        document=DocumentSettings(
            page_number=section["pageNumber"],
            header=_band(doc, "header", section["headerEnabled"], section["headerMode"]),
            footer=_band(doc, "footer", section["footerEnabled"], section["footerMode"]),
            binding_text=(doc.get("binding_text") or None) if section["watermarkEnabled"] else None,
            binding_text_2=(doc.get("binding_text_2") or None) if section["watermarkEnabled"] else None,
            binding_text_size=doc["binding_text_size"],
            binding_text_2_size=doc["binding_text_2_size"],
            binding_text_spacing=doc["binding_text_spacing"],
            binding_text_edge=doc["binding_text_edge"],
            binding_text_font=doc["binding_text_font"],
            binding_text_color=doc["binding_text_color"],
            non_binding_text=(doc.get("non_binding_text") or None) if section["nonBindingEnabled"] else None,
            non_binding_text_2=(doc.get("non_binding_text_2") or None) if section["nonBindingEnabled"] else None,
            non_binding_text_size=doc["non_binding_text_size"],
            non_binding_text_2_size=doc["non_binding_text_2_size"],
            non_binding_text_spacing=doc["non_binding_text_spacing"],
            non_binding_text_edge=doc["non_binding_text_edge"],
            non_binding_text_color=doc["non_binding_text_color"],
            lunar=doc["lunar"],
        ),
        title=PATTERN_NAMES[section["pattern"]["kind"]],
        pattern=_clean_pattern(section["pattern"]),
        holidays=holidays,
    )


def state_to_request(state: dict, output: str) -> RunPipelineRequest:
    """前端导出状态（sections/binding/sheetsPerGroup/holidays）→ RunPipelineRequest。"""
    return RunPipelineRequest(
        output=output,
        sections=[section_to_request(s, state.get("holidays")) for s in state["sections"]],
        bind=BindRequest(
            mode=state.get("binding") or None,
            sheets_per_group=state.get("sheetsPerGroup", 4),
        ),
    )
