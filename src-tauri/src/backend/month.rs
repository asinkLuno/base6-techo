//! 月历 — 移植自 lunar techo 的 senary 月历正面：7 列周一为首的网格
//! （交叉处留 0.2mm 缺口）、左上角日期、右上角照面比例月相方块。

use super::colors::{GRAY, HOLIDAY_RED, PHASE_GOLD};
use chrono::{Datelike, Duration, NaiveDate, TimeZone, Utc, Weekday};
use serde::Deserialize;

use super::{
    Dot, Geometry, HashMap, Line, LineStyle, Poly, Rect, Text, chrono_format, lunar_date,
    validate_color, validate_title_format, validate_weekday_headers,
};

const COLS: usize = 7;
const HEAD_H: f64 = 4.0; // mm，星期表头行高
const PAD: f64 = 0.2; // mm，日期距格边
const GAP: f64 = 0.2; // mm，网格交叉处留白
const MOON_INSET: f64 = 1.0; // mm，月相圆盘离格右上角的留白
pub(crate) const MOON_STEPS: usize = 24; // 圆弧采样数
const SYNODIC: f64 = 29.53058867; // 朔望月（天）

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct MonthPattern {
    pub(crate) year: i32,
    pub(crate) month: u32,
    pub(crate) phase_color: String,
    pub(crate) line_color: String,
    pub(crate) line_width: f64,
    pub(crate) date_size: f64,
    /// 星期表头，英文逗号分隔的 7 项（如 "Mo,Tu,We,Th,Fr,Sa,Su"）。
    pub(crate) weekday_headers: String,
    pub(crate) two_page: bool,
    /// 双页标题（仅第一页标题带），日期格式串，如 "%Y年%-m月"、"%m/%Y"。
    pub(crate) title_format: String,
    /// 显示节假日：关闭后不画节日名、节日与周末都不染红。
    pub(crate) show_holidays: bool,
    /// 农历/节日字号（pt）。
    pub(crate) sub_size: f64,
    pub(crate) sub_gap: f64,
    pub(crate) lunar: bool,
}
impl Default for MonthPattern {
    fn default() -> Self {
        let now = Utc::now();
        Self {
            year: now.year(),
            month: now.month(),
            phase_color: PHASE_GOLD.into(),
            line_color: GRAY.into(),
            line_width: 0.4,
            date_size: 8.0,
            weekday_headers: "Mo,Tu,We,Th,Fr,Sa,Su".into(),
            two_page: false,
            title_format: "%Y年%-m月".into(),
            show_holidays: true,
            sub_size: 4.2,
            sub_gap: 0.0,
            lunar: false,
        }
    }
}
impl MonthPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if !(1..=12).contains(&self.month) {
            return Err("month must be in 1..12".into());
        }
        if self.line_width <= 0.0 || self.date_size <= 0.0 || self.sub_size <= 0.0 {
            return Err("line_width, date_size and sub_size must be > 0".into());
        }
        validate_color(&self.line_color)?;
        validate_weekday_headers(&self.weekday_headers)?;
        // 月历标题不经 format_date 渲染，不支持 %cccc（农历占位）。
        validate_title_format(&self.title_format, "zh-CN", false)?;
        validate_color(&self.phase_color)
    }
}

/// 第 index 页对应的年月（页序依次推进月份）。
fn month_ym(year: i32, month: u32, index: usize) -> (i32, u32) {
    let total = i64::from(year) * 12 + i64::from(month) - 1 + index as i64;
    (total.div_euclid(12) as i32, total.rem_euclid(12) as u32 + 1)
}

/// 以 2000-01-06 18:14 UTC 朔为历元的近似月相：(照面比例 0..1, 是否盈)。
pub(crate) fn moon_illumination(moment: chrono::DateTime<Utc>) -> (f64, bool) {
    let epoch = Utc.with_ymd_and_hms(2000, 1, 6, 18, 14, 0).unwrap();
    let frac = ((moment - epoch).num_seconds() as f64 / 86400.0).rem_euclid(SYNODIC) / SYNODIC;
    (
        (1.0 - (2.0 * std::f64::consts::PI * frac).cos()) / 2.0,
        frac < 0.5,
    )
}

