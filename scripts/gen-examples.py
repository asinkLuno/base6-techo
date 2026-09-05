#!/usr/bin/env python3
"""生成基础版式的展示样张。

- 每个版式 × 3 种尺寸（A5 / A6P / A7）
- 首页插空白页，后两页为内容页（构成对页展开）
- 装订侧打印 "base6" 字样
- 把第 2、3 页转成 PNG，用于展示对页
- 生成前清空 examples/ 下的旧产物（保留 ics/ 输入数据）
- 多进程并发生成（默认 CPU 核数，可用 PARALLEL 覆盖）

依赖：target/debug/techo-pipeline（后端 CLI）、pdftoppm、tectonic

用法：
  ./scripts/gen-examples.py                     # 全部基础版式 × 3 尺寸
  ./scripts/gen-examples.py ruled dots          # 只生成指定版式
  ./scripts/gen-examples.py ruled --sizes a5,a7  # 指定版式 + 指定尺寸
  PARALLEL=2 ./scripts/gen-examples.py           # 手动限制并发数
  ./scripts/gen-examples.py --weekly              # 综合周历整本（TN 护照 88×125）
  ./scripts/gen-examples.py --daily               # 一日两页整本（TN 护照 88×125）

输出到 examples/<pattern>-<size>.pdf 与 examples/<pattern>-<size>-p{2,3}.png
"""

import json
import os
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
import calendar
from datetime import date, timedelta

OUT_DIR = "examples"
BIN = "target/debug/techo-pipeline"
FONT = "Sarasa UI SC"              # 装订侧文字字体（系统已装更纱黑体）
BINDING_TEXT = "base6"
RES_DPI = 400                      # 对页图片分辨率（≤150 时 0.2pt 细线被抗锯齿冲淡，看不清）
HOLIDAYS = "examples/ics/holidays-2026.json"

# 尺寸表：名称 -> (宽, 高) mm
SIZES = {
    "a5": (148, 210),
    "a6p": (95, 171),
    "a7": (80, 120),
    "tnp": (88, 125),   # TN 护照
}

DEFAULT_PATTERNS = ["ruled", "dots", "grid", "seyes", "us-ruled", "vertical", "octan-week", "month_graph", "daily_timeline", "month-tracker"]

# 基础版式默认参数（与前端 schema.ts defaults 一致）
PATTERN_PARAMS = {
    "ruled": {"kind": "ruled", "pages": 2, "spacing": 8, "color": "#7a7a7a", "width": 0.2},
    "dots": {"kind": "dots", "pages": 2, "spacing": 5, "column_spacing": 5, "radius": 0.3,
             "color": "#7a7a7a", "center_color": "#000000"},
    "grid": {"kind": "grid", "pages": 2, "spacing": 5, "color": "#7a7a7a", "width": 0.2},
    "seyes": {"kind": "seyes", "pages": 2, "spacing": 8, "margin_line": 7,
              "main_color": "#9db0cf", "main_width": 0.2, "fine_color": "#c5d0e4",
              "fine_width": 0.1, "vline_color": "#c5d0e4", "vline_width": 0.1,
              "margin_color": "#d96a6a", "margin_width": 0.4},
    "us-ruled": {"kind": "us-ruled", "pages": 2, "spacing": 8.7, "rule_color": "#8fb0d8",
                 "rule_width": 0.2, "margin_x": 25, "margin_color": "#d96a6a",
                 "margin_width": 0.4},
    "vertical": {"kind": "vertical", "pages": 2, "spacing": 10, "color": "#000000",
                 "frame_outer_width": 0.5, "frame_inner_width": 0.18, "frame_gap": 1.2},
    "daily_timeline": {"kind": "daily_timeline", "start": 0, "end": 24, "pages": 1,
                        "line_color": "#7a7a7a", "line_width": 0.4, "label_size": 10.2,
                        "start_date": "2026-08-31", "end_date": "2026-09-06",
                        "latitude": 31.23, "longitude": 121.47, "timezone": "Asia/Shanghai",
                        "title_format": "%Y年%-m月%-d日"},
    "octan-week": {"kind": "八分周视图", "start_date": "2026-08-31", "end_date": "2026-09-06",
                   "date_format": "%-d", "date_locale": "zh-CN", "weekday_lang": "zh",
                   "title_format": "%Y年%-m月", "weekday_headers": "一,二,三,四,五,六,日",
                   "line_color": "#7a7a7a", "line_width": 0.4, "line_style": "solid",
                   "center_gap": 2, "date_size": 10},
    "hogen": {"kind": "方眼罫", "pages": 2, "line_color": "#a9d1ae"},
    "month-tracker": {"kind": "month-tracker", "year": 2026, "month": 9, "items": 4,
                         "line_color": "#7a7a7a", "line_width": 0.4, "date_size": 8},
    "hakubunkan-toyo-nikki": {"kind": "hakubunkan-toyo-nikki", "start_date": "2026-09-01",
                              "end_date": "2026-09-02", "date_format": "%-m月%-d日",
                              "line_color": "#a9d1ae", "line_width": 0.8},
    "hakubunkan-kaichu-nikki": {"kind": "hakubunkan-kaichu-nikki", "start_date": "2026-09-01",
                                "end_date": "2026-09-04", "date_format": "%-m 月  %-d 日",
                                "date_locale": "zh-CN",
                                "weekday_headers": "月,火,水,木,金,土,日",
                                "lunar_style": "numeric", "line_color": "#7a7a7a",
                                "line_width": 0.4, "date_size": 10},
}

