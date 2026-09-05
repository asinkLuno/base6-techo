use serde::Deserialize;

use super::colors::BLACK;
use super::{Dot, Geometry, Line, LineStyle, validate_color};

/// 古文竖排：文武线双框（外粗内细）+ 界栏竖列线，自右向左书写。
/// 界栏自版心中心向左右两边生成，最外侧放不下新一列即在此结束；
/// 文武线双框恰好围住整列数，余量留在框外，整块在版心内水平居中。
#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct VerticalPattern {
    pub(crate) pages: usize,
    pub(crate) spacing: f64,
    pub(crate) color: String,
    pub(crate) frame_outer_width: f64,
    pub(crate) frame_inner_width: f64,
    pub(crate) frame_gap: f64,
}

impl Default for VerticalPattern {
    fn default() -> Self {
        Self {
            pages: 1,
            spacing: 10.0,
            color: BLACK.into(),
            frame_outer_width: 0.5,
            frame_inner_width: 0.18,
            frame_gap: 1.2,
        }
    }
}

impl VerticalPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if !(1..=500).contains(&self.pages) {
            return Err("pages must be in 1..=500".into());
        }
        if self.spacing <= 0.0
            || self.frame_outer_width <= 0.0
            || self.frame_inner_width <= 0.0
            || self.frame_gap <= 0.0
        {
            return Err("vertical spacing, frame widths and frame gap must be > 0".into());
        }
        validate_color(&self.color)
    }
}

pub(crate) fn draw_vertical(geo: Geometry, p: &VerticalPattern) -> (Vec<Line>, Vec<Dot>) {
    let (w, h) = (geo.content.width, geo.content.height);
    if h <= 2.0 * p.frame_gap {
        return (vec![], vec![]);
    }
    let line = |x1, y1, x2, y2, width: f64| Line {
        x1,
        y1,
        x2,
        y2,
        color: Some(p.color.clone()),
        width: Some(width),
        style: LineStyle::Solid,
    };
    // 界栏：从版心中心向左右两边逐列生成，最外侧放不下新一列即止。
    let nx = ((w - 2.0 * p.frame_gap) / p.spacing).floor();
    if nx < 1.0 {
        return (vec![], vec![]);
    }
    let iw = nx * p.spacing;
    let ow = iw + 2.0 * p.frame_gap;
    let (x, y) = (geo.content.x + (w - ow) / 2.0, geo.content.y);
    let mut lines = Vec::new();
    // 文武线：外框粗、内框细，双框恰好围住整列数。
    let (ix, iy, ih) = (x + p.frame_gap, y + p.frame_gap, h - 2.0 * p.frame_gap);
    lines.push(line(x, y, x + ow, y, p.frame_outer_width));
    lines.push(line(x, y + h, x + ow, y + h, p.frame_outer_width));
    lines.push(line(x, y, x, y + h, p.frame_outer_width));
    lines.push(line(x + ow, y, x + ow, y + h, p.frame_outer_width));
    lines.push(line(ix, iy, ix + iw, iy, p.frame_inner_width));
    lines.push(line(ix, iy + ih, ix + iw, iy + ih, p.frame_inner_width));
    lines.push(line(ix, iy, ix, iy + ih, p.frame_inner_width));
    lines.push(line(ix + iw, iy, ix + iw, iy + ih, p.frame_inner_width));
    // 只画列与列之间的内部竖分隔线。
    for col in 1..nx as usize {
        let x = ix + col as f64 * p.spacing;
        lines.push(line(x, iy, x, iy + ih, p.frame_inner_width));
    }
    (lines, vec![])
}
