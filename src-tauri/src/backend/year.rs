//! 年历 — 每页 rows×cols 的月历网格（默认 1×2，左右双页为一行四个月），
//! 复用八分视图的迷你月历。

use chrono::{Datelike, NaiveDate, Utc};
use serde::Deserialize;

use super::{
    Geometry, Rect, Text, WeekdayLang,
    eight::{MINI_PAD, push_one_month},
};

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct YearPattern {
    pub(crate) start: String, // "YYYY-MM"
    pub(crate) end: String,
    pub(crate) rows: usize,
    pub(crate) cols: usize,
    pub(crate) date_size: f64,
    pub(crate) weekday_lang: WeekdayLang,
}
impl Default for YearPattern {
    fn default() -> Self {
        let year = Utc::now().year();
        Self {
            start: format!("{year}-01"),
            end: format!("{year}-12"),
            rows: 1,
            cols: 2,
            date_size: 6.0,
            weekday_lang: WeekdayLang::Zh,
        }
    }
}

/// "YYYY-MM" → (年, 月)。
fn parse_ym(s: &str) -> Option<(i32, u32)> {
    let (y, m) = s.split_once('-')?;
    let m = m.parse::<u32>().ok()?;
    if !(1..=12).contains(&m) {
        return None;
    }
    Some((y.parse().ok()?, m))
}

impl YearPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        let (Some(s), Some(e)) = (parse_ym(&self.start), parse_ym(&self.end)) else {
            return Err("开始/结束月份格式应为 YYYY-MM".into());
        };
        if s > e {
            return Err("结束月份必须晚于或等于开始月份".into());
        }
        if self.date_size <= 0.0 {
            return Err("date_size must be > 0".into());
        }
        if !(1..=12).contains(&self.rows) || !(1..=12).contains(&self.cols) {
            return Err("rows and cols must be in 1..=12".into());
        }
        Ok(())
    }

    /// 第 index 页（双页为一行）的 rows×cols 个月份；超出结束月份的位置为 None。
    fn page_months(&self, index: usize) -> Vec<Option<(i32, u32)>> {
        let per = self.rows * self.cols;
        let Some((sy, sm)) = parse_ym(&self.start) else {
            return vec![None; per];
        };
        let Some((ey, em)) = parse_ym(&self.end) else {
            return vec![None; per];
        };
        let count = (ey * 12 + em as i32 - sy * 12 - sm as i32 + 1).max(0) as usize;
        let base = (index / 2) * (2 * per) + (index % 2) * per;
        (0..per)
            .map(|n| {
                let n = base + n;
                if n >= count {
                    return None;
                }
                let total = i64::from(sy * 12 + sm as i32 - 1 + n as i32);
                Some((total.div_euclid(12) as i32, total.rem_euclid(12) as u32 + 1))
            })
            .collect()
    }
}

/// rows×cols 月历网格；单格宽度撑满，高度按列宽等比（标题 + 表头 + 最多 6 行日期）、
/// 不超过行带高度并在行带内垂直居中。
pub(crate) fn draw_year(geo: Geometry, p: &YearPattern, index: usize, font: &str) -> Vec<Text> {
    let mut texts = Vec::new();
    let r = geo.content;
    let (rows, cols) = (p.rows.max(1), p.cols.max(1));
    let w = r.width / cols as f64;
    let band_h = r.height / rows as f64;
    let cell_w = (w - 2.0 * MINI_PAD) / 7.0;
    let h = (cell_w * 8.0 + 2.0 * MINI_PAD).min(band_h);
    let y0 = r.y + (band_h - h) / 2.0;
    for (k, ym) in p.page_months(index).into_iter().enumerate() {
        let Some((year, month)) = ym else { continue };
        let Some(first) = NaiveDate::from_ymd_opt(year, month, 1) else {
            continue;
        };
        push_one_month(
            &mut texts,
            Rect {
                x: r.x + (k % cols) as f64 * w,
                y: y0 + (k / cols) as f64 * band_h,
                width: w,
                height: h,
            },
            first,
            p.date_size,
            p.weekday_lang,
            None,
            font,
        );
    }
    texts
}

#[cfg(test)]
mod tests {
    use super::super::eight::{MINI_BLACK, MINI_RED};
    use super::super::{PageSettings, geometry_for};
    use super::*;

    fn year(start: &str, end: &str) -> YearPattern {
        YearPattern {
            start: start.into(),
            end: end.into(),
            ..Default::default()
        }
    }

    #[test]
    fn pages_cover_months_grid_per_double_page() {
        let p = year("2026-01", "2026-05"); // 默认 1×2，5 个月
        assert_eq!(
            p.page_months(0),
            vec![Some((2026, 1)), Some((2026, 2))],
            "第 1 页 = 前两个月"
        );
        assert_eq!(
            p.page_months(1),
            vec![Some((2026, 3)), Some((2026, 4))],
            "第 2 页 = 同行后两个月"
        );
        assert_eq!(p.page_months(2), vec![Some((2026, 5)), None]);
        assert_eq!(p.page_months(3), vec![None, None], "超出范围不绘制");
        // 跨年。
        assert_eq!(
            year("2026-11", "2027-02").page_months(1),
            vec![Some((2027, 1)), Some((2027, 2))]
        );
        // 2×2：每页 4 个月，双页一行共 8 个月。
        let p = YearPattern {
            rows: 2,
            cols: 2,
            ..year("2026-01", "2026-12")
        };
        assert_eq!(
            p.page_months(0),
            vec![
                Some((2026, 1)),
                Some((2026, 2)),
                Some((2026, 3)),
                Some((2026, 4))
            ]
        );
        assert_eq!(
            p.page_months(1),
            vec![
                Some((2026, 5)),
                Some((2026, 6)),
                Some((2026, 7)),
                Some((2026, 8))
            ]
        );
        assert_eq!(p.page_months(2)[0], Some((2026, 9)));
    }

    #[test]
    fn validate_checks_month_format_and_order() {
        assert!(year("2026-01", "2026-12").validate().is_ok());
        assert_eq!(
            year("2026-13", "2026-12").validate().unwrap_err(),
            "开始/结束月份格式应为 YYYY-MM"
        );
        assert_eq!(
            year("2026-12", "2026-01").validate().unwrap_err(),
            "结束月份必须晚于或等于开始月份"
        );
        let p = YearPattern {
            cols: 13,
            ..year("2026-01", "2026-12")
        };
        assert_eq!(p.validate().unwrap_err(), "rows and cols must be in 1..=12");
    }

    #[test]
    fn page_draws_two_month_calendars() {
        let page = PageSettings::default();
        let p = year("2026-01", "2026-12");
        let texts = draw_year(geometry_for(&page, 1), &p, 0, r"\sffamily");
        assert!(texts.iter().any(|t| t.content == "2026年1月"));
        assert!(texts.iter().any(|t| t.content == "2026年2月"));
        // 2026-01-01 是周四：首行只有 1、2、3 号，且无本周红色高亮。
        assert_eq!(
            texts
                .iter()
                .filter(|t| t.content == "1" && t.color == MINI_BLACK)
                .count(),
            2,
            "两个月各有一个黑色的 1 号"
        );
        assert!(texts.iter().all(|t| t.color != MINI_RED));
    }
}
