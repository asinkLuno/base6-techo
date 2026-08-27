use chinese_lunisolar_calendar::LunisolarDate;
use chrono::NaiveDate;
use serde::Deserialize;

use super::{Geometry, Line, LineStyle, validate_color};

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct BunkwanPattern {
    pub(crate) line_color: String,
    pub(crate) faint_color: String,
    pub(crate) line_width: f64,
}

impl Default for BunkwanPattern {
    fn default() -> Self {
        Self {
            line_color: "#31584A".into(),
            faint_color: "#82968E".into(),
            line_width: 0.4,
        }
    }
}

impl BunkwanPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if self.line_width <= 0.0 {
            return Err("line_width must be > 0".into());
        }
        validate_color(&self.line_color)?;
        validate_color(&self.faint_color)
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

pub(crate) fn draw_bunkwan(geo: Geometry, p: &BunkwanPattern) -> Vec<Line> {
    let r = geo.content;
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
    lines
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
}