pub(crate) fn draw_month(
    geo: Geometry,
    p: &MonthPattern,
    index: usize,
    font: &str,
    holidays: &Option<HashMap<String, String>>,
) -> (Vec<Line>, Vec<Dot>, Vec<Poly>, Vec<Text>) {
    let mut lines = Vec::new();
    let mut dots = Vec::new();
    let mut paths = Vec::new();
    let mut texts = Vec::new();
    // 未勾选显示节假日时视为无节日表：不画节日名，节日与周末都不染红。
    let holidays = if p.show_holidays { holidays } else { &None };
    // 双页模式：同一月拆两页，页 0 显示周一~周三 3 列，页 1 显示周四~周日 4 列。
    let (cols, off) = if p.two_page {
        if index == 0 { (3, 0) } else { (4, 3) }
    } else {
        (COLS, 0)
    };
    let (year, month) = if p.two_page {
        (p.year, p.month)
    } else {
        month_ym(p.year, p.month, index)
    };
    let Some(first) = NaiveDate::from_ymd_opt(year, month, 1) else {
        return (lines, dots, paths, texts);
    };
    let (ny, nm) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    let Some(next) = NaiveDate::from_ymd_opt(ny, nm, 1) else {
        return (lines, dots, paths, texts);
    };
    let days = (next - first).num_days() as usize;
    let first_weekday = first.weekday().num_days_from_monday() as usize; // 0 = 周一
    let weeks = (first_weekday + days).div_ceil(COLS);

    let r = geo.content;
    // 单页：横放设计（宽沿内容区长边），画完后整体逆时针旋转 90° 落到页面；
    // 双页第一页左侧留一格宽标题带，使两页的星期列始终同宽；
    // 单页也在左侧留 1/8 页宽的标题带。
    let land = if p.two_page {
        if index == 0 {
            let title_w = r.width / 4.0;
            Rect {
                x: r.x + title_w,
                width: r.width - title_w,
                ..r
            }
        } else {
            r
        }
    } else {
        let title_w = r.width / 8.0;
        Rect {
            x: 0.0,
            y: title_w,
            width: r.height,
            height: r.width - title_w,
        }
    };
    let gy = land.y + HEAD_H;
    let cell_h = (land.height - HEAD_H) / weeks as f64;
    let cell_w = land.width / f64::from(cols as u16);
    let grid = |x1, y1, x2, y2| Line {
        x1,
        y1,
        x2,
        y2,
        color: None,
        width: None,
        style: LineStyle::Solid,
    };
    // 竖线按行分段，横线按列分段，交叉处各留 GAP 缺口。
    for i in 0..=cols {
        let x = land.x + cell_w * i as f64;
        for j in 0..weeks {
            let y1 = gy + cell_h * j as f64 + GAP;
            let y2 = gy + cell_h * (j + 1) as f64 - GAP;
            lines.push(grid(x, y1, x, y2));
        }
    }
    for j in 0..=weeks {
        let y = gy + cell_h * j as f64;
        for i in 0..cols {
            let x1 = land.x + cell_w * i as f64 + GAP;
            let x2 = land.x + cell_w * (i + 1) as f64 - GAP;
            lines.push(grid(x1, y, x2, y));
        }
    }
    let headers: Vec<&str> = p.weekday_headers.split(',').map(str::trim).collect();
    for (i, w) in headers[off..off + cols].iter().enumerate() {
        texts.push(Text {
            x: land.x + cell_w * (i as f64 + 0.5),
            y: land.y + HEAD_H / 2.0,
            content: (*w).into(),
            size: p.date_size,
            color: p.line_color.clone(),
            rotation: 0,
            font: font.into(),
            anchor: "center",
        });
    }
    for d in 1..=days {
        let pos = first_weekday + d - 1;
        let gcol = pos % COLS;
        if !(off..off + cols).contains(&gcol) {
            continue;
        }
        let row = (pos / COLS) as f64;
        let col = (gcol - off) as f64;
        let date = first + Duration::days(i64::from(d as u16 - 1));
        let date_key = format!("{}-{:02}-{:02}", date.year(), date.month(), date.day());
        let is_weekend = date.weekday() == Weekday::Sat || date.weekday() == Weekday::Sun;
        let holiday_name = holidays.as_ref().and_then(|h| h.get(&date_key));
        let is_compensatory = holiday_name.is_some_and(|n| n.starts_with("上班"));
        // 未导入 ICS（holidays 为空）时周末不染红。
        let has_holidays = holidays.as_ref().is_some_and(|h| !h.is_empty());
        let is_red = holiday_name.is_some() && !is_compensatory
            || is_weekend && has_holidays && !is_compensatory;
        let text_color = if is_red { HOLIDAY_RED } else { &p.line_color };
        texts.push(Text {
            x: land.x + cell_w * col + PAD,
            y: gy + cell_h * row + PAD,
            content: d.to_string(),
            size: p.date_size,
            color: text_color.to_string(),
            rotation: 0,
            font: font.into(),
            anchor: "north west",
        });
        // 副标签（农历/节日）紧贴数字字面下方：偏移是 mm 坐标而字号是 pt，
        // 实测标定：锚点下移 0.30×字号(mm) 时字面间距 ≈0.3mm（节点内边距+字体
        // ascent 会吃掉约 2mm）；节日行距随农历实际字号伸缩，sub_gap 可再微调。
        let sub_top = gy + cell_h * row + PAD + p.date_size * 0.30 + p.sub_gap;
        // 农历日期：日期数字正下方
        if p.lunar
            && let Some(lunar_str) = lunar_date(date)
        {
            texts.push(Text {
                x: land.x + cell_w * col + PAD,
                y: sub_top,
                content: lunar_str,
                size: p.sub_size,
                color: p.line_color.clone(),
                rotation: 0,
                font: font.into(),
                anchor: "north west",
            });
        }
        // 节日名称：日期数字正下方（调休上班日不显示名称）
        if let Some(name) = holiday_name
            && !is_compensatory
        {
            let holiday_y = sub_top
                + if p.lunar {
                    p.sub_size * 0.36 + p.sub_gap
                } else {
                    0.0
                };
            texts.push(Text {
                x: land.x + cell_w * col + PAD,
                y: holiday_y,
                content: name.clone(),
                size: p.sub_size,
                color: HOLIDAY_RED.to_string(),
                rotation: 0,
                font: font.into(),
                anchor: "north west",
            });
        }
        // 右上角圆形月相：圆盘描边 + 照面多边形（盈相亮面在右，亏相在左）。
        let rx = land.x + cell_w * (col + 1.0) - PAD;
        let ty = gy + cell_h * row + PAD;
        let (illum, waxing) = moon_illumination(date.and_hms_opt(12, 0, 0).unwrap().and_utc());
        // 直径与日期数字同大：字号为 pt，1pt = 25.4/72 mm；圆心离格角收 MOON_INSET。
        let ps = p.date_size * 25.4 / 72.0;
        let cx = rx - ps / 2.0 - MOON_INSET;
        let cy = ty + ps / 2.0 + MOON_INSET;
        let radius = ps / 2.0;
        // 圆弧采样（弧度 start→end）。
        let arc = |start: f64, end: f64| {
            (0..=MOON_STEPS)
                .map(|i| {
                    let phi = start + (end - start) * i as f64 / MOON_STEPS as f64;
                    (cx + radius * phi.cos(), cy + radius * phi.sin())
                })
                .collect::<Vec<_>>()
        };
        // 圆盘描边：用原生 `circle`（单个坐标对），比采样 24 点路径省 TikZ 坐标解析。
        dots.push(Dot {
            x: cx,
            y: cy,
            radius,
            color: Some(p.phase_color.clone()),
            square: false,
            fill: false,
        });
        // 照面区域：亮侧圆弧 + 明暗界线（半短轴 = (1-2×照面)×半径，月牙凸向亮面、凸月凸向暗面）。
        let half_pi = std::f64::consts::FRAC_PI_2;
        let mut lit = arc(-half_pi, half_pi);
        for (x, y) in arc(half_pi, -half_pi) {
            lit.push((cx + (1.0 - 2.0 * illum) * (x - cx), y));
        }
        if !waxing {
            for point in &mut lit {
                point.0 = 2.0 * cx - point.0; // 亏相：亮面镜像到左侧
            }
        }
        paths.push(Poly {
            points: lit,
            color: p.phase_color.clone(),
            fill: true,
            arrow: false,
        });
    }
    if !p.two_page || index == 0 {
        // 双页：页面坐标，旋转 90°；单页：设计坐标（x=页面竖直中线，y=标题带中线），
        // 随末尾整体旋转落到页面左缘竖排。
        let (x, y, rotation) = if p.two_page {
            (r.x + r.width / 8.0, r.y + r.height / 2.0, 90)
        } else {
            (r.height / 2.0, r.width / 16.0, 0)
        };
        texts.push(Text {
            x,
            y,
            content: first.format(&chrono_format(&p.title_format)).to_string(),
            size: p.date_size * 1.5,
            color: p.line_color.clone(),
            rotation,
            font: font.into(),
            anchor: "center",
        });
    }
    // 单页整体逆时针旋转 90°：设计 (x,y) → 页面 (r.x + y, r.y + r.height - x)。
    if !p.two_page {
        let base = r.y + r.height;
        let left = r.x;
        for line in &mut lines {
            let (x1, y1) = (left + line.y1, base - line.x1);
            let (x2, y2) = (left + line.y2, base - line.x2);
            line.x1 = x1;
            line.y1 = y1;
            line.x2 = x2;
            line.y2 = y2;
        }
        for poly in &mut paths {
            for point in &mut poly.points {
                *point = (left + point.1, base - point.0);
            }
        }
        for dot in &mut dots {
            let (x, y) = (left + dot.y, base - dot.x);
            dot.x = x;
            dot.y = y;
        }
        for text in &mut texts {
            let (x, y) = (left + text.y, base - text.x);
            text.x = x;
            text.y = y;
            text.rotation = 90;
        }
    }
    (lines, dots, paths, texts)
}

