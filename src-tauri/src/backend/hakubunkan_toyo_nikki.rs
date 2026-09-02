use chinese_lunisolar_calendar::LunisolarDate;
use chrono::{Duration, NaiveDate, Utc};
use serde::Deserialize;

use super::colors::PALE_JADE;
use super::{
    Geometry, Line, LineStyle, Rect, Text, format_date, validate_color, validate_date_format,
};

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct HakubunkanToyoNikkiPattern {
    pub(crate) start_date: NaiveDate,
    pub(crate) end_date: NaiveDate,
    pub(crate) date_format: String,
    pub(crate) line_color: String,
    pub(crate) faint_color: String,
    pub(crate) line_width: f64,
}

impl Default for HakubunkanToyoNikkiPattern {
    fn default() -> Self {
        let today = Utc::now().date_naive();
        Self {
            start_date: today,
            end_date: today,
            date_format: "%-m月%-d日".into(),
            line_color: PALE_JADE.into(),
            faint_color: PALE_JADE.into(),
            line_width: 0.4,
        }
    }
}

impl HakubunkanToyoNikkiPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if self.end_date < self.start_date {
            return Err("结束日期必须晚于或等于开始日期".into());
        }
        if self.line_width <= 0.0 {
            return Err("line_width must be > 0".into());
        }
        validate_color(&self.line_color)?;
        validate_color(&self.faint_color)?;
        validate_date_format(&self.date_format, "zh-CN")
    }

    pub(crate) fn page_count(&self) -> usize {
        (self.end_date - self.start_date).num_days() as usize + 1
    }
}

pub(crate) fn lunar_date(date: NaiveDate) -> Option<String> {
    let lunar = LunisolarDate::try_from(date).ok()?;
    Some(format!(
        "{:#}{:#}",
        lunar.to_lunar_month(),
        lunar.to_lunar_day()
    ))
}

pub(crate) fn draw_hakubunkan_toyo_nikki(
    geo: Geometry,
    p: &HakubunkanToyoNikkiPattern,
    index: usize,
    font: &str,
) -> (Vec<Line>, Vec<Text>) {
    let content = geo.content;
    let title_h = 10.0_f64.min(content.height * 0.08);
    let r = Rect {
        y: content.y + title_h,
        height: content.height - title_h,
        ..content
    };
    let split_y = r.y + r.height * 0.24;
    let solid = |x1, y1, x2, y2| Line {
        x1,
        y1,
        x2,
        y2,
        color: Some(p.line_color.clone()),
        width: Some(p.line_width),
        style: LineStyle::Solid,
    };
    let faint = |x1, y1, x2, y2| Line {
        x1,
        y1,
        x2,
        y2,
        color: Some(p.faint_color.clone()),
        width: Some(p.line_width / 2.0),
        style: LineStyle::Dotted,
    };
    let mut lines = vec![
        solid(r.x, r.y, r.x + r.width, r.y),
        solid(r.x, split_y, r.x + r.width, split_y),
        solid(r.x, r.y + r.height, r.x + r.width, r.y + r.height),
        solid(r.x, r.y, r.x, r.y + r.height),
        solid(r.x + r.width, r.y, r.x + r.width, r.y + r.height),
    ];
    for fraction in [0.21, 0.42, 0.91] {
        let x = r.x + r.width * fraction;
        lines.push(faint(x, r.y, x, split_y));
    }
    let narrow_x = r.x + r.width * 0.91;
    let header_y = r.y + (split_y - r.y) * 0.14;
    lines.push(faint(r.x, header_y, r.x + r.width * 0.42, header_y));
    let side_y = r.y + (split_y - r.y) * 0.51;
    lines.push(faint(narrow_x, side_y, r.x + r.width, side_y));
    for column in 1..14 {
        let x = r.x + r.width * column as f64 / 14.0;
        lines.push(faint(x, split_y, x, r.y + r.height));
    }
    let label = |x, y, content: &str, anchor| Text {
        x,
        y,
        content: content.into(),
        size: 7.0,
        color: p.line_color.clone(),
        rotation: 0,
        font: font.into(),
        anchor,
    };
    let top_h = split_y - r.y;
    let texts = vec![
        Text {
            x: content.x + content.width / 2.0,
            y: content.y + title_h / 2.0,
            content: format_date(
                p.start_date + Duration::days(index as i64),
                &p.date_format,
                "zh-CN",
            ),
            size: 16.0,
            color: p.line_color.clone(),
            rotation: 0,
            font: font.into(),
            anchor: "center",
        },
        label(r.x + r.width * 0.105, r.y + top_h * 0.07, "受信", "center"),
        label(r.x + r.width * 0.315, r.y + top_h * 0.07, "发信", "center"),
        label(r.x + r.width * 0.875, r.y + top_h * 0.5, "摘\n记", "center"),
        label(r.x + r.width * 0.955, r.y + top_h * 0.2, "天\n气", "center"),
        label(
            r.x + r.width * 0.955,
            r.y + top_h * 0.74,
            "气\n温",
            "center",
        ),
    ];
    (lines, texts)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn august_2026_uses_real_lunar_dates() {
        let dates = (1..=31)
            .map(|day| lunar_date(NaiveDate::from_ymd_opt(2026, 8, day).unwrap()))
            .collect::<Vec<_>>();
        assert!(dates.iter().all(Option::is_some));
        assert_eq!(dates.first().unwrap().as_deref(), Some("六月十九"));
        assert_eq!(dates.last().unwrap().as_deref(), Some("七月十九"));
    }

    #[test]
    fn diary_labels_match_the_original_sections() {
        let (_, texts) = draw_hakubunkan_toyo_nikki(
            super::super::geometry_for(&super::super::PageSettings::default(), 1),
            &HakubunkanToyoNikkiPattern::default(),
            0,
            r"\sffamily",
        );
        assert_eq!(
            texts
                .iter()
                .skip(1)
                .map(|text| text.content.as_str())
                .collect::<Vec<_>>(),
            ["受信", "发信", "摘\n记", "天\n气", "气\n温"]
        );
    }

    #[test]
    fn date_range_creates_one_dated_page_per_day() {
        let p = HakubunkanToyoNikkiPattern {
            start_date: NaiveDate::from_ymd_opt(2026, 1, 2).unwrap(),
            end_date: NaiveDate::from_ymd_opt(2026, 1, 3).unwrap(),
            ..Default::default()
        };
        assert_eq!(p.page_count(), 2);
        let (_, texts) = draw_hakubunkan_toyo_nikki(
            super::super::geometry_for(&super::super::PageSettings::default(), 2),
            &p,
            1,
            r"\sffamily",
        );
        assert_eq!(texts[0].content, "1月3日");
    }
}
