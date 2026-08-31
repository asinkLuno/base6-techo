use chrono::{Datelike, Duration, NaiveDate, Utc, Weekday};
use serde::Deserialize;

use super::{
    Dot, Geometry, Line, LineStyle, Text, chrono_format, format_date, lunar_date, validate_color,
    validate_date_format,
};

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct EightPattern {
    pub(crate) start_date: NaiveDate,
    pub(crate) end_date: NaiveDate,
    pub(crate) date_format: String,
    pub(crate) date_locale: String,
    pub(crate) line_color: String,
    pub(crate) line_width: f64,
    pub(crate) line_style: LineStyle,
    pub(crate) center_gap: f64,
    pub(crate) date_size: f64,
}
impl Default for EightPattern {
    fn default() -> Self {
        let today = Utc::now().date_naive();
        let monday = today - Duration::days(i64::from(today.weekday().num_days_from_monday()));
        Self {
            start_date: monday,
            end_date: monday + Duration::days(6),
            date_format: "%-d".into(),
            date_locale: "zh-CN".into(),
            line_color: "#7A7A7A".into(),
            line_width: 0.4,
            line_style: LineStyle::Solid,
            center_gap: 2.0,
            date_size: 10.0,
        }
    }
}
impl EightPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if self.end_date < self.start_date {
            return Err("结束日期必须晚于或等于开始日期".into());
        }
        if self.start_date.weekday() != Weekday::Mon {
            return Err("开始日期必须是星期一".into());
        }
        if self.end_date.weekday() != Weekday::Sun {
            return Err("结束日期必须是星期日".into());
        }
        if self.line_width <= 0.0 || self.date_size <= 0.0 {
            return Err("line_width and date_size must be > 0".into());
        }
        if self.center_gap < 0.0 {
            return Err("center_gap must be >= 0".into());
        }
        validate_color(&self.line_color)?;
        validate_date_format(&self.date_format, &self.date_locale)?;
        if chrono_format(&self.date_format).contains('\u{e000}')
            && [self.start_date, self.end_date]
                .into_iter()
                .any(|date| lunar_date(date).is_none())
        {
            return Err("农历日期仅支持 1901-02-19 至 2101-01-28".into());
        }
        Ok(())
    }

    /// 整星期（周一至周日）列表；起止日期已由 validate 保证为周一和周日。
    pub(crate) fn weeks(&self) -> Vec<(NaiveDate, NaiveDate)> {
        let count = (self.end_date - self.start_date).num_days() as usize / 7 + 1;
        (0..count)
            .map(|w| {
                let start = self.start_date + Duration::days(7 * w as i64);
                (start, start + Duration::days(6))
            })
            .collect()
    }
}

/// `index`：section 内 0 起的页序（即第 index+1 页）；第 1、3、5… 页画整周前半
/// （空/周一/周四/周五），第 2、4、6… 页画后半（周二/周三/周六/周日），保证顺序。
pub(crate) fn draw_eight(
    geo: Geometry,
    p: &EightPattern,
    index: usize,
    font: &str,
) -> (Vec<Line>, Vec<Dot>, Vec<Text>) {
    let r = geo.content;
    let cx = r.x + r.width / 2.0;
    let cy = r.y + r.height / 2.0;
    let line = |x1, y1, x2, y2| Line {
        x1,
        y1,
        x2,
        y2,
        color: Some(p.line_color.clone()),
        width: Some(p.line_width),
        style: p.line_style,
    };
    // 中心圆点留出 center_gap 间隙后向上下左右画直线分成四份，不画外框。
    let gap = p.center_gap;
    let lines = vec![
        line(cx, cy - gap, cx, r.y),
        line(cx, cy + gap, cx, r.y + r.height),
        line(cx - gap, cy, r.x, cy),
        line(cx + gap, cy, r.x + r.width, cy),
    ];
    let dots = vec![Dot {
        x: cx,
        y: cy,
        radius: 0.5,
        color: Some(p.line_color.clone()),
        square: false,
    }];
    let Some(&(week_start, _)) = p.weeks().get(index / 2) else {
        return (lines, dots, vec![]);
    };
    // section 内第 1、3、5… 页画空/周一/周四/周五，第 2、4、6… 页画周二/周三/周六/周日。
    let offsets: [Option<u32>; 4] = if (index + 1) % 2 == 1 {
        [None, Some(0), Some(3), Some(4)]
    } else {
        [Some(1), Some(2), Some(5), Some(6)]
    };
    let mut texts = Vec::new();
    for (slot, offset) in offsets.into_iter().enumerate() {
        let Some(offset) = offset else { continue };
        let cx = r.x + f64::from(slot as u16 % 2) * r.width / 2.0;
        let cy = r.y + f64::from(slot as u16 / 2) * r.height / 2.0;
        texts.push(Text {
            x: cx + 2.0,
            y: cy + 2.0,
            content: format_date(
                week_start + Duration::days(i64::from(offset)),
                &p.date_format,
                &p.date_locale,
            ),
            size: p.date_size,
            color: p.line_color.clone(),
            rotation: 0,
            font: font.into(),
            anchor: "north west",
        });
    }
    (lines, dots, texts)
}

