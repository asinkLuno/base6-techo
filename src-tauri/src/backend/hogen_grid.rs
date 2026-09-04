use serde::Deserialize;

use super::colors::PALE_JADE;
use super::{Dot, Geometry, Line, LineStyle, region, validate_color};

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct HogenGridPattern {
    pub(crate) pages: usize,
    pub(crate) line_color: String,
}

impl Default for HogenGridPattern {
    fn default() -> Self {
        Self {
            pages: 1,
            line_color: PALE_JADE.into(),
        }
    }
}

impl HogenGridPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if !(1..=500).contains(&self.pages) {
            return Err("pages must be in 1..=500".into());
        }
        validate_color(&self.line_color)
    }
}

pub(crate) fn draw_hogen_grid(geo: Geometry, p: &HogenGridPattern) -> (Vec<Line>, Vec<Dot>) {
    let r = region(geo, false, false, false, false);
    let spacing = 5.0;
    let gap = 1.0;
    let edge_extension = 1.2;
    let dot_frequency = 10;
    let dot_radius = 0.4;
    let inset = gap + edge_extension;
    let nx = ((r.width - 2.0 * inset) / spacing).floor().max(0.0) as usize;
    let ny = ((r.height - 2.0 * inset) / spacing).floor().max(0.0) as usize;
    if nx == 0 || ny == 0 {
        return (vec![], vec![]);
    }
    let w = nx as f64 * spacing;
    let h = ny as f64 * spacing;
    let sx = r.x + (r.width - w) / 2.0;
    let sy = r.y + (r.height - h) / 2.0;
    let xd = dot_indices(nx, dot_frequency);
    let yd = dot_indices(ny, dot_frequency);
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
        let y = sy + row as f64 * spacing;
        lines.push(line(sx, y, sx + w, y));
        if row % 2 == 0 && !yd.contains(&row) && row > 0 && row < ny {
            lines.push(line(sx - gap - edge_extension, y, sx - gap, y));
            lines.push(line(sx + w + gap, y, sx + w + gap + edge_extension, y));
        }
    }
    for col in 0..=nx {
        let x = sx + col as f64 * spacing;
        if col % 2 == 0 && !xd.contains(&col) && col > 0 && col < nx {
            lines.push(line(x, sy - gap - edge_extension, x, sy - gap));
            lines.push(line(x, sy + h + gap, x, sy + h + gap + edge_extension));
        }
        for row in 0..ny {
            lines.push(line(
                x,
                sy + row as f64 * spacing + gap,
                x,
                sy + (row + 1) as f64 * spacing,
            ));
        }
    }
    let mut dots = Vec::new();
    let dot = |x, y| Dot {
        x,
        y,
        radius: dot_radius,
        color: Some(p.line_color.clone()),
        square: false,
        fill: true,
    };
    for col in xd {
        let x = sx + col as f64 * spacing;
        dots.push(dot(x, sy - 1.5));
        dots.push(dot(x, sy + h + 1.5));
    }
    for row in yd {
        let y = sy + row as f64 * spacing;
        dots.push(dot(sx - 1.5, y));
        dots.push(dot(sx + w + 1.5, y));
    }
    (lines, dots)
}

fn dot_indices(cells: usize, frequency: usize) -> std::collections::BTreeSet<usize> {
    let middle = cells / 2;
    let mut out = std::collections::BTreeSet::new();
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pages_bounds_1_to_500() {
        assert!(
            HogenGridPattern {
                pages: 0,
                ..Default::default()
            }
            .validate()
            .is_err()
        );
        assert!(
            HogenGridPattern {
                pages: 501,
                ..Default::default()
            }
            .validate()
            .is_err()
        );
        assert!(
            HogenGridPattern {
                pages: 2,
                ..Default::default()
            }
            .validate()
            .is_ok()
        );
    }
}
