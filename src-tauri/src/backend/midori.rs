use std::collections::BTreeSet;

use serde::Deserialize;

use super::{Dot, Geometry, Line, LineStyle, region, validate_color};

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct MidoriPattern {
    pub(crate) spacing: f64,
    pub(crate) gap: f64,
    pub(crate) edge_extension: f64,
    pub(crate) dot_frequency: usize,
    pub(crate) dot_radius: f64,
    pub(crate) line_width: f64,
    pub(crate) line_color: String,
    pub(crate) dot_color: String,
    pub(crate) header: bool,
    pub(crate) footer: bool,
    pub(crate) inner: bool,
    pub(crate) outer: bool,
}
impl Default for MidoriPattern {
    fn default() -> Self {
        Self {
            spacing: 5.0,
            gap: 1.0,
            edge_extension: 1.2,
            dot_frequency: 10,
            dot_radius: 0.4,
            line_width: 0.7,
            line_color: "#a9d1ae".into(),
            dot_color: "#a9d1ae".into(),
            header: false,
            footer: false,
            inner: false,
            outer: false,
        }
    }
}
impl MidoriPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if [
            self.spacing,
            self.gap,
            self.edge_extension,
            self.dot_radius,
            self.line_width,
        ]
        .into_iter()
        .any(|v| v <= 0.0)
            || self.dot_frequency == 0
        {
            return Err("midori dimensions and dot_frequency must be > 0".into());
        }
        validate_color(&self.line_color)?;
        validate_color(&self.dot_color)
    }
}

fn dot_indices(cells: usize, frequency: usize) -> BTreeSet<usize> {
    let middle = cells / 2;
    let mut out = BTreeSet::new();
    for step in 0..cells {
        let d = step * frequency;
        if middle >= d && middle - d > 0 {
            out.insert(middle - d);
        }
        if middle + d < cells {
            out.insert(middle + d);
        }
    }
    out
}

pub(crate) fn draw_midori(geo: Geometry, p: &MidoriPattern) -> (Vec<Line>, Vec<Dot>) {
    let r = region(geo, p.header, p.footer, p.inner, p.outer);
    let inset = p.gap + p.edge_extension;
    let nx = ((r.width - 2.0 * inset) / p.spacing).floor().max(0.0) as usize;
    let ny = ((r.height - 2.0 * inset) / p.spacing).floor().max(0.0) as usize;
    if nx == 0 || ny == 0 {
        return (vec![], vec![]);
    }
    let w = nx as f64 * p.spacing;
    let h = ny as f64 * p.spacing;
    let sx = r.x + (r.width - w) / 2.0;
    let sy = r.y + (r.height - h) / 2.0;
    let xd = dot_indices(nx, p.dot_frequency);
    let yd = dot_indices(ny, p.dot_frequency);
    let mut lines = Vec::new();
    let line = |x1, y1, x2, y2| Line {
        x1,
        y1,
        x2,
        y2,
        color: None,
        width: None,
        style: LineStyle::Solid,
    };
    for row in 0..=ny {
        let y = sy + row as f64 * p.spacing;
        lines.push(line(sx, y, sx + w, y));
        if row % 2 == 0 && !yd.contains(&row) && row > 0 && row < ny {
            lines.push(line(sx - p.gap - p.edge_extension, y, sx - p.gap, y));
            lines.push(line(
                sx + w + p.gap,
                y,
                sx + w + p.gap + p.edge_extension,
                y,
            ));
        }
    }
    for col in 0..=nx {
        let x = sx + col as f64 * p.spacing;
        if col % 2 == 0 && !xd.contains(&col) && col > 0 && col < nx {
            lines.push(line(x, sy - p.gap - p.edge_extension, x, sy - p.gap));
            lines.push(line(
                x,
                sy + h + p.gap,
                x,
                sy + h + p.gap + p.edge_extension,
            ));
        }
        for row in 0..ny {
            lines.push(line(
                x,
                sy + row as f64 * p.spacing + p.gap,
                x,
                sy + (row + 1) as f64 * p.spacing,
            ));
        }
    }
    let mut dots = Vec::new();
    let dot = |x, y| Dot {
        x,
        y,
        radius: p.dot_radius,
        color: Some(p.dot_color.clone()),
        square: false,
    };
    for col in xd {
        let x = sx + col as f64 * p.spacing;
        dots.push(dot(x, sy - 1.5));
        dots.push(dot(x, sy + h + 1.5));
    }
    for row in yd {
        let y = sy + row as f64 * p.spacing;
        dots.push(dot(sx - 1.5, y));
        dots.push(dot(sx + w + 1.5, y));
    }
    (lines, dots)
}
