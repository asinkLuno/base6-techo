use serde::Deserialize;

use super::colors::GRAY;
use super::{Dot, Geometry, Line, LineStyle, centered, validate_color};

/// 法文格（Séyès）：8mm 主方格 + 每格 3 条 2mm 细分线 + 一根红色竖线。
/// 横线在内容区内左右通边，竖线与边线贯穿整页高度。
#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct SeyesPattern {
    pub(crate) pages: usize,
    pub(crate) spacing: f64,
    pub(crate) margin_line: usize,
    pub(crate) main_color: String,
    pub(crate) main_width: f64,
    pub(crate) fine_color: String,
    pub(crate) fine_width: f64,
    pub(crate) vline_color: String,
    pub(crate) vline_width: f64,
    pub(crate) margin_color: String,
    pub(crate) margin_width: f64,
}

impl Default for SeyesPattern {
    fn default() -> Self {
        Self {
            pages: 1,
            spacing: 8.0,
            margin_line: 7,
            main_color: GRAY.into(),
            main_width: 0.2,
            fine_color: GRAY.into(),
            fine_width: 0.1,
            vline_color: GRAY.into(),
            vline_width: 0.1,
            margin_color: GRAY.into(),
            margin_width: 0.4,
        }
    }
}

impl SeyesPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if !(1..=500).contains(&self.pages) {
            return Err("pages must be in 1..=500".into());
        }
        if self.spacing <= 0.0
            || self.main_width <= 0.0
            || self.fine_width <= 0.0
            || self.vline_width <= 0.0
            || self.margin_width <= 0.0
        {
            return Err("seyes spacing and line widths must be > 0".into());
        }
        for color in [
            &self.main_color,
            &self.fine_color,
            &self.vline_color,
            &self.margin_color,
        ] {
            validate_color(color)?;
        }
        Ok(())
    }
}

pub(crate) fn draw_seyes(geo: Geometry, p: &SeyesPattern) -> (Vec<Line>, Vec<Dot>) {
    let mut lines = Vec::new();
    let line = |x1, y1, x2, y2, color: &str, width: f64| Line {
        x1,
        y1,
        x2,
        y2,
        color: Some(color.into()),
        width: Some(width),
        style: LineStyle::Solid,
    };
    // 主横线：内容区高度内，左右通边。
    let cy = geo.content.y + geo.content.height / 2.0;
    for y in centered(geo.content.y, geo.content.height, p.spacing) {
        lines.push(line(0.0, y, geo.page.width, y, &p.main_color, p.main_width));
    }
    // 细分线：spacing/4，相位与主线锁定，跳过与主线重合的行。
    let fine = p.spacing / 4.0;
    for y in centered(geo.content.y, geo.content.height, fine) {
        if (((y - cy).abs() / fine).round() as i64) % 4 == 0 {
            continue;
        }
        lines.push(line(0.0, y, geo.page.width, y, &p.fine_color, p.fine_width));
    }
    // 通页竖线：整页高度，内容区宽度内每 8mm 一条。
    for (i, x) in centered(geo.content.x, geo.content.width, p.spacing)
        .into_iter()
        .enumerate()
    {
        let (color, width) = if p.margin_line != 0 && i + 1 == p.margin_line {
            (&p.margin_color, p.margin_width)
        } else {
            (&p.vline_color, p.vline_width)
        };
        lines.push(line(x, 0.0, x, geo.page.height, color, width));
    }
    (lines, vec![])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::backend::{PageSettings, geometry_for};

    #[test]
    fn draws_each_grid_vertical_once_and_colors_one_red() {
        let geo = geometry_for(&PageSettings::default(), 1);
        let pattern = SeyesPattern {
            margin_color: "#ff0000".into(),
            ..Default::default()
        };
        let (lines, _) = draw_seyes(geo, &pattern);
        let verticals = lines
            .iter()
            .filter(|line| line.x1 == line.x2)
            .collect::<Vec<_>>();

        assert_eq!(
            verticals.len(),
            centered(geo.content.x, geo.content.width, pattern.spacing).len()
        );
        assert_eq!(
            verticals
                .iter()
                .filter(|line| line.color.as_deref() == Some(pattern.margin_color.as_str()))
                .count(),
            1
        );
    }
}
