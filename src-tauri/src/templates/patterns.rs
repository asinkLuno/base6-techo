//! 页心模板扩展点。模板只消费已解析的页面上下文，不推算装订方向。
use super::{
    document::PageContext,
    latex::Canvas,
    layout::{PageLayout, Rect, check_range},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum BodyTemplate {
    #[default]
    Blank,
    #[serde(alias = "lined")]
    Linear(LinearPattern),
    Dots(DotsPattern),
    Grid(GridPattern),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct LinearPattern {
    pub spacing_mm: f64,
    pub color: String,
    pub line_width_pt: f64,
}

impl Default for LinearPattern {
    fn default() -> Self {
        Self {
            spacing_mm: 7.0,
            color: "#9E9E9E".into(),
            line_width_pt: 0.4,
        }
    }
}

/// 点阵：页心内以中心为对称点、按行距/列距等距铺开的圆点。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct DotsPattern {
    pub spacing_mm: f64,
    pub column_spacing_mm: f64,
    pub radius_mm: f64,
    pub color: String,
    /// 中心点单独颜色；None 表示与 color 一致。
    pub center_color: Option<String>,
}

impl Default for DotsPattern {
    fn default() -> Self {
        Self {
            spacing_mm: 5.0,
            column_spacing_mm: 5.0,
            radius_mm: 0.25,
            color: "#7A7A7A".into(),
            center_color: Some("#000000".into()),
        }
    }
}

/// 方格：页心内等距方格，四周封闭边框（锁边）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct GridPattern {
    pub spacing_mm: f64,
    pub color: String,
    pub line_width_pt: f64,
}

impl Default for GridPattern {
    fn default() -> Self {
        Self {
            spacing_mm: 5.0,
            color: "#7A9AC9".into(),
            line_width_pt: 0.2,
        }
    }
}

/// 以区域中心为对称点向两侧扩展，返回落在区域内的最大等距序列。
fn centered(start: f64, length: f64, spacing: f64) -> Vec<f64> {
    let center = start + length / 2.0;
    let k = ((length / 2.0 / spacing) + 1e-9).floor() as i64;
    (-k..=k).map(|i| center + i as f64 * spacing).collect()
}

impl BodyTemplate {
    /// 空白页心不产生任何绘制，调用方可跳过区域裁剪。
    pub(crate) fn is_empty(&self) -> bool {
        matches!(self, Self::Blank)
    }

    pub(crate) fn validate(&self) -> Result<(), String> {
        match self {
            Self::Linear(p) => {
                check_range("横线间距（mm）", p.spacing_mm, 0.1, 1000.0)?;
                check_range("横线线宽（pt）", p.line_width_pt, 0.01, 10.0)?;
                super::latex::validate_color(&p.color)?;
            }
            Self::Dots(p) => {
                check_range("点阵行距（mm）", p.spacing_mm, 0.1, 1000.0)?;
                check_range("点阵列距（mm）", p.column_spacing_mm, 0.1, 1000.0)?;
                check_range("点半径（mm）", p.radius_mm, 0.01, 10.0)?;
                super::latex::validate_color(&p.color)?;
                if let Some(color) = &p.center_color {
                    super::latex::validate_color(color)?;
                }
            }
            Self::Grid(p) => {
                check_range("方格间距（mm）", p.spacing_mm, 0.1, 1000.0)?;
                check_range("方格线宽（pt）", p.line_width_pt, 0.01, 10.0)?;
                super::latex::validate_color(&p.color)?;
            }
            Self::Blank => {}
        }
        Ok(())
    }

    pub(crate) fn draw(
        &self,
        canvas: &mut Canvas<'_>,
        layout: &PageLayout,
        _context: &PageContext,
    ) {
        let body = layout.body;
        match self {
            Self::Linear(p) => {
                // 与点阵一致：以页心中心为对称点，先落中间一条，再上下等距扩展。
                let ys = centered(body.y, body.height, p.spacing_mm);
                let Some(&first_y) = ys.first() else {
                    return;
                };
                canvas.line_grid(body, first_y, p.spacing_mm, p.line_width_pt, &p.color);
            }
            Self::Dots(p) => {
                let xs = centered(body.x, body.width, p.column_spacing_mm);
                let ys = centered(body.y, body.height, p.spacing_mm);
                let (Some(&x_min), Some(&x_max)) = (xs.first(), xs.last()) else {
                    return;
                };
                let (Some(&y_min), Some(&y_max)) = (ys.first(), ys.last()) else {
                    return;
                };
                // 均匀点阵用 TikZ pattern 一次填充；逐点 \fill 在数百页时会撑爆 TeX 内存。
                canvas.dot_grid(
                    x_min,
                    y_min,
                    x_max,
                    y_max,
                    p.column_spacing_mm,
                    p.spacing_mm,
                    p.radius_mm,
                    &p.color,
                );
                if let Some(center_color) = p.center_color.as_deref()
                    && center_color != p.color.as_str()
                {
                    canvas.dot(
                        xs[xs.len() / 2],
                        ys[ys.len() / 2],
                        p.radius_mm,
                        center_color,
                    );
                }
            }
            Self::Grid(p) => {
                // 与横线、点阵一致：以页心中心为起点向四周等距扩展，
                // 四周最外侧的格线自然收口成边框。
                let xs = centered(body.x, body.width, p.spacing_mm);
                let ys = centered(body.y, body.height, p.spacing_mm);
                if xs.len() < 2 || ys.len() < 2 {
                    return;
                }
                let (Some(&x_min), Some(&x_max)) = (xs.first(), xs.last()) else {
                    return;
                };
                let (Some(&y_min), Some(&y_max)) = (ys.first(), ys.last()) else {
                    return;
                };
                canvas.cross_grid(
                    Rect {
                        x: x_min,
                        y: y_min,
                        width: x_max - x_min,
                        height: y_max - y_min,
                    },
                    p.spacing_mm,
                    p.line_width_pt,
                    &p.color,
                );
            }
            Self::Blank => {}
        }
    }
}