const A: f64 = 5.5; // mm，打卡单元格边长
const ITEM_W: f64 = 5.0; // 打卡项列宽 = ITEM_W × A
const TRACKER_GAP: f64 = 2.0; // mm，上下两表间距
const TRACKER_UP: f64 = 3.0; // mm，整体上移

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct TrackerPattern {
    pub(crate) year: i32,
    pub(crate) month: u32,
    pub(crate) items: usize,
    pub(crate) line_color: String,
    pub(crate) line_width: f64,
    pub(crate) date_size: f64,
}
impl Default for TrackerPattern {
    fn default() -> Self {
        let now = Utc::now();
        Self {
            year: now.year(),
            month: now.month(),
            items: 4,
            line_color: GRAY.into(),
            line_width: 0.4,
            date_size: 8.0,
        }
    }
}
impl TrackerPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if !(1..=12).contains(&self.month) {
            return Err("month must be in 1..12".into());
        }
        if !(1..=30).contains(&self.items) {
            return Err("items must be in 1..30".into());
        }
        if self.line_width <= 0.0 || self.date_size <= 0.0 {
            return Err("line_width and date_size must be > 0".into());
        }
        validate_color(&self.line_color)
    }
}

/// 一张打卡表：表头行（日期，锚在格右上）+ items 行空格；顶部边线不画（开口样式）。
#[allow(clippy::too_many_arguments)]
fn push_table(
    lines: &mut Vec<Line>,
    texts: &mut Vec<Text>,
    p: &TrackerPattern,
    font: &str,
    lm: f64,
    top: f64,
    first: u32,
    count: usize,
    with_items: bool,
    rows: usize,
) {
    let grid = |x1, y1, x2, y2| Line {
        x1,
        y1,
        x2,
        y2,
        color: None,
        width: None,
        style: LineStyle::Solid,
    };
    let mut xs = vec![lm];
    if with_items {
        xs.push(lm + ITEM_W * A);
    }
    for _ in 0..count {
        let next = xs.last().unwrap() + A;
        xs.push(next);
    }
    // 竖线不过表头行，横线跳过顶部边线，交叉处留缺口。
    for x in &xs {
        for i in 1..rows {
            lines.push(grid(
                *x,
                top + i as f64 * A + GAP,
                *x,
                top + (i + 1) as f64 * A - GAP,
            ));
        }
    }
    for i in 1..=rows {
        let y = top + i as f64 * A;
        for k in 0..xs.len() - 1 {
            lines.push(grid(xs[k] + GAP, y, xs[k + 1] - GAP, y));
        }
    }
    let off = usize::from(with_items);
    for i in 0..count {
        let day = first + i as u32;
        // 打卡表不染色。
        texts.push(Text {
            x: xs[off + i + 1],
            y: top + A - 0.2,
            content: day.to_string(),
            size: p.date_size,
            color: p.line_color.to_string(),
            rotation: 0,
            font: font.into(),
            anchor: "south east",
        });
    }
}

