//! 月历 — 移植自 lunar techo 的 senary 月历正面：7 列周一为首的网格
//! （交叉处留 0.2mm 缺口）、左上角日期、右上角照面比例月相方块。

use super::colors::{GRAY, HOLIDAY_RED, PHASE_GOLD};
use chrono::format::{Item, StrftimeItems};
use chrono::{Datelike, Duration, NaiveDate, TimeZone, Utc, Weekday};
use serde::Deserialize;

use super::{
    Geometry, HashMap, Line, LineStyle, Poly, Rect, Text, chrono_format, lunar_date, validate_color,
};

const COLS: usize = 7;
const HEAD_H: f64 = 4.0; // mm，星期表头行高
const PAD: f64 = 0.2; // mm，日期距格边
const GAP: f64 = 0.2; // mm，网格交叉处留白
pub(crate) const PS: f64 = 2.0; // mm，月相圆盘直径
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
            lunar: false,
        }
    }
}
impl MonthPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if !(1..=12).contains(&self.month) {
            return Err("month must be in 1..12".into());
        }
        if self.line_width <= 0.0 || self.date_size <= 0.0 {
            return Err("line_width and date_size must be > 0".into());
        }
        validate_color(&self.line_color)?;
        let headers = self
            .weekday_headers
            .split(',')
            .map(str::trim)
            .collect::<Vec<_>>();
        if headers.len() != 7 || headers.iter().any(|s| s.is_empty()) {
            return Err("weekday_headers must be 7 comma-separated values".into());
        }
        let fmt = chrono_format(&self.title_format);
        if fmt.contains('\u{e000}') || StrftimeItems::new(&fmt).any(|item| item == Item::Error) {
            return Err(format!("invalid title_format: {}", self.title_format));
        }
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
) -> (Vec<Line>, Vec<Poly>, Vec<Text>) {
    let mut lines = Vec::new();
    let mut paths = Vec::new();
    let mut texts = Vec::new();
    // 双页模式：同一月拆两页，页 0 显示周一~周三列，页 1 显示周四~周六列（周日不显示）。
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
        let is_red = holiday_name.is_some() && !is_compensatory || is_weekend && !is_compensatory;
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
        // 农历日期：日期数字正下方
        if p.lunar
            && let Some(lunar_str) = lunar_date(date)
        {
            texts.push(Text {
                x: land.x + cell_w * col + PAD,
                y: gy + cell_h * row + PAD + p.date_size - 0.15,
                content: lunar_str,
                size: p.date_size * 0.5,
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
            texts.push(Text {
                x: land.x + cell_w * col + PAD,
                y: gy
                    + cell_h * row
                    + PAD
                    + p.date_size
                    + (if p.lunar {
                        p.date_size * 0.5 - 0.05
                    } else {
                        0.0
                    })
                    - 0.15,
                content: name.clone(),
                size: p.date_size * 0.55,
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
        let cx = rx - PS / 2.0;
        let cy = ty + PS / 2.0;
        let radius = PS / 2.0;
        // 圆弧采样（弧度 start→end）。
        let arc = |start: f64, end: f64| {
            (0..=MOON_STEPS)
                .map(|i| {
                    let phi = start + (end - start) * i as f64 / MOON_STEPS as f64;
                    (cx + radius * phi.cos(), cy + radius * phi.sin())
                })
                .collect::<Vec<_>>()
        };
        let tau = std::f64::consts::TAU;
        paths.push(Poly {
            points: arc(0.0, tau),
            color: p.phase_color.clone(),
            fill: false,
            arrow: false,
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
        for text in &mut texts {
            let (x, y) = (left + text.y, base - text.x);
            text.x = x;
            text.y = y;
            text.rotation = 90;
        }
    }
    (lines, paths, texts)
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
    holidays: &Option<HashMap<String, String>>,
    year: i32,
    month: u32,
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
        let date_key = format!("{}-{:02}-{:02}", year, month, day);
        let date = NaiveDate::from_ymd_opt(year, month, day);
        let is_weekend =
            date.is_some_and(|d| d.weekday() == Weekday::Sat || d.weekday() == Weekday::Sun);
        let holiday_name = holidays.as_ref().and_then(|h| h.get(&date_key));
        let is_compensatory = holiday_name.is_some_and(|n| n.starts_with("上班"));
        let is_red = holiday_name.is_some() && !is_compensatory || is_weekend && !is_compensatory;
        let text_color = if is_red { HOLIDAY_RED } else { &p.line_color };
        texts.push(Text {
            x: xs[off + i + 1],
            y: top + A - 0.2,
            content: day.to_string(),
            size: p.date_size,
            color: text_color.to_string(),
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
    holidays: &Option<HashMap<String, String>>,
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
        holidays,
        year,
        month,
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
            holidays,
            ny,
            nm,
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
        let (lines, paths, texts) = draw_month(geometry_for(&page, 1), &p, 0, r"\sffamily", &None);
        // 2026-08：周六起，31 天，6 行 → 竖线 8×6 + 横线 7×7，月相圆盘 + 照面多边形 31×2。
        assert_eq!(lines.len(), 8 * 6 + 7 * 7);
        assert_eq!(paths.len(), 62);
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
        let (_, _, texts) = draw_month(geometry_for(&page, 2), &p, 1, r"\sffamily", &None);
        // 2027-01 共 31 天。
        assert!(texts.iter().any(|t| t.content == "31"));
        assert_eq!(texts[7].content, "1");
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
        let (lines, paths, texts) =
            draw_tracker(geometry_for(&page, 1), &p, 0, r"\sffamily", &None);
        // 上表：16 条列界 ×4 段竖线 + 5 条横线 ×15 段；下表：18 ×4 + 5 ×17；行连接箭头 5。
        assert_eq!(lines.len(), 16 * 4 + 5 * 15 + 18 * 4 + 5 * 17);
        assert_eq!(paths.len(), 4);
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
        let (_, _, texts) = draw_month(geometry_for(&page, 1), &p, 0, r"\sffamily", &None);
        assert_eq!(texts[0].content, "Mo");
        for (headers, first) in [
            ("一,二,三,四,五,六,日", "一"),
            ("月, 火, 水, 木, 金, 土, 日", "月"),
        ] {
            let p = MonthPattern {
                weekday_headers: headers.into(),
                ..p.clone()
            };
            let (_, _, texts) = draw_month(geometry_for(&page, 1), &p, 0, r"\sffamily", &None);
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
        let (_, _, texts) = draw_month(geometry_for(&page, 1), &p, 0, r"\sffamily", &None);
        assert!(texts.iter().any(|t| t.content == "2026年8月"));
        // 自定义格式串。
        let p = MonthPattern {
            title_format: "%m/%Y".into(),
            ..p.clone()
        };
        let (_, _, texts) = draw_month(geometry_for(&page, 1), &p, 0, r"\sffamily", &None);
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
        let (lines, paths, texts) = draw_month(geometry_for(&page, 1), &p, 0, r"\sffamily", &None);
        assert_eq!(lines.len(), 4 * 6 + 7 * 3);
        assert_eq!(paths.len(), 26);
        assert_eq!(texts.len(), 17);
        assert_eq!(texts[0].content, "Mo");
        assert_eq!(texts[3].content, "3");
        assert!(!texts.iter().any(|t| t.content == "1"));
        let title = texts.iter().find(|t| t.content == "2026年8月").unwrap();
        assert_eq!(title.rotation, 90);
        assert!((title.x - (first_r.x + first_r.width / 8.0)).abs() < 0.01);
        let first_cell_w = texts[1].x - texts[0].x;

        // 页 1 周四~日 4 列：竖线 5×6 + 横线 7×4，18 天落格（含 8/1 周六与 8/2 周日）。
        let (_, paths, texts) = draw_month(geometry_for(&page, 2), &p, 1, r"\sffamily", &None);
        // 双页竖放：文字不旋转，落在内容区内。
        let r = geometry_for(&page, 2).content;
        assert!(texts.iter().all(|t| t.rotation == 0));
        assert!(texts.iter().all(|t| t.x > r.x && t.x < r.x + r.width));
        assert_eq!(texts[0].content, "Th");
        assert_eq!(texts[4].content, "1");
        assert!(texts.iter().any(|t| t.content == "2")); // 周日也显示
        assert_eq!(texts.len(), 22); // 4 表头 + 18 日期
        assert_eq!(paths.len(), 36);
        assert!((first_cell_w - (texts[1].x - texts[0].x)).abs() < 0.01);
    }
}
