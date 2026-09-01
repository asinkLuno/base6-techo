"""SDK 冒烟测试：9 种 pattern 往返、非法输入拒绝、端到端生成 PDF。

运行：`uv run python tests/test_sdk.py`（需先编译 CLI：`cargo build --bin techo-pipeline`）。
"""

import os
from datetime import date

from base6_techo import (
    BunkwanPattern,
    DotsPattern,
    EightPattern,
    GraphPattern,
    GridPattern,
    MidoriPattern,
    MonthPattern,
    RuledPattern,
    SeyesPattern,
    UsRuledPattern,
    PageSettings,
    RenderSectionRequest,
    RunPipelineRequest,
    TimelinePattern,
    TrackerPattern,
    YearPattern,
    generate,
)

CLI = os.environ.get(
    "TECHO_PIPELINE_BIN",
    os.path.join(os.path.dirname(__file__), "..", "..", "target", "debug", "techo-pipeline"),
)

# 1. 每种 pattern 构造 + JSON 往返（含 kind 标签）
patterns = [
    RuledPattern(pages=2),
    DotsPattern(),
    GridPattern(),
    SeyesPattern(),
    UsRuledPattern(),
    BunkwanPattern(),
    EightPattern(start_date=date(2026, 8, 31), end_date=date(2026, 9, 6)),
    GraphPattern(),
    MidoriPattern(),
    MonthPattern(year=2026, month=8),
    TimelinePattern(date=date(2026, 8, 31)),
    TrackerPattern(year=2026, month=8, items=5),
    YearPattern(start="2026-01", end="2026-06"),
]
for p in patterns:
    req = RunPipelineRequest(output="/tmp/x.pdf", sections=[RenderSectionRequest(pattern=p)])
    back = RunPipelineRequest.model_validate_json(req.model_dump_json())
    assert back == req, p.kind
    print(f"  roundtrip ok: {p.kind}")

# 2. 非法输入拒绝
fails = [
    (RuledPattern, {"pages": 0}),
    (RuledPattern, {"color": "red"}),
    (DotsPattern, {"radius": 0}),
    (MonthPattern, {"month": 13}),
    (TimelinePattern, {"start": 5, "end": 3}),
    (TimelinePattern, {"latitude": 30.0}),
    (TimelinePattern, {"timezone": "Not/AZone"}),
    (YearPattern, {"start": "2026-13"}),
    (YearPattern, {"start": "2027-01", "end": "2026-06"}),
    (EightPattern, {"start_date": "2026-09-01", "end_date": "2026-09-06"}),
    (PageSettings, {"binding": 145}),
    (RunPipelineRequest, {"output": "/tmp/x.pdf", "sections": [], "bogus": 1}),
]
for cls, kw in fails:
    try:
        cls(**kw)
        raise AssertionError(f"NOT REJECTED: {cls.__name__} {kw}")
    except Exception:
        print(f"  rejected ok: {cls.__name__} {kw}")

# 3. 端到端：pydantic -> JSON -> CLI -> PDF
req = RunPipelineRequest(
    output="/tmp/sdk-pydantic.pdf",
    sections=[
        RenderSectionRequest(title="月历", pattern=MonthPattern(year=2026, month=8)),
        RenderSectionRequest(title="网格", pattern=GridPattern(pages=2)),
    ],
)
path = generate(req, binary=CLI)
assert os.path.getsize(path) > 0, path
print(f"generated: {path} ({os.path.getsize(path)} bytes)")
print("ALL OK")