# 装订水印颜色：日记 / 方眼罫用主线玉色，其余保持空（后端缺省灰）。
WATERMARK_COLOR = {"hakubunkan-toyo-nikki": "#a9d1ae", "hogen": "#a9d1ae"}

# month_graph 纵轴预设：睡眠（22→32，32=次日 8 点）/ 体重（60→70）。
MONTH_GRAPH_PRESETS = {
    "sleep":  {"title": "睡眠追踪", "y_min": 22, "y_max": 32, "y_steps": 5},
    "weight": {"title": "体重追踪", "y_min": 60, "y_max": 70, "y_steps": 5},
}

def margins(w, h):
    """按纸张尺寸算谐和页边距 (mm)：装订=宽×9%（≥8），非装订=宽×12%（≥7），
    页头=高×7%（≥6），页脚=高×9%（≥8）。"""
    return (
        int(max(8, w * 0.09 + 0.5)),
        int(max(7, w * 0.12 + 0.5)),
        int(max(6, h * 0.07 + 0.5)),
        int(max(8, h * 0.09 + 0.5)),
    )


def doc_obj(width, height):
    return {
        "binding_text": BINDING_TEXT,
        "binding_text_font": FONT,
    }


def page_obj(width, height):
    binding, non_binding, header, footer = margins(width, height)
    return {"width": width, "height": height, "header": header,
            "footer": footer, "binding": binding, "non_binding": non_binding}


def request(out_path, sections):
    return {"output": out_path,
            "bind": {"mode": None, "sheets_per_group": 4},
            "sections": sections}


def blank_section(width, height):
    return {"title": "空白页", "page": page_obj(width, height),
            "document": doc_obj(width, height),
            "pattern": {"kind": "blank", "pages": 1}}


def basic_request(kind, width, height, size):
    """基础版式：空白首页 + 1 个内容页。返回 JSON dict。"""
    wc = WATERMARK_COLOR.get(kind)
    doc = doc_obj(width, height)
    if wc:
        doc["binding_text_color"] = wc
    return request(
        f"{OUT_DIR}/{kind}/{size}/{kind}-{size}.pdf",
        [blank_section(width, height),
         {"title": kind, "page": page_obj(width, height), "document": doc,
          "pattern": PATTERN_PARAMS[kind]}],
    )


def month_graph_request(kind, width, height, size, variant):
    """month_graph：空白首叶 + 内容页（纵轴按预设 range）。"""
    pat = {"kind": "month_graph", "axis": "right",
           "line_color": "#7a7a7a", "line_width": 0.2, "date_size": 8}
    pat.update({k: MONTH_GRAPH_PRESETS[variant][k] for k in ("y_min", "y_max", "y_steps")})
    return request(
        f"{OUT_DIR}/{kind}/{size}/{kind}-{size}-{variant}.pdf",
        [blank_section(width, height),
         {"title": MONTH_GRAPH_PRESETS[variant]["title"],
          "page": page_obj(width, height), "document": doc_obj(width, height),
          "pattern": pat}],
    )



