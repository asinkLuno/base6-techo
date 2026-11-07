//! 页心模板扩展点。模板只消费已解析的页面上下文，不推算装订方向。
use super::{
    document::PageContext,
    latex::Canvas,
    layout::{PageLayout, check_range},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum BodyTemplate {
    #[default]
    Blank,
    #[serde(alias = "lined")]
    Linear(LinearPattern),
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

impl BodyTemplate {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if let Self::Linear(p) = self {
            check_range("横线间距（mm）", p.spacing_mm, 0.1, 1000.0)?;
            check_range("横线线宽（pt）", p.line_width_pt, 0.01, 10.0)?;
            super::latex::validate_color(&p.color)?;
        }
        Ok(())
    }

    pub(crate) fn draw(&self, canvas: &mut Canvas, layout: &PageLayout, _context: &PageContext) {
        let body = layout.body;
        if let Self::Linear(p) = self {
            // 从页心底部向上画；余量留在顶部，线条中心始终在页心内。
            let count = (body.height / p.spacing_mm + 1e-9).floor() as usize;
            for i in 0..=count {
                let y = body.y + body.height - i as f64 * p.spacing_mm;
                canvas.line(body.x, y, body.x + body.width, y, &p.color, p.line_width_pt);
            }
        }
    }
}