#[cfg(test)]
mod tests {
    use super::super::{PageSettings, geometry_for};
    use super::*;

    fn pattern(start: &str, end: &str) -> EightPattern {
        EightPattern {
            start_date: NaiveDate::parse_from_str(start, "%F").unwrap(),
            end_date: NaiveDate::parse_from_str(end, "%F").unwrap(),
            ..Default::default()
        }
    }

    #[test]
    fn weeks_covers_exact_weeks_between_dates() {
        let p = pattern("2026-08-03", "2026-08-16");
        assert_eq!(
            p.weeks(),
            vec![
                (
                    NaiveDate::from_ymd_opt(2026, 8, 3).unwrap(),
                    NaiveDate::from_ymd_opt(2026, 8, 9).unwrap()
                ),
                (
                    NaiveDate::from_ymd_opt(2026, 8, 10).unwrap(),
                    NaiveDate::from_ymd_opt(2026, 8, 16).unwrap()
                ),
            ]
        );
    }

    #[test]
    fn validate_requires_monday_start_and_sunday_end() {
        assert_eq!(
            pattern("2026-08-04", "2026-08-09").validate().unwrap_err(),
            "开始日期必须是星期一"
        );
        assert_eq!(
            pattern("2026-08-03", "2026-08-08").validate().unwrap_err(),
            "结束日期必须是星期日"
        );
        assert_eq!(
            pattern("2026-08-03", "2026-08-02").validate().unwrap_err(),
            "结束日期必须晚于或等于开始日期"
        );
        assert!(pattern("2026-08-03", "2026-08-09").validate().is_ok());
    }

    fn days(texts: &[Text]) -> Vec<&str> {
        texts.iter().map(|text| text.content.as_str()).collect()
    }

    fn draw(page: &PageSettings, p: &EightPattern, index: usize) -> Vec<Text> {
        draw_eight(geometry_for(page, index + 1), p, index, r"\sffamily").2
    }

    #[test]
    fn pages_follow_week_order() {
        let page = PageSettings::default();
        let p = pattern("2026-08-03", "2026-08-16");
        // 第 1 页 = 第一周前半，第 2 页 = 后半，第 3/4 页 = 第二周。
        assert_eq!(days(&draw(&page, &p, 0)), ["3", "6", "7"]);
        assert_eq!(days(&draw(&page, &p, 1)), ["4", "5", "8", "9"]);
        assert_eq!(days(&draw(&page, &p, 2)), ["10", "13", "14"]);
        assert_eq!(days(&draw(&page, &p, 3)), ["11", "12", "15", "16"]);
    }

    #[test]
    fn cell_dates_reuse_header_format_system() {
        let page = PageSettings::default();
        let mut p = pattern("2026-08-03", "2026-08-09");
        p.date_format = "%a. %m/%d".into();
        assert_eq!(
            days(&draw(&page, &p, 0)),
            ["一. 08/03", "四. 08/06", "五. 08/07"]
        );
        p.date_format = "%Y年 %cccc".into();
        assert_eq!(days(&draw(&page, &p, 0))[0], "2026年 六月廿一");
        p.date_format = "%Q".into();
        assert!(p.validate().is_err());
    }

    #[test]
    fn out_of_range_week_draws_empty_grid() {
        let page = PageSettings::default();
        let p = pattern("2026-08-03", "2026-08-09");
        let (lines, dots, texts) = draw_eight(geometry_for(&page, 5), &p, 4, r"\sffamily");
        assert_eq!(lines.len(), 4);
        assert_eq!(dots.len(), 1);
        assert!(texts.is_empty());
    }
}