def calendar_pattern(kind, size, variant):
    if kind == "month-calendar":
        mpat = {"kind": "month-calendar", "phase_color": "#e5b93f", "line_color": "#7a7a7a",
                "line_width": 0.4, "date_size": 8, "weekday_headers": "一,二,三,四,五,六,日",
                "title_format": "%Y年%-m月", "sub_size": 4.2, "sub_gap": 0}
        mpat["two_page"] = (size == "a7")
        mpat["year"], mpat["month"] = 2026, 1
    elif kind == "year-calendar":
        rows, cols = (3, 2) if size == "a7" else (3, 4)
        mpat = {"kind": "year-calendar", "start": "2026-01", "end": "2026-12",
                "rows": rows, "cols": cols, "date_size": 6, "weekday_lang": "zh",
                "title_format": "%Y年%-m月", "weekday_headers": "一,二,三,四,五,六,日"}
    elif kind == "year-tracker":
        mpat = {"kind": "year-tracker", "start": "2026-01", "end": "2026-12",
                "two_page": (size == "a7"), "line_color": "#7a7a7a",
                "line_width": 0.4, "date_size": 8}
    else:
        raise ValueError(f"unknown calendar kind: {kind}")

    if kind != "year-tracker":
        mpat["show_holidays"] = (variant == "holiday")
        mpat["lunar"] = (variant == "holiday")
    return mpat


def calendar_request(kind, width, height, size, variant):
    """月历/年历/年度追踪：空白首叶 + 内容页。返回 JSON dict。

    holidays 是 section 级字段（后端 RenderSectionRequest），不在 pattern 内。"""
    base = f"{kind}-{size}" if kind == "year-tracker" else f"{kind}-{size}-{variant}"
    section = {"title": kind, "page": page_obj(width, height),
               "document": doc_obj(width, height),
               "pattern": calendar_pattern(kind, size, variant)}
    if variant == "holiday":
        with open(HOLIDAYS) as f:
            section["holidays"] = json.load(f)
    sections = [blank_section(width, height), section]
    return request(f"{OUT_DIR}/{kind}/{size}/{base}.pdf", sections)

def _month_span(year, month):
    """返回 (起周一, 止周日) 覆盖该月的整个礼拜。"""
    first = date(year, month, 1)
    last = date(year, month, calendar.monthrange(year, month)[1])
    start = first - timedelta(days=first.weekday())
    end = last + timedelta(days=(6 - last.weekday()))
    return start.isoformat(), end.isoformat()


def weekly_composite_request(width, height):
    """综合周历样张（TN 护照 88×125）：空白页 + 双页 2026 年历（带农历/节假日）
    + 12 个月，每月依次[单页月历、单页月打卡、本月八分周视图]。"""
    with open(HOLIDAYS) as f:
        holidays = json.load(f)
    doc = doc_obj(width, height)
    page = page_obj(width, height)
    sections = [blank_section(width, height)]

    # 双页 2026 年历：3×2 个月/页 → 12 个月 = 2 页
    sections.append({
        "title": "2026 年历",
        "page": page, "document": doc, "holidays": holidays,
        "pattern": {"kind": "year-calendar", "start": "2026-01", "end": "2026-12",
                    "rows": 3, "cols": 2, "date_size": 5, "weekday_lang": "zh",
                    "title_format": "%Y年%-m月", "weekday_headers": "一,二,三,四,五,六,日",
                    "show_holidays": True, "lunar": True},
    })

    for y, m in ((2026, mm) for mm in range(1, 13)):
        # 单页月历
        sections.append({
            "title": f"{y}年{m}月", "page": page, "document": doc, "holidays": holidays,
            "pattern": {"kind": "month-calendar", "year": y, "month": m, "two_page": False,
                        "phase_color": "#e5b93f", "line_color": "#7a7a7a", "line_width": 0.4,
                        "date_size": 6, "weekday_headers": "一,二,三,四,五,六,日",
                        "title_format": "%Y年%-m月", "sub_size": 3.4, "sub_gap": 0,
                        "show_holidays": True, "lunar": True},
        })
        # 单页月打卡
        sections.append({
            "title": f"{y}年{m}月 打卡", "page": page, "document": doc,
            "pattern": {"kind": "month-tracker", "year": y, "month": m, "items": 4,
                        "line_color": "#7a7a7a", "line_width": 0.4, "date_size": 5.5},
        })
        # 本月八分周视图
        start, end = _month_span(y, m)
        sections.append({
            "title": f"{y}年{m}月 周视图", "page": page, "document": doc,
            "pattern": {"kind": "八分周视图", "start_date": start, "end_date": end,
                        "date_format": "%-d", "date_locale": "zh-CN", "weekday_lang": "zh",
                        "title_format": "%Y年%-m月", "weekday_headers": "一,二,三,四,五,六,日",
                        "line_color": "#7a7a7a", "line_width": 0.4, "line_style": "solid",
                        "center_gap": 2, "date_size": 6, "lunar": True},
        })

    return request(f"{OUT_DIR}/weekly/weekly-2026.pdf", sections)