/// 月打卡页：上半表 1–14 号（带打卡项列），下半表 15–月末；随页序推进月份。
pub(crate) fn draw_tracker(
    geo: Geometry,
    p: &TrackerPattern,
    index: usize,
    font: &str,
) -> (Vec<Line>, Vec<Poly>, Vec<Text>) {
    let mut lines = Vec::new();
    let mut paths = Vec::new();
    let mut texts = Vec::new();
    let r = geo.content;
    // 与月历一致：横放设计坐标系，整体逆时针旋转 90°。
    let land = Rect {
        x: 0.0,
        y: 0.0,
        width: r.height,
        height: r.width,
    };
    let (year, month) = month_ym(p.year, p.month, index);
    let Some(first) = NaiveDate::from_ymd_opt(year, month, 1) else {
        return (lines, paths, texts);
    };
    let (ny, nm) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    let Some(next) = NaiveDate::from_ymd_opt(ny, nm, 1) else {
        return (lines, paths, texts);
    };
    let days = (next - first).num_days() as u32;

    let items = p.items.max(1);
    let rows = items + 1;
    let count1 = days.min(14);
    let count2 = days - count1;
    let w1 = ITEM_W * A + f64::from(count1 as u16) * A;
    let w2 = f64::from(count2 as u16) * A;
    let max_w = if count2 > 0 { w1.max(w2) } else { w1 };
    let lm = land.x + (land.width - max_w) / 2.0;
    let table_h = rows as f64 * A;
    let total = if count2 > 0 {
        2.0 * table_h + TRACKER_GAP
    } else {
        table_h
    };
    let top1 = land.y + (land.height - total) / 2.0 - TRACKER_UP;
    let top2 = top1 + table_h + TRACKER_GAP;
    push_table(
        &mut lines,
        &mut texts,
        p,
        font,
        lm,
        top1,
        1,
        count1 as usize,
        true,
        rows,
    );
    if count2 > 0 {
        push_table(
            &mut lines,
            &mut texts,
            p,
            font,
            lm,
            top2,
            1 + count1,
            count2 as usize,
            false,
            rows,
        );
        // 连接箭头：上表打卡第 i 行左缘 → 下表第 i 行左缘（左外侧逐行错开的折线箭头，表头不连）。
        for j in 1..rows {
            let yc1 = top1 + (j as f64 + 0.5) * A;
            let yc2 = top2 + (j as f64 + 0.5) * A;
            let xm = (lm - 1.5 - j as f64 * 1.5).max(land.x + 0.8);
            paths.push(Poly {
                points: vec![(lm - 0.4, yc1), (xm, yc1), (xm, yc2), (lm - 0.4, yc2)],
                color: p.line_color.clone(),
                fill: false,
                arrow: true,
            });
        }
    }
    // 整体逆时针旋转 90°（同月历页），文字锚点保持原名。
    let base = r.y + r.height;
    let left = r.x;
    for line in &mut lines {
        let (x1, y1) = (left + line.y1, base - line.x1);
        let (x2, y2) = (left + line.y2, base - line.x2);
        line.x1 = x1;
        line.y1 = y1;
        line.x2 = x2;
        line.y2 = y2;
    }
    for poly in &mut paths {
        for point in &mut poly.points {
            *point = (left + point.1, base - point.0);
        }
    }
    for text in &mut texts {
        let (x, y) = (left + text.y, base - text.x);
        text.x = x;
        text.y = y;
        text.rotation = 90;
    }
    (lines, paths, texts)
}

/// 把 "YYYY-MM" 解析成 (年, 月)。
fn parse_ym(s: &str) -> Option<(i32, u32)> {
    let (y, m) = s.split_once('-')?;
    let year = y.parse().ok()?;
    let month = m.parse().ok()?;
    (1..=12).contains(&month).then_some((year, month))
}

