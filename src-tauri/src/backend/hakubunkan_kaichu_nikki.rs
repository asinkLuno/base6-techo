use chinese_lunisolar_calendar::LunisolarDate;
use chrono::{Datelike, Duration, NaiveDate};
use serde::Deserialize;

use super::colors::GRAY;
use super::{
    Geometry, Line, LineStyle, Text, format_date, lunar_date, validate_color, validate_date_format,
    validate_weekday_headers,
};

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum LunarStyle {
    Numeric,
    Traditional,
}

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct HakubunkanKaichuNikkiPattern {
    pub(crate) start_date: NaiveDate,
    pub(crate) end_date: NaiveDate,
    pub(crate) date_format: String,
    pub(crate) date_locale: String,
    pub(crate) weekday_headers: String,
    pub(crate) lunar_style: LunarStyle,
    pub(crate) line_color: String,
    pub(crate) line_width: f64,
    pub(crate) date_size: f64,
}

impl Default for HakubunkanKaichuNikkiPattern {
    fn default() -> Self {
        let today = chrono::Utc::now().date_naive();
        Self {
            start_date: today,
            end_date: today + Duration::days(1),
            date_format: "%-m 月  %-d 日".into(),
            date_locale: "zh-CN".into(),
            weekday_headers: "月,火,水,木,金,土,日".into(),
            lunar_style: LunarStyle::Numeric,
            line_color: GRAY.into(),
            line_width: 0.4,
            date_size: 10.0,
        }
    }
}

impl HakubunkanKaichuNikkiPattern {
    fn date_format(&self) -> String {
        self.date_format
            .replace("%a", "")
            .replace("%A", "")
            .trim()
            .into()
    }

    pub(crate) fn validate(&self) -> Result<(), String> {
        if self.end_date < self.start_date {
            return Err("结束日期必须晚于或等于开始日期".into());
        }
        if self.line_width <= 0.0 || self.date_size <= 0.0 {
            return Err("line_width and date_size must be > 0".into());
        }
        validate_color(&self.line_color)?;
        validate_weekday_headers(&self.weekday_headers)?;
        validate_date_format(&self.date_format(), &self.date_locale)?;
        if [self.start_date, self.end_date]
            .into_iter()
            .any(|date| LunisolarDate::try_from(date).is_err())
        {
            return Err("农历日期仅支持 1901-02-19 至 2101-01-28".into());
        }
        Ok(())
    }

    pub(crate) fn page_count(&self) -> usize {
        ((self.end_date - self.start_date).num_days() as usize + 2) / 2
    }
}

pub(crate) fn draw_hakubunkan_kaichu_nikki(
    geo: Geometry,
    p: &HakubunkanKaichuNikkiPattern,
    index: usize,
    font: &str,
) -> (Vec<Line>, Vec<Text>) {
    let r = geo.content;
    let half_h = r.height / 2.0;
    let header_h = 8.0_f64.min(half_h * 0.12);
    let weather_w = 10.0_f64.min(r.width * 0.1);
    let line = |x1, y1, x2, y2| Line {
        x1,
        y1,
        x2,
        y2,
        color: Some(p.line_color.clone()),
        width: Some(p.line_width),
        style: LineStyle::Solid,
    };
    let mut lines = Vec::with_capacity(9);
    let mut texts = Vec::new();
    let weekdays = p
        .weekday_headers
        .split(',')
        .map(str::trim)
        .collect::<Vec<_>>();
    lines.extend([
        line(r.x, r.y, r.x + r.width, r.y),
        line(r.x, r.y + r.height, r.x + r.width, r.y + r.height),
        line(r.x, r.y, r.x, r.y + r.height),
        line(r.x + r.width, r.y, r.x + r.width, r.y + r.height),
        line(r.x, r.y + half_h, r.x + r.width, r.y + half_h),
    ]);
    for slot in 0..2 {
        let y = r.y + slot as f64 * half_h;
        lines.push(line(r.x, y + header_h, r.x + r.width, y + header_h));
        lines.push(line(
            r.x + r.width - weather_w,
            y + header_h,
            r.x + r.width - weather_w,
            y + half_h,
        ));
        let date = p.start_date + Duration::days((index * 2 + slot) as i64);
        if date <= p.end_date {
            let header = |x, content: String, anchor| Text {
                x,
                y: y + header_h / 2.0,
                content,
                size: p.date_size,
                color: p.line_color.clone(),
                rotation: 0,
                font: font.into(),
                anchor,
            };
            texts.push(header(
                r.x + 3.0,
                weekdays[date.weekday().num_days_from_monday() as usize].into(),
                "west",
            ));
            texts.push(header(
                r.x + r.width / 2.0,
                format_date(date, &p.date_format(), &p.date_locale),
                "center",
            ));
            if let Ok(lunar) = LunisolarDate::try_from(date) {
                let month = lunar.to_lunar_month();
                let content = match p.lunar_style {
                    LunarStyle::Numeric => format!(
                        "旧 {}{}.{:02}",
                        if month.is_leap_month() { "閏" } else { "" },
                        month.to_u8(),
                        u8::from(lunar.to_lunar_day())
                    ),
                    LunarStyle::Traditional => lunar_date(date).expect("converted above"),
                };
                let mut lunar_text = header(r.x + r.width - 3.0, content, "east");
                lunar_text.size = p.date_size * 0.7;
                texts.push(lunar_text);
            }
            // 天气竖直排在栏上部靠上、气温在栏中心；坐标由格子几何推导，
            // 竖排两行以 center 锚点定位，随字号/页型自适应，不越出天气栏。
            for (label, frac) in [("天気", 0.30), ("気温", 0.5)] {
                let ly = y + header_h + (half_h - header_h) * frac;
                texts.push(Text {
                    x: r.x + r.width - weather_w / 2.0,
                    y: ly,
                    content: label
                        .chars()
                        .map(|c| c.to_string())
                        .collect::<Vec<_>>()
                        .join("\n"),
                    size: p.date_size,
                    color: p.line_color.clone(),
                    rotation: 0,
                    font: font.into(),
                    anchor: "center",
                });
            }
        }
    }
    (lines, texts)
}

#[cfg(test)]
mod tests {
    use super::super::{PageSettings, geometry_for};
    use super::*;

    #[test]
    fn renders_two_consecutive_days_per_page() {
        let p = HakubunkanKaichuNikkiPattern {
            start_date: NaiveDate::from_ymd_opt(2026, 1, 3).unwrap(),
            end_date: NaiveDate::from_ymd_opt(2026, 1, 6).unwrap(),
            date_format: "%a    %-m 月  %-d 日".into(),
            ..Default::default()
        };
        assert_eq!(p.page_count(), 2);
        let (_, texts) = draw_hakubunkan_kaichu_nikki(
            geometry_for(&PageSettings::default(), 2),
            &p,
            1,
            r"\rmfamily",
        );
        assert!(texts.iter().any(|t| t.content.contains("5 日")));
        assert!(texts.iter().any(|t| t.content.contains("6 日")));
        assert!(texts.iter().any(|t| t.content == "月"));
        assert!(texts.iter().any(|t| t.content.starts_with("旧 ")));
        assert!(texts.iter().all(|t| !t.content.starts_with("一 ")));
    }
}
