//! 月历 — 移植自 lunar techo 的 senary 月历正面：7 列周一为首的网格
//! （交叉处留 0.2mm 缺口）、左上角日期、右上角照面比例月相方块。

use chrono::{Datelike, Duration, NaiveDate, TimeZone, Utc};
use serde::Deserialize;

use super::{Geometry, Line, LineStyle, Poly, Rect, Text, validate_color};

const COLS: usize = 7;
const HEAD_H: f64 = 4.0; // mm，星期表头行高
const PAD: f64 = 0.2; // mm，日期距格边
const GAP: f64 = 0.2; // mm，网格交叉处留白
const PS: f64 = 2.0; // mm，月相圆盘直径
const MOON_STEPS: usize = 24; // 圆弧采样数
const SYNODIC: f64 = 29.53058867; // 朔望月（天）
const WEEKDAYS: [&str; COLS] = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct MonthPattern {
    pub(crate) year: i32,
    pub(crate) month: u32,
    pub(crate) phase_color: String,
    pub(crate) line_color: String,
    pub(crate) line_width: f64,
    pub(crate) date_size: f64,
}
impl Default for MonthPattern {
    fn default() -> Self {
        let now = Utc::now();
        Self {
            year: now.year(),
            month: now.month(),
            phase_color: "#e5b93f".into(),
            line_color: "#7a7a7a".into(),
            line_width: 0.4,
            date_size: 8.0,
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
        validate_color(&self.phase_color)
    }
}

/// 第 index 页对应的年月（页序依次推进月份）。
fn month_ym(p: &MonthPattern, index: usize) -> (i32, u32) {
    let total = i64::from(p.year) * 12 + i64::from(p.month) - 1 + index as i64;
    (total.div_euclid(12) as i32, total.rem_euclid(12) as u32 + 1)
}

/// 以 2000-01-06 18:14 UTC 朔为历元的近似月相：(照面比例 0..1, 是否盈)。
fn moon_illumination(moment: chrono::DateTime<Utc>) -> (f64, bool) {
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
) -> (Vec<Line>, Vec<Poly>, Vec<Text>) {
    let mut lines = Vec::new();
    let mut paths = Vec::new();
    let mut texts = Vec::new();
    let (year, month) = month_ym(p, index);
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
    // 设计坐标系：月历横放（宽沿内容区长边），画完后整体逆时针旋转 90° 落到页面。
    let land = Rect {
        x: 0.0,
        y: 0.0,
        width: r.height,
        height: r.width,
    };
    let gy = land.y + HEAD_H;
    let cell_w = land.width / f64::from(COLS as u16);
    let cell_h = (land.height - HEAD_H) / weeks as f64;
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
    for i in 0..=COLS {
        let x = land.x + cell_w * i as f64;
        for j in 0..weeks {
            let y1 = gy + cell_h * j as f64 + GAP;
            let y2 = gy + cell_h * (j + 1) as f64 - GAP;
            lines.push(grid(x, y1, x, y2));
        }
    }
    for j in 0..=weeks {
        let y = gy + cell_h * j as f64;
        for i in 0..COLS {
            let x1 = land.x + cell_w * i as f64 + GAP;
            let x2 = land.x + cell_w * (i + 1) as f64 - GAP;
            lines.push(grid(x1, y, x2, y));
        }
    }
    for (i, w) in WEEKDAYS.iter().enumerate() {
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
        let row = (pos / COLS) as f64;
        let col = (pos % COLS) as f64;
        let date = first + Duration::days(i64::from(d as u16 - 1));
        texts.push(Text {
            x: land.x + cell_w * col + PAD,
            y: gy + cell_h * row + PAD,
            content: d.to_string(),
            size: p.date_size,
            color: p.line_color.clone(),
            rotation: 0,
            font: font.into(),
            anchor: "north west",
        });
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
        });
    }
    // 整体逆时针旋转 90°：设计 (x,y) → 页面 (r.x + y, r.y + r.height - x)。
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
        let (lines, paths, texts) = draw_month(geometry_for(&page, 1), &p, 0, r"\sffamily");
        // 2026-08：周六起，31 天，6 行 → 竖线 8×6 + 横线 7×7，月相圆盘 + 照面多边形 31×2。
        assert_eq!(lines.len(), 8 * 6 + 7 * 7);
        assert_eq!(paths.len(), 62);
        // 7 个星期表头 + 31 个日期。
        assert_eq!(texts.len(), 38);
        assert_eq!(texts[7].content, "1");
        // 旋转后：日期仍以 north west 锚在格内左上（盒子伸向页面右上）。
        assert_eq!(texts[7].anchor, "north west");
        assert_eq!(texts[7].rotation, 90);
        assert!((texts[7].x - (r.x + 4.2)).abs() < 0.01);
        assert!((texts[7].y - (r.y + r.height - 135.9)).abs() < 0.1);
    }

    #[test]
    fn pages_advance_months_across_year_boundary() {
        let page = PageSettings::default();
        let p = MonthPattern {
            year: 2026,
            month: 12,
            ..Default::default()
        };
        let (_, _, texts) = draw_month(geometry_for(&page, 2), &p, 1, r"\sffamily");
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
    fn validate_checks_month_and_sizes() {
        let p = MonthPattern {
            year: 2026,
            month: 8,
            ..Default::default()
        };
        assert!(p.validate().is_ok());
        let p = MonthPattern { month: 13, ..p };
        assert!(p.validate().is_err());
    }
}