/// "2026-12" → "2026-12"（固定补零，便于排列表头）。
fn ym_string(year: i32, month: u32) -> String {
    format!("{year}-{month:02}")
}

/// 多月追踪：横轴 1–31 日期列，纵轴月份行（复用月打卡格子样式）。
#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct MonthTrackerPattern {
    pub(crate) start: String,
    pub(crate) end: String,
    /// 双页：第 1 页 1–15 日，第 2 页 16–31 日；单页：1–31 横排。
    pub(crate) two_page: bool,
    pub(crate) line_color: String,
    pub(crate) line_width: f64,
    pub(crate) date_size: f64,
}
impl Default for MonthTrackerPattern {
    fn default() -> Self {
        let now = Utc::now();
        Self {
            start: ym_string(now.year(), now.month()),
            end: ym_string(now.year(), now.month()),
            two_page: false,
            line_color: GRAY.into(),
            line_width: 0.4,
            date_size: 8.0,
        }
    }
}
impl MonthTrackerPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        let Some((sy, sm)) = parse_ym(&self.start) else {
            return Err("start must be YYYY-MM".into());
        };
        let Some((ey, em)) = parse_ym(&self.end) else {
            return Err("end must be YYYY-MM".into());
        };
        let total = ey * 12 + em as i32 - (sy * 12 + sm as i32) + 1;
        if !(1..=60).contains(&total) {
            return Err("range must be 1..=60 months".into());
        }
        if self.line_width <= 0.0 || self.date_size <= 0.0 {
            return Err("line_width and date_size must be > 0".into());
        }
        validate_color(&self.line_color)
    }
}

/// 年度追踪表：列 = 日期（label 列 + N 个日期列），行 = 月份，
/// 顶部开口的表头行放日期数字，下面每月一行空格。
/// 与 push_table 完全同构：竖线不过表头行、交叉处留 GAP、顶部边线不画。
/// 标签列（月份）按 `label_cols` 格宽参与总列数，日期格宽全页一致。
#[allow(clippy::too_many_arguments)]
fn push_month_grid(
    lines: &mut Vec<Line>,
    texts: &mut Vec<Text>,
    p: &MonthTrackerPattern,
    font: &str,
    land: Rect,
    first_day: u32,
    days: usize,
    label_cols: usize,
    months: usize,
    start_idx: i32,
) {
    let avail_w = land.width;
    let avail_h = land.height;
    // 表头/标签列占 label_cols 格宽；首页 3 格表头 + 14 日、后页 17 日，
    // 两页总格数相同 ⇒ 单格大小一致。
    let total_cols = label_cols + days;
    // 行数 = 表头行(日期) + months 个月份行。
    let rows = months + 1;
    // 撑满内容区（已去除页头页尾、内装订外装订）：哪个方向先触到内容边，
    // 格子就由哪个方向定大小，另一方向余白居中；不加固定上限，避免格子
    // 悬在页面中央没有一边靠边。
    let cell = (avail_w / total_cols as f64)
        .min(avail_h / rows as f64)
        .max(0.8);
    let label_w = label_cols as f64 * cell;
    let table_w = total_cols as f64 * cell;
    let table_h = cell * rows as f64;
    let lm = land.x + (land.width - table_w) / 2.0;
    let top = land.y + (land.height - table_h) / 2.0;

    let grid = |x1, y1, x2, y2| Line {
        x1,
        y1,
        x2,
        y2,
        color: None,
        width: None,
        style: LineStyle::Solid,
    };
    // 列界：可选标签列 + days 个日期列。
    let mut xs = vec![lm];
    if label_cols > 0 {
        xs.push(lm + label_w);
    }
    for _ in 0..days {
        let next = xs.last().unwrap() + cell;
        xs.push(next);
    }
    for x in &xs {
        for i in 1..rows {
            lines.push(grid(
                *x,
                top + i as f64 * cell + GAP,
                *x,
                top + (i + 1) as f64 * cell - GAP,
            ));
        }
    }
    for i in 1..=rows {
        let y = top + i as f64 * cell;
        for k in 0..xs.len() - 1 {
            lines.push(grid(xs[k] + GAP, y, xs[k + 1] - GAP, y));
        }
    }
    // 日期数字（表头行，锚在格右上，与月打卡一致）。
    let off = usize::from(label_cols > 0);
    for i in 0..days {
        let day = first_day + i as u32;
        texts.push(Text {
            x: xs[off + i + 1],
            y: top + cell - 0.2,
            content: day.to_string(),
            size: p.date_size,
            color: p.line_color.clone(),
            rotation: 0,
            font: font.into(),
            anchor: "south east",
        });
    }
    // 月份标签：标签列内每行垂直居中。
    if label_cols > 0 {
        for m in 0..months {
            let month_idx = start_idx + m as i32;
            let year = month_idx.div_euclid(12);
            let month = month_idx.rem_euclid(12) as u32 + 1;
            texts.push(Text {
                x: lm + label_w / 2.0,
                y: top + (m as f64 + 1.5) * cell,
                content: ym_string(year, month),
                size: (p.date_size * 0.7).max(3.0),
                color: p.line_color.clone(),
                rotation: 0,
                font: font.into(),
                anchor: "center",
            });
        }
    }
}
/// 多月追踪页。单页：内容按横版设计并整体旋转 90°（同月历单页）；
/// 双页：纵向直立，页 0 为 1–15 日，页 1 为 16–31 日。
pub(crate) fn draw_month_tracker(
    geo: Geometry,
    p: &MonthTrackerPattern,
    index: usize,
    font: &str,
) -> (Vec<Line>, Vec<Poly>, Vec<Text>) {
    let mut lines = Vec::new();
    let paths = Vec::new();
    let mut texts = Vec::new();
    let r = geo.content;

    let Some((sy, sm)) = parse_ym(&p.start) else {
        return (lines, paths, texts);
    };
    let Some((ey, em)) = parse_ym(&p.end) else {
        return (lines, paths, texts);
    };
    let start_idx = sy * 12 + sm as i32 - 1; // 0 基月份序号
    let end_idx = ey * 12 + em as i32 - 1;
    let months = (end_idx - start_idx + 1).max(1) as usize;

    // 月份标签列宽 = 3 格。双页：首页 3 格标签 + 1–14 日，后页 15–31 日；
    // 两页总格数相同（17），格子大小自然一致。
    let (first_day, days, label_cols) = if p.two_page {
        if index == 0 {
            (1u32, 14usize, 3usize)
        } else {
            (15u32, 17usize, 0usize)
        }
    } else {
        (1u32, 31usize, 3usize)
    };

    // 单页横排：与月历一致，横放设计坐标系，末尾整体逆时针旋转 90°。
    let land = if p.two_page {
        r
    } else {
        Rect {
            x: 0.0,
            y: 0.0,
            width: r.height,
            height: r.width,
        }
    };

    push_month_grid(
        &mut lines, &mut texts, p, font, land, first_day, days, label_cols, months, start_idx,
    );

    if !p.two_page {
        let base = r.y + r.height;
        let left = r.x;
        for line in &mut lines {
            let (x1, y1) = (left + line.y1, base - line.x1);
            let (x2, y2) = (left + line.y2, base - line.x2);
            line.x1 = x1;
            line.y1 = y1;
            line.x2 = x2;
            line.y2 = y2;
        }
        for text in &mut texts {
            let (x, y) = (left + text.y, base - text.x);
            text.x = x;
            text.y = y;
            text.rotation = 90;
        }
    }
    (lines, paths, texts)
}

