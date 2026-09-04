use serde::Deserialize;

use super::colors::GRAY;
use super::{Dot, Geometry, Line, LineStyle, validate_color};

/// 网格：内容区内等距方格，四周封闭边框（锁边）。
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
    let nx = (geo.content.width / p.spacing).floor().max(0.0);
    let ny = (geo.content.height / p.spacing).floor().max(0.0);
    if nx < 1.0 || ny < 1.0 {
        return (vec![], vec![]);
    }
    let w = nx * p.spacing;
    let h = ny * p.spacing;
    let sx = geo.content.x + (geo.content.width - w) / 2.0;
    let sy = geo.content.y + (geo.content.height - h) / 2.0;
    let line = |x1, y1, x2, y2| Line {
        x1,
        y1,
        x2,
        y2,
        color: Some(p.color.clone()),
        width: Some(p.width),
        style: LineStyle::Solid,
    };
    // 锁边：四条边框。
    let mut lines = vec![
        line(sx, sy, sx + w, sy),
        line(sx, sy + h, sx + w, sy + h),
        line(sx, sy, sx, sy + h),
        line(sx + w, sy, sx + w, sy + h),
    ];
    // 内部横线与竖线。
    for row in 1..ny as usize {
        let y = sy + row as f64 * p.spacing;
        lines.push(line(sx, y, sx + w, y));
    }
    for col in 1..nx as usize {
        let x = sx + col as f64 * p.spacing;
        lines.push(line(x, sy, x, sy + h));
    }
    (lines, vec![])
}
