use serde::Deserialize;

use super::colors::GRAY;
use super::{Dot, Geometry, Line, centered, validate_color};

/// 点阵：内容区内等距点阵（行距 spacing、列距 column_spacing）。
#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct DotsPattern {
    pub(crate) pages: usize,
    pub(crate) spacing: f64,
    pub(crate) column_spacing: f64,
    pub(crate) radius: f64,
    pub(crate) color: String,
    /// 中心点单独颜色；None 表示与 color 一致。
    pub(crate) center_color: Option<String>,
}

impl Default for DotsPattern {
    fn default() -> Self {
        Self {
            pages: 1,
            spacing: 5.0,
            column_spacing: 5.0,
            radius: 0.3,
            color: GRAY.into(),
            center_color: None,
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
        validate_color(&self.color)?;
        if let Some(c) = &self.center_color {
            validate_color(c)?;
        }
        Ok(())
    }
}

pub(crate) fn draw_dots(geo: Geometry, p: &DotsPattern) -> (Vec<Line>, Vec<Dot>) {
    // 点阵从内容区中心往四周扩散：centered 在每个方向都以几何中心为对称点，
    // 所以 x/y 序列的中位索引即为最接近中心的那个点。
    let ys = centered(geo.content.y, geo.content.height, p.spacing);
    let xs = centered(geo.content.x, geo.content.width, p.column_spacing);
    let cy = ys.len() / 2;
    let cx = xs.len() / 2;
    let center_color = p.center_color.as_deref();
    let dots = ys
        .into_iter()
        .enumerate()
        .flat_map(|(iy, y)| {
            xs.iter().enumerate().map(move |(ix, x)| Dot {
                x: *x,
                y,
                radius: p.radius,
                color: Some(if iy == cy && ix == cx {
                    center_color.unwrap_or(&p.color).to_string()
                } else {
                    p.color.clone()
                }),
                square: false,
                fill: true,
            })
        })
        .collect();
    (vec![], dots)
}