#[cfg(test)]
mod tests {
    use super::super::{PageSettings, geometry_for};
    use super::*;

    #[test]
    fn august_grid_matches_senary_layout() {
        let page = PageSettings::default();
        let r = geometry_for(&page, 1).content;
        let p = MonthPattern {
            year: 2026,
            month: 8,
            ..Default::default()
        };
        let (lines, dots, paths, texts) =
            draw_month(geometry_for(&page, 1), &p, 0, r"\sffamily", &None);
        // 2026-08：周六起，31 天，6 行 → 竖线 8×6 + 横线 7×7，31 个圆盘 Dot + 31 个照面多边形。
        assert_eq!(lines.len(), 8 * 6 + 7 * 7);
        assert_eq!(dots.len(), 31);
        assert_eq!(paths.len(), 31);
        // 7 个星期表头 + 31 个日期 + 标题。
        assert_eq!(texts.len(), 39);
        assert_eq!(texts[7].content, "1");
        // 旋转后：日期仍以 north west 锚在格内左上（盒子伸向页面右上）。
        assert_eq!(texts[7].anchor, "north west");
        assert_eq!(texts[7].rotation, 90);
        assert!((texts[7].x - (r.x + r.width / 8.0 + 4.2)).abs() < 0.01);
        assert!((texts[7].y - (r.y + r.height - 135.9)).abs() < 0.1);
        // 标题在左侧标题带内，随整体旋转成竖排。
        let title = texts.iter().find(|t| t.content == "2026年8月").unwrap();
        assert_eq!(title.rotation, 90);
        assert!((title.x - (r.x + r.width / 16.0)).abs() < 0.01);
        assert!((title.y - (r.y + r.height / 2.0)).abs() < 0.01);
    }

    #[test]
    fn pages_advance_months_across_year_boundary() {
        let page = PageSettings::default();
        let p = MonthPattern {
            year: 2026,
            month: 12,
            ..Default::default()
        };
        let (_, _, _, texts) = draw_month(geometry_for(&page, 2), &p, 1, r"\sffamily", &None);
        // 2027-01 共 31 天。
        assert!(texts.iter().any(|t| t.content == "31"));
        assert_eq!(texts[7].content, "1");
    }

    #[test]
    fn weekend_red_requires_holidays() {
        let page = PageSettings::default();
        let p = MonthPattern {
            year: 2026,
            month: 8,
            ..Default::default()
        };
        // 2026-08-01 是周六：无 ICS 时不染色。
        let (_, _, _, texts) = draw_month(geometry_for(&page, 1), &p, 0, r"\sffamily", &None);
        let sat = texts.iter().find(|t| t.content == "1").unwrap();
        assert_eq!(sat.color, GRAY);
        // 有 ICS 节日表时周末染红（节日名放在别的日期，专测周末分支）。
        let mut holidays = HashMap::new();
        holidays.insert("2026-08-04".into(), "收获节".into());
        let (_, _, _, texts) =
            draw_month(geometry_for(&page, 1), &p, 0, r"\sffamily", &Some(holidays));
        let sat = texts.iter().find(|t| t.content == "1").unwrap();
        assert_eq!(sat.color, HOLIDAY_RED);
    }

