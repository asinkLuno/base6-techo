use serde::Deserialize;

use super::colors::GRAY;
use super::{Dot, Geometry, Line, LineStyle, centered, validate_color};

/// 横线本：内容区内等距横线，左右通边。
#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct RuledPattern {
    pub(crate) pages: usize,
    pub(crate) spacing: f64,
    pub(crate) color: String,
    pub(crate) width: f64,
}

impl Default for RuledPattern {
    fn default() -> Self {
        Self {
            pages: 1,
            spacing: 8.0,
            color: GRAY.into(),
            width: 0.2,
        }
    }
}

impl RuledPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if !(1..=500).contains(&self.pages) {
            return Err("pages must be in 1..=500".into());
        }
        if self.spacing <= 0.0 || self.width <= 0.0 {
            return Err("ruled spacing and width must be > 0".into());
        }
        validate_color(&self.color)
    }
}

pub(crate) fn draw_ruled(geo: Geometry, p: &RuledPattern) -> (Vec<Line>, Vec<Dot>) {
    let lines = centered(geo.content.y, geo.content.height, p.spacing)
        .into_iter()
        .map(|y| Line {
            x1: geo.content.x,
            y1: y,
            x2: geo.content.x + geo.content.width,
            y2: y,
            color: Some(p.color.clone()),
            width: Some(p.width),
            style: LineStyle::Solid,
        })
        .collect();
    (lines, vec![])
}
