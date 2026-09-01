use serde::Deserialize;

use super::colors::GRAY;
use super::{Dot, Geometry, Line, LineStyle, centered, validate_color};

/// 网格：内容区内等距方格。
#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct GridPattern {
    pub(crate) pages: usize,
    pub(crate) spacing: f64,
    pub(crate) color: String,
    pub(crate) width: f64,
}

impl Default for GridPattern {
    fn default() -> Self {
        Self {
            pages: 1,
            spacing: 5.0,
            color: GRAY.into(),
            width: 0.2,
        }
    }
}

impl GridPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if !(1..=500).contains(&self.pages) {
            return Err("pages must be in 1..=500".into());
        }
        if self.spacing <= 0.0 || self.width <= 0.0 {
            return Err("grid spacing and width must be > 0".into());
        }
        validate_color(&self.color)
    }
}

pub(crate) fn draw_grid(geo: Geometry, p: &GridPattern) -> (Vec<Line>, Vec<Dot>) {
    let line = |x1, y1, x2, y2| Line {
        x1,
        y1,
        x2,
        y2,
        color: Some(p.color.clone()),
        width: Some(p.width),
        style: LineStyle::Solid,
    };
    let mut lines: Vec<Line> = centered(geo.content.y, geo.content.height, p.spacing)
        .into_iter()
        .map(|y| line(geo.content.x, y, geo.content.x + geo.content.width, y))
        .collect();
    lines.extend(
        centered(geo.content.x, geo.content.width, p.spacing)
            .into_iter()
            .map(|x| line(x, geo.content.y, x, geo.content.y + geo.content.height)),
    );
    (lines, vec![])
}
