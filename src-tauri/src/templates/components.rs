//! 页头、页脚与两侧水印：共享布局结果，各自负责绘制。
use super::{
    document::PlannedPage,
    latex::{Canvas, validate_color},
    layout::{Rect, Side, check_range},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Align {
    #[default]
    Center,
    Inner,
    Outer,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum BandContent {
    #[default]
    Empty,
    Text {
        text: String,
    },
    /// 填空式年、月，与原横线本页头一致。
    Date,
}

impl BandContent {
    fn is_visible(&self) -> bool {
        match self {
            Self::Empty => false,
            Self::Text { text } => !text.is_empty(),
            Self::Date => true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct TextStyle {
    pub size_pt: f64,
    pub color: String,
}

impl Default for TextStyle {
    fn default() -> Self {
        Self {
            size_pt: 10.0,
            color: "#000000".into(),
        }
    }
}

impl TextStyle {
    fn validate(&self) -> Result<(), String> {
        check_range("字号（pt）", self.size_pt, 1.0, 72.0)?;
        validate_color(&self.color)
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct Band {
    pub content: BandContent,
    pub page_number: bool,
    pub align: Align,
    pub style: TextStyle,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct Watermark {
    pub text: String,
    pub style: TextStyle,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct Decorations {
    pub header: Band,
    pub footer: Band,
    pub inner_watermark: Option<Watermark>,
    pub outer_watermark: Option<Watermark>,
}

impl Decorations {
    pub(crate) fn validate(&self) -> Result<(), String> {
        self.header.style.validate()?;
        self.footer.style.validate()?;
        for watermark in [&self.inner_watermark, &self.outer_watermark]
            .into_iter()
            .flatten()
        {
            watermark.style.validate()?;
        }
        Ok(())
    }

    pub(crate) fn draw(&self, canvas: &mut Canvas<'_>, page: &PlannedPage<'_>) {
        let layout = &page.layout;
        self.header.draw(
            canvas,
            layout.header,
            layout.binding_side,
            page.context.display_number,
        );
        self.footer.draw(
            canvas,
            layout.footer,
            layout.binding_side,
            page.context.display_number,
        );
        for (watermark, region) in [
            (&self.inner_watermark, layout.inner),
            (&self.outer_watermark, layout.outer),
        ] {
            if let Some(watermark) = watermark
                && !watermark.text.is_empty()
            {
                let (x, y) = region.center();
                canvas.begin_region(region);
                canvas.text(x, y, &watermark.text, &watermark.style, "center", 90);
                canvas.end_region();
            }
        }
    }
}

impl Band {
    fn draw(
        &self,
        canvas: &mut Canvas<'_>,
        region: Rect,
        binding_side: Side,
        number: Option<usize>,
    ) {
        let number = if self.page_number { number } else { None };
        let has_content = self.content.is_visible();
        // 没有可见文字也没有页码时，整块区域留空，不输出空 scope。
        if !has_content && number.is_none() {
            return;
        }
        let (x, anchor) = self.position(region, binding_side);
        let (_, center_y) = region.center();
        let gap = self.style.size_pt * 25.4 / 72.27;
        // 同时有文字和页码时两行一组，整体在区域中垂直居中。
        let content_y = if has_content && number.is_some() {
            center_y - gap / 2.0
        } else {
            center_y
        };
        let number_y = if has_content {
            center_y + gap / 2.0
        } else {
            center_y
        };
        canvas.begin_region(region);
        self.draw_content(canvas, x, content_y, anchor);
        if let Some(number) = number {
            canvas.text(x, number_y, &number.to_string(), &self.style, anchor, 0);
        }
        canvas.end_region();
    }

    fn draw_content(&self, canvas: &mut Canvas<'_>, x: f64, y: f64, anchor: &str) {
        match &self.content {
            BandContent::Empty => {}
            BandContent::Text { text } => canvas.text(x, y, text, &self.style, anchor, 0),
            BandContent::Date => canvas.date(x, y, &self.style, anchor),
        }
    }

    fn position(&self, region: Rect, side: Side) -> (f64, &'static str) {
        match self.align {
            Align::Center => (region.center().0, "center"),
            Align::Inner if side == Side::Left => (region.x, "west"),
            Align::Outer if side == Side::Right => (region.x, "west"),
            _ => (region.x + region.width, "east"),
        }
    }
}
