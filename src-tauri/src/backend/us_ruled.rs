use serde::Deserialize;

use super::{Dot, Geometry, Line, LineStyle, centered, validate_color};

/// 美式横线本：蓝色宽横线（8.7mm，左右通边）+ 左侧红色竖边线（贯穿整页高度）。
#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct UsRuledPattern {
    pub(crate) pages: usize,
    pub(crate) spacing: f64,
    pub(crate) rule_color: String,
    pub(crate) rule_width: f64,
    pub(crate) margin_x: f64,
    pub(crate) margin_color: String,
    pub(crate) margin_width: f64,
}

impl Default for UsRuledPattern {
    fn default() -> Self {
        Self {
            pages: 1,
            spacing: 8.7,
            rule_color: "#8fb0d8".into(),
            rule_width: 0.2,
            margin_x: 25.0,
            margin_color: "#d96a6a".into(),
            margin_width: 0.4,
        }
    }
}

impl UsRuledPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if !(1..=500).contains(&self.pages) {
            return Err("pages must be in 1..=500".into());
        }
        if self.spacing <= 0.0 || self.rule_width <= 0.0 || self.margin_width <= 0.0 {
            return Err("us-ruled spacing and line widths must be > 0".into());
        }
        if self.margin_x < 0.0 {
            return Err("margin_x must be >= 0".into());
        }
        validate_color(&self.rule_color)?;
        validate_color(&self.margin_color)
    }
}

pub(crate) fn draw_us_ruled(geo: Geometry, p: &UsRuledPattern) -> (Vec<Line>, Vec<Dot>) {
    let line = |x1, y1, x2, y2, color: &str, width: f64| Line {
        x1,
        y1,
        x2,
        y2,
        color: Some(color.into()),
        width: Some(width),
        style: LineStyle::Solid,
    };
    let mut lines: Vec<Line> = centered(geo.content.y, geo.content.height, p.spacing)
        .into_iter()
        .map(|y| line(0.0, y, geo.page.width, y, &p.rule_color, p.rule_width))
        .collect();
    // 红边线：距页面左缘 margin_x，贯穿整页高度。
    lines.push(line(
        p.margin_x,
        0.0,
        p.margin_x,
        geo.page.height,
        &p.margin_color,
        p.margin_width,
    ));
    (lines, vec![])
}