    #[test]
    fn show_holidays_gate() {
        let page = PageSettings::default();
        let mut holidays = HashMap::new();
        holidays.insert("2026-08-01".into(), "建军节".into());
        let p = MonthPattern {
            year: 2026,
            month: 8,
            show_holidays: false,
            ..Default::default()
        };
        // 关闭显示节假日：不画节日名，周六也不染红。
        let (_, _, _, texts) = draw_month(
            geometry_for(&page, 1),
            &p,
            0,
            r"\sffamily",
            &Some(holidays.clone()),
        );
        assert!(!texts.iter().any(|t| t.content == "建军节"));
        let sat = texts.iter().find(|t| t.content == "1").unwrap();
        assert_eq!(sat.color, GRAY);
        // 打开后恢复。
        let p = MonthPattern {
            show_holidays: true,
            ..p
        };
        let (_, _, _, texts) =
            draw_month(geometry_for(&page, 1), &p, 0, r"\sffamily", &Some(holidays));
        assert!(texts.iter().any(|t| t.content == "建军节"));
    }

    #[test]
    fn moon_illumination_follows_synodic_phase() {
        let epoch = Utc.with_ymd_and_hms(2000, 1, 6, 18, 14, 0).unwrap();
        let (new_illum, waxing) = moon_illumination(epoch);
        assert!(new_illum < 0.01);
        assert!(waxing);
        let late = epoch + Duration::seconds((SYNODIC * 0.55 * 86400.0) as i64);
        let (full_illum, waxing) = moon_illumination(late);
        assert!(full_illum > 0.9);
        assert!(!waxing);
    }

    #[test]
    fn tracker_tables_match_senary_layout() {
        let page = PageSettings::default();
        let p = TrackerPattern {
            year: 2026,
            month: 8,
            ..Default::default()
        };
        let (lines, paths, texts) = draw_tracker(geometry_for(&page, 1), &p, 0, r"\sffamily");
        // 上表：16 条列界 ×4 段竖线 + 5 条横线 ×15 段；下表：18 ×4 + 5 ×17；行连接箭头 5。
        assert_eq!(lines.len(), 16 * 4 + 5 * 15 + 18 * 4 + 5 * 17);
        assert_eq!(paths.len(), 4);
        // 31 个日期 + 31 个星期标签；2026-08-01 是周六 → "六"。
        // 31 个表头日期。
        assert_eq!(texts.len(), 31);
        assert_eq!(texts[0].content, "1");
        assert_eq!(texts[0].anchor, "south east");
        assert_eq!(texts[14].content, "15");
    }

    #[test]
    fn validate_checks_month_and_sizes() {
        let p = MonthPattern {
            year: 2026,
            month: 8,
            ..Default::default()
        };
        assert!(p.validate().is_ok());
        let p = MonthPattern { month: 13, ..p };
        assert!(p.validate().is_err());
        let p = MonthPattern {
            weekday_headers: "一,二,三,四,五,六".into(),
            ..p
        };
        assert!(p.validate().is_err());
    }

    #[test]
    fn weekday_headers_from_string() {
        let page = PageSettings::default();
        let p = MonthPattern {
            year: 2026,
            month: 8,
            ..Default::default()
        };
        // 默认英文表头（与旧版一致），自定义字符串按逗号拆分（允许空格）。
        let (_, _, _, texts) = draw_month(geometry_for(&page, 1), &p, 0, r"\sffamily", &None);
        assert_eq!(texts[0].content, "Mo");
        for (headers, first) in [
            ("一,二,三,四,五,六,日", "一"),
            ("月, 火, 水, 木, 金, 土, 日", "月"),
        ] {
            let p = MonthPattern {
                weekday_headers: headers.into(),
                ..p.clone()
            };
            let (_, _, _, texts) = draw_month(geometry_for(&page, 1), &p, 0, r"\sffamily", &None);
            assert_eq!(texts[0].content, first);
        }
    }