def daily_composite_request(width, height):
    """一日两页整本（TN 护照）：空白页 + 双页年历 + 12 个月[月历、月打卡]，
    全本每天 = daily_timeline 两页对页。"""
    with open(HOLIDAYS) as f:
        holidays = json.load(f)
    doc = doc_obj(width, height)
    page = page_obj(width, height)
    sections = [blank_section(width, height)]

    # 双页 2026 年历：3×2 个月/页 → 12 个月 = 2 页
    sections.append({
        "title": "2026 年历",
        "page": page, "document": doc, "holidays": holidays,
        "pattern": {"kind": "year-calendar", "start": "2026-01", "end": "2026-12",
                    "rows": 3, "cols": 2, "date_size": 5, "weekday_lang": "zh",
                    "title_format": "%Y年%-m月", "weekday_headers": "一,二,三,四,五,六,日",
                    "show_holidays": True, "lunar": True},
    })

    for y, m in ((2026, mm) for mm in range(1, 13)):
        sections.append({
            "title": f"{y}年{m}月", "page": page, "document": doc, "holidays": holidays,
            "pattern": {"kind": "month-calendar", "year": y, "month": m, "two_page": False,
                        "phase_color": "#e5b93f", "line_color": "#7a7a7a", "line_width": 0.4,
                        "date_size": 6, "weekday_headers": "一,二,三,四,五,六,日",
                        "title_format": "%Y年%-m月", "sub_size": 3.4, "sub_gap": 0,
                        "show_holidays": True, "lunar": True},
        })
        sections.append({
            "title": f"{y}年{m}月 打卡", "page": page, "document": doc,
            "pattern": {"kind": "month-tracker", "year": y, "month": m, "items": 4,
                        "line_color": "#7a7a7a", "line_width": 0.4, "date_size": 5.5},
        })
        # 本月每天：daily_timeline 两页对页
        first = date(y, m, 1).isoformat()
        last = date(y, m, calendar.monthrange(y, m)[1]).isoformat()
        sections.append({
            "title": f"{y}年{m}月 每日", "page": page, "document": doc,
            "pattern": {"kind": "daily_timeline", "start": 0, "end": 24, "pages": 2,
                        "start_date": first, "end_date": last,
                        "line_color": "#7a7a7a", "line_width": 0.4, "label_size": 8,
                        "latitude": 31.23, "longitude": 121.47, "timezone": "Asia/Shanghai",
                        "title_format": "%Y年%-m月%-d日"},
        })

    return request(f"{OUT_DIR}/daily/daily-2026.pdf", sections)



def build_request(kind, width, height, size, variant=""):
    if kind == "month_graph":
        return month_graph_request(kind, width, height, size, variant)
    if kind in ("month-calendar", "year-calendar", "year-tracker"):
        return calendar_request(kind, width, height, size, variant)
    return basic_request(kind, width, height, size)


def run_task(kind, size, width, height, variant=""):
    """单个任务：生成 JSON → 后端 → pdftoppm，输出到 examples/<kind>/<size>/。"""
    base = f"{kind}-{size}" if (kind == "year-tracker" or not variant) \
        else f"{kind}-{size}-{variant}"
    subdir = f"{OUT_DIR}/{kind}/{size}"
    os.makedirs(subdir, exist_ok=True)
    req = build_request(kind, width, height, size, variant)
    # JSON 保存到版式/尺寸目录下，与 PDF/PNG 同层
    with open(f"{subdir}/{base}.json", "w") as f:
        json.dump(req, f, ensure_ascii=False, indent=2)
    out = f"{subdir}/{base}.pdf"
    proc = subprocess.run([BIN], input=json.dumps(req), text=True,
                          capture_output=True)
    if proc.returncode != 0:
        return f"FAILED {kind} {size} {variant}: {proc.stderr.strip()}"

    # 单页月历/年历/追踪（非 A7）→ 第 1 页 PNG；其余 → 第 2、3 页对页 PNG
    if kind in ("month-calendar", "year-calendar", "year-tracker") and size != "a7":
        subprocess.run(["pdftoppm", "-singlefile", "-f", "1", "-l", "1",
                        "-png", "-r", str(RES_DPI), out, f"{subdir}/{base}"],
                       check=True)
    else:
        subprocess.run(["pdftoppm", "-f", "2", "-l", "3", "-png",
                        "-r", str(RES_DPI), out, f"{subdir}/{base}-p"],
                       check=True)
    return f"    -> {out}"


