#!/usr/bin/env python3
"""生成基础版式的展示样张。

- 每个版式 × 3 种尺寸（A5S / TNP / 67M5）
- 首页插空白页，后两页为内容页（构成对页展开）
- 装订侧打印 "base6" 字样
- 把第 2、3 页转成 PNG，用于展示对页
- 生成前清空 examples/ 下的旧产物（保留 ics/ 输入数据）
- 多进程并发生成（默认 CPU 核数，可用 PARALLEL 覆盖）

依赖：target/debug/techo-pipeline（后端 CLI）、pdftoppm、tectonic

用法：
  ./scripts/gen-examples.py                     # 全部基础版式 × 3 尺寸
  ./scripts/gen-examples.py ruled dots          # 只生成指定版式
  ./scripts/gen-examples.py ruled --sizes a5s,tnp  # 指定版式 + 指定尺寸
  PARALLEL=2 ./scripts/gen-examples.py           # 手动限制并发数
  FONT='Sarasa UI SC' ./scripts/gen-examples.py  # 换装订侧字体（更纱黑体编译极吃内存）
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
# 装订侧/日期文字字体：Sarasa Mono Slab SC（等距更纱黑体 Slab SC，独立 TTF 单文件 ~25MB）。
# 实测单任务（octan-week A5）峰值内存 ~0.55GB、耗时 ~2.4s，与 Noto 同量级。
# 前提：794MB 的 Sarasa-SuperTTC.ttc 必须不在 fontconfig 字体路径里——tectonic 按族名
# 模糊匹配 Sarasa 时会把整个 TTC 解析一遍（实测 ~5.8GB/19s，当初 PARALLEL=4 OOM 即因此）。
# TTC 现移存 ~/.local/share/fonts-disabled/；若恢复它，请改回 FONT='Noto Sans CJK SC'。
FONT = os.environ.get("FONT", "Sarasa Mono Slab SC")
BINDING_TEXT = "base6"
RES_DPI = 400                      # 对页图片分辨率（≤150 时 0.2pt 细线被抗锯齿冲淡，看不清）
HOLIDAYS = "examples/ics/holidays-2026.json"

# 尺寸表：名称 -> (宽, 高) mm
SIZES = {
    "a5s": (110, 210),
    "tnp": (88, 125),
    "67m5": (67, 105),
    "a6p": (95, 171),
}

# 与 showcase/src/data/site.ts 的 GROUPS 全集一致：缺一组，showcase 就有一组裂图
# （showcase Dockerfile 不重建 examples，examples/ 由 compose bind-mount 供给）。
DEFAULT_PATTERNS = ["ruled", "dots", "grid", "seyes", "us-ruled", "vertical",
                    "hogen", "hakubunkan-toyo-nikki", "hakubunkan-kaichu-nikki",
                    "year-calendar", "year-tracker", "month-calendar",
                    "month-tracker", "octan-week", "daily_timeline"]

# 基础版式默认参数（与前端 schema.ts defaults 一致）
PATTERN_PARAMS = {
    "ruled": {"kind": "ruled", "pages": 2, "spacing": 8, "color": "#7a7a7a", "width": 0.2},
    "dots": {"kind": "dots", "pages": 2, "spacing": 5, "column_spacing": 5, "radius": 0.3,
             "color": "#a9d1ae", "center_color": "#8b0000"},
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

# 装订水印颜色：点阵/日记/方眼罫用玉色，其余保持空（后端缺省灰）。
WATERMARK_COLOR = {"dots": "#a9d1ae", "hakubunkan-toyo-nikki": "#a9d1ae", "hogen": "#a9d1ae"}

def margins(w, h):
    """按纸张尺寸算谐和页边距，与 src/lib/schema.ts 的 margins() 完全一致：
    装订=宽×9%（≥8）、非装订=宽×12%（≥7）、页头=高×7%（≥6）、页脚=高×9%（≥8）。
    int(x+0.5) 即 JS 的 Math.round(x)。"""
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


def basic_request(kind, width, height, size, pattern=None):
    """基础版式：空白首页 + 1 个内容页。返回 JSON dict。"""
    wc = WATERMARK_COLOR.get(kind)
    doc = doc_obj(width, height)
    if wc:
        doc["binding_text_color"] = wc
    return request(
        f"{OUT_DIR}/{kind}/{size}/{kind}-{size}.pdf",
        [blank_section(width, height),
         {"title": kind, "page": page_obj(width, height), "document": doc,
          "pattern": pattern or PATTERN_PARAMS[kind]}],
    )



# 年历/月历/年度追踪在 67M5 拆成双页跨页（页面小，单页放不下）。
def calendar_two_page(kind, size):
    return size == "67m5"


def calendar_pattern(kind, size, variant):
    if kind == "month-calendar":
        mpat = {"kind": "month-calendar", "phase_color": "#e5b93f", "line_color": "#7a7a7a",
                "line_width": 0.4, "date_size": 8, "weekday_headers": "一,二,三,四,五,六,日",
                "title_format": "%Y年%-m月", "sub_size": 4.2, "sub_gap": 0}
        mpat["two_page"] = calendar_two_page(kind, size)
        mpat["year"], mpat["month"] = 2026, 1
    elif kind == "year-calendar":
        # 单页 4 行 × 每行 3 个；67M5 双页每页 3×2
        rows, cols = (3, 2) if calendar_two_page(kind, size) else (4, 3)
        mpat = {"kind": "year-calendar", "start": "2026-01", "end": "2026-12",
                "rows": rows, "cols": cols, "date_size": 6, "weekday_lang": "zh",
                "title_format": "%Y年%-m月", "weekday_headers": "一,二,三,四,五,六,日"}
    elif kind == "year-tracker":
        mpat = {"kind": "year-tracker", "start": "2026-01", "end": "2026-12",
                "two_page": calendar_two_page(kind, size), "line_color": "#7a7a7a",
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
    # 双页跨页（67M5 月历/年度追踪）：空白首叶 + 两页内容（渲染第 2、3 页）；
    # 其余单页成张、页面也只展示这一张，不做空白首页。
    sections = ([blank_section(width, height), section]
                if calendar_two_page(kind, size) else [section])
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
    if kind in ("month-calendar", "year-calendar", "year-tracker"):
        return calendar_request(kind, width, height, size, variant)
    if kind == "daily_timeline" and size == "67m5":
        # 67M5 页面小：一日两页，横轴摊开成对页（其余尺寸一日一页，对页为相邻两天）
        pat = dict(PATTERN_PARAMS[kind])
        pat["pages"] = 2
        return basic_request(kind, width, height, size, pat)
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

    # 单页月历/年历/追踪：PDF 只有内容页本身 → 第 1 页 PNG；
    # 67M5 双页跨页与其余对页版式：空白首页 + 内容页 → 第 2、3 页对页 PNG
    if kind in ("month-calendar", "year-calendar", "year-tracker") \
            and not calendar_two_page(kind, size):
        subprocess.run(["pdftoppm", "-singlefile", "-f", "1", "-l", "1",
                        "-png", "-r", str(RES_DPI), out, f"{subdir}/{base}"],
                       check=True)
    else:
        subprocess.run(["pdftoppm", "-f", "2", "-l", "3", "-png",
                        "-r", str(RES_DPI), out, f"{subdir}/{base}-p"],
                       check=True)
        # pdftoppm 补零宽度 = PDF 总页数位数（如时间轴 67M5 一日两页 15 页 →
        # -p-02.png），而 showcase 的对页 URL 固定 1 位（-p-2.png）：
        # 把本次产物统一改回不补零命名，否则旧图残留、页面继续显示旧样张。
        for n in (2, 3):
            final = f"{subdir}/{base}-p-{n}.png"
            for w in (2, 3, 4):
                padded = f"{subdir}/{base}-p-{n:0{w}}.png"
                if os.path.exists(padded):
                    os.replace(padded, final)
                    break
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
        elif kind == "year-tracker":
            for size in sizes:
                w, h = SIZES[size]
                tasks.append((kind, size, w, h, ""))
        else:
            sys.exit(f"未知版式: {kind}")
    return tasks


def pad_preview(prefix, first, last):
    """pdftoppm 补零宽度取决于 PDF 总页数（39 页 → -p-04.png），而 BookFlip 的
    URL 约定固定 3 位（-p-004.png），生成后统一改名对齐。"""
    for n in range(first, last + 1):
        src, dst = f"{prefix}-{n}.png", f"{prefix}-{n:03d}.png"
        if src != dst and os.path.exists(src):
            os.replace(src, dst)


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
    pad_preview(f"{subdir}/weekly-2026-p", 4, 15)
    print(f"    -> 预览 {subdir}/weekly-2026-p{{004..015}}.png")


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
    pad_preview(f"{subdir}/daily-2026-p", 6, 15)
    print(f"    -> 预览 {subdir}/daily-2026-p{{006..015}}.png")


def rebuild_backend():
    """先重新编译后端 CLI，确保生成用的是最新代码。"""
    print('编译后端 techo-pipeline ...')
    proc = subprocess.run(['cargo', 'build'], cwd='src-tauri',
                          capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stderr.strip(), file=sys.stderr)
        sys.exit('后端编译失败')
    print('    -> 编译完成')


def main(argv):
    rebuild_backend()
    if "--weekly" in argv:
        generate_weekly()
        return
    if "--daily" in argv:
        generate_daily()
        return
    patterns = argv if argv else DEFAULT_PATTERNS
    sizes = [s.strip() for s in os.environ.get("SIZE_ARG", "a5s,a6p,tnp,67m5").split(",")]
    for s in sizes:
        if s not in SIZES:
            sys.exit(f"未知尺寸: {s}")

    # 单 worker 峰值 ~0.6GB（tectonic + pdftoppm 400dpi），8 并发 ≈ 5GB，32GB 机器余量充足
    parallel = int(os.environ.get("PARALLEL", 8))
    # 「只生成指定版式」按文档语义只增改所选版式；不带参数的全量运行才清空重建
    if not argv:
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