    #[test]
    fn title_format_renders_month_title() {
        let page = PageSettings::default();
        // 默认 "%Y年%-m月"。
        let p = MonthPattern {
            year: 2026,
            month: 8,
            two_page: true,
            ..Default::default()
        };
        assert!(p.validate().is_ok());
        let (_, _, _, texts) = draw_month(geometry_for(&page, 1), &p, 0, r"\sffamily", &None);
        assert!(texts.iter().any(|t| t.content == "2026年8月"));
        // 自定义格式串。
        let p = MonthPattern {
            title_format: "%m/%Y".into(),
            ..p.clone()
        };
        let (_, _, _, texts) = draw_month(geometry_for(&page, 1), &p, 0, r"\sffamily", &None);
        assert!(texts.iter().any(|t| t.content == "08/2026"));
        // 非法格式串报错。
        assert!(
            MonthPattern {
                title_format: "%Q".into(),
                ..p.clone()
            }
            .validate()
            .is_err()
        );
        // %cccc（农历）不适用于标题。
        assert!(
            MonthPattern {
                title_format: "%cccc".into(),
                ..p.clone()
            }
            .validate()
            .is_err()
        );
    }
    #[test]
    fn two_page_splits_weekday_columns() {
        let page = PageSettings::default();
        let p = MonthPattern {
            year: 2026,
            month: 8,
            two_page: true,
            ..Default::default()
        };
        // 2026-08：周六起，31 天，6 行；页 0 周一~三 3 列：竖线 4×6 + 横线 7×3，13 天落格。
        let first_r = geometry_for(&page, 1).content;
        let (lines, dots, paths, texts) =
            draw_month(geometry_for(&page, 1), &p, 0, r"\sffamily", &None);
        assert_eq!(lines.len(), 4 * 6 + 7 * 3);
        assert_eq!(dots.len(), 13);
        assert_eq!(paths.len(), 13);
        assert_eq!(texts.len(), 17);
        assert_eq!(texts[0].content, "Mo");
        assert_eq!(texts[3].content, "3");
        assert!(!texts.iter().any(|t| t.content == "1"));
        let title = texts.iter().find(|t| t.content == "2026年8月").unwrap();
        assert_eq!(title.rotation, 90);
        assert!((title.x - (first_r.x + first_r.width / 8.0)).abs() < 0.01);
        let first_cell_w = texts[1].x - texts[0].x;

        // 页 1 周四~日 4 列：竖线 5×6 + 横线 7×4，18 天落格（含 8/1 周六与 8/2 周日）。
        let (_, dots, paths, texts) =
            draw_month(geometry_for(&page, 2), &p, 1, r"\sffamily", &None);
        // 双页竖放：文字不旋转，落在内容区内。
        let r = geometry_for(&page, 2).content;
        assert!(texts.iter().all(|t| t.rotation == 0));
        assert!(texts.iter().all(|t| t.x > r.x && t.x < r.x + r.width));
        assert_eq!(texts[0].content, "Th");
        assert_eq!(texts[4].content, "1");
        assert!(texts.iter().any(|t| t.content == "2")); // 周日也显示
        assert_eq!(texts.len(), 22); // 4 表头 + 18 日期
        assert_eq!(dots.len(), 18);
        assert_eq!(paths.len(), 18);
        assert!((first_cell_w - (texts[1].x - texts[0].x)).abs() < 0.01);
    }

    #[test]
    fn month_tracker_single_page_covers_days_and_months() {
        let page = PageSettings::default();
        let p = MonthTrackerPattern {
            start: "2026-12".into(),
            end: "2027-12".into(),
            ..Default::default()
        };
        let (lines, _, texts) = draw_month_tracker(geometry_for(&page, 1), &p, 0, r"\sffamily");
        // 13 个月行 + 表头行；31 天列 + 月份标签列 = 32 列界。
        let months = 13usize;
        let days = 31usize;
        let col_bounds = days + 2; // label 列 + 31 天
        // 竖线（每列界，分月分段）+ 横线（每行、每列格）。
        let expected = col_bounds * months + (months + 1) * (col_bounds - 1);
        assert_eq!(lines.len(), expected);
        // 31 个日期数字 + 13 个月份标签。
        assert_eq!(texts.len(), days + months);
        assert_eq!(texts[0].content, "1");
        assert_eq!(texts[days].content, "2026-12");
        assert!(texts.iter().any(|t| t.content == "31"));
        assert!(texts.iter().any(|t| t.content == "2027-12"));
    }

    #[test]
    fn month_tracker_two_page_splits_day_columns() {
        let page = PageSettings::default();
        let p = MonthTrackerPattern {
            start: "2026-12".into(),
            end: "2027-12".into(),
            two_page: true,
            ..Default::default()
        };
        let (lines0, _, texts0) = draw_month_tracker(geometry_for(&page, 1), &p, 0, r"\sffamily");
        let (lines1, _, texts1) = draw_month_tracker(geometry_for(&page, 2), &p, 1, r"\sffamily");
        let months = 13usize;
        // 首页：3 格标签列 + 1–14 日；后页：15–31 日。两页总格数相同。
        let days0 = 14usize;
        // xs = [lm, (标签列右界)] + days 个日期界。
        let col_bounds0 = 1 + 1 + days0;
        let col_bounds1 = 1 + 17; // 17 日
        let expected0 = col_bounds0 * months + (months + 1) * (col_bounds0 - 1);
        let expected1 = col_bounds1 * months + (months + 1) * (col_bounds1 - 1);
        assert_eq!(lines0.len(), expected0);
        assert_eq!(lines1.len(), expected1);
        assert_eq!(texts0.len(), days0 + months);
        // 第二页只有日期数字，没有月份标签。
        assert_eq!(texts1.len(), 17);
        assert!(!texts1.iter().any(|t| t.content.contains('-')));
        assert_eq!(texts0[0].content, "1");
        assert_eq!(texts0[days0].content, "2026-12");
        // 双页竖放：文字不旋转。
        assert!(texts0.iter().all(|t| t.rotation == 0));
        assert!(texts1.iter().all(|t| t.rotation == 0));
        // 后页日期从 15 起。
        assert!(texts1.iter().any(|t| t.content == "15"));
        assert!(!texts1.iter().any(|t| t.content == "14"));
    }
}
