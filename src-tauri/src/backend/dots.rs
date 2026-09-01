use serde::Deserialize;

use super::colors::GRAY;
use super::{Dot, Geometry, Line, LineStyle, centered, validate_color};

/// 点阵：内容区内等距点阵（行距 spacing、列距 column_spacing）。
#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct DotsPattern {
    pub(crate) pages: usize,
    pub(crate) spacing: f64,
    pub(crate) column_spacing: f64,
    pub(crate) radius: f64,
    pub(crate) color: String,
}

impl Default for DotsPattern {
    fn default() -> Self {
        Self {
            pages: 1,
            spacing: 5.0,
            column_spacing: 5.0,
            radius: 0.3,
            color: GRAY.into(),
        }
    }
}

impl DotsPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if !(1..=500).contains(&self.pages) {
            return Err("pages must be in 1..=500".into());
        }
        if self.spacing <= 0.0 || self.column_spacing <= 0.0 || self.radius <= 0.0 {
            return Err("dots spacing and radius must be > 0".into());
        }
        validate_color(&self.color)
    }
}

pub(crate) fn draw_dots(geo: Geometry, p: &DotsPattern) -> (Vec<Line>, Vec<Dot>) {
    let dots = centered(geo.content.y, geo.content.height, p.spacing)
        .into_iter()
        .flat_map(|y| {
            centered(geo.content.x, geo.content.width, p.column_spacing)
                .into_iter()
                .map(move |x| Dot {
                    x,
                    y,
                    radius: p.radius,
                    color: Some(p.color.clone()),
                    square: false,
                })
        })
        .collect();
    (vec![], dots)
}