def clear_cache():
    """清空旧产物缓存（保留 ics/ 输入数据）。"""
    if os.path.isdir(OUT_DIR):
        for name in os.listdir(OUT_DIR):
            if name != "ics":
                shutil.rmtree(os.path.join(OUT_DIR, name), ignore_errors=True)
    os.makedirs(OUT_DIR, exist_ok=True)


def task_list(patterns, sizes):
    """生成任务列表：(kind, size, w, h, variant)。"""
    tasks = []
    for kind in patterns:
        if kind in PATTERN_PARAMS:
            for size in sizes:
                w, h = SIZES[size]
                tasks.append((kind, size, w, h, ""))
        elif kind == "month-calendar" or kind == "year-calendar":
            for size in sizes:
                w, h = SIZES[size]
                for variant in ("plain", "holiday"):
                    tasks.append((kind, size, w, h, variant))
        elif kind == "month_graph":
            for size in sizes:
                w, h = SIZES[size]
                for variant in MONTH_GRAPH_PRESETS:
                    tasks.append((kind, size, w, h, variant))
        elif kind == "year-tracker":
            for size in sizes:
                w, h = SIZES[size]
                tasks.append((kind, size, w, h, ""))
        else:
            sys.exit(f"未知版式: {kind}")
    return tasks


def generate_weekly():
    """生成综合周历样张（TN 护照 88×125），并把代表页转成 PNG 预览。"""
    w, h = SIZES["tnp"]
    req = weekly_composite_request(w, h)
    subdir = f"{OUT_DIR}/weekly"
    os.makedirs(subdir, exist_ok=True)
    with open(f"{subdir}/weekly-2026.json", "w") as f:
        json.dump(req, f, ensure_ascii=False, indent=2)
    out = f"{subdir}/weekly-2026.pdf"
    proc = subprocess.run([BIN], input=json.dumps(req), text=True,
                          capture_output=True)
    if proc.returncode != 0:
        print(f"FAILED weekly: {proc.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    print(f"    -> {out}")
    # 预览：1 月整块（月历 + 月打卡 + 八分周视图 4-5 周）→ 第 4-15 页
    subprocess.run(["pdftoppm", "-f", "4", "-l", "15", "-png",
                    "-r", str(RES_DPI), out, f"{subdir}/weekly-2026-p"],
                   check=True)
    print(f"    -> 预览 {subdir}/weekly-2026-p{{4..15}}.png")


def generate_daily():
    """生成一日两页整本（TN 护照 88×125），并把代表页转成 PNG 预览。"""
    w, h = SIZES["tnp"]
    req = daily_composite_request(w, h)
    subdir = f"{OUT_DIR}/daily"
    os.makedirs(subdir, exist_ok=True)
    with open(f"{subdir}/daily-2026.json", "w") as f:
        json.dump(req, f, ensure_ascii=False, indent=2)
    out = f"{subdir}/daily-2026.pdf"
    proc = subprocess.run([BIN], input=json.dumps(req), text=True,
                          capture_output=True)
    if proc.returncode != 0:
        print(f"FAILED daily: {proc.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    print(f"    -> {out}")
    # 预览：前 5 天的 timeline 两页对页 → 第 6-15 页
    subprocess.run(["pdftoppm", "-f", "6", "-l", "15", "-png",
                    "-r", str(RES_DPI), out, f"{subdir}/daily-2026-p"],
                   check=True)
    print(f"    -> 预览 {subdir}/daily-2026-p{{6..15}}.png")





def main(argv):
    if "--weekly" in argv:
        generate_weekly()
        return
    if "--daily" in argv:
        generate_daily()
        return
    patterns = argv if argv else DEFAULT_PATTERNS
    sizes = [s.strip() for s in os.environ.get("SIZE_ARG", "a5,a6p,a7").split(",")]
    for s in sizes:
        if s not in SIZES:
            sys.exit(f"未知尺寸: {s}")

    parallel = int(os.environ.get("PARALLEL", 4))
    clear_cache()

    tasks = task_list(patterns, sizes)
    print(f"共 {len(tasks)} 个任务，并发 {parallel}")

    failed = []
    with ThreadPoolExecutor(max_workers=parallel) as pool:
        results = pool.map(lambda t: run_task(*t), tasks)
        for res in results:
            if res.startswith("FAILED"):
                failed.append(res)
                print(res, file=sys.stderr)
            else:
                print(res)

    if failed:
        print(f"有 {len(failed)} 个任务失败。", file=sys.stderr)
        sys.exit(1)
    print("完成。")


if __name__ == "__main__":
    main(sys.argv[1:])
