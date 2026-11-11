//! 全书共用的纸张与区域布局。坐标为毫米，原点在纸张左上角，y 向下。
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum PaperSize {
    A4,
    A5sTnStandard,
    TnPassport,
    A5,
    A6,
    A6fc,
    A6Personal,
    A6pw,
    A6Slim,
    A7,
    A7x127,
    B5,
    B6,
    B6Slim,
    M5x74,
    M5x67,
    M5x62,
    Letter,
    Custom { width_mm: f64, height_mm: f64 },
}

impl PaperSize {
    pub fn dims_mm(&self) -> (f64, f64) {
        match self {
            Self::A4 => (210.0, 297.0),
            Self::A5sTnStandard => (110.0, 210.0),
            Self::TnPassport => (88.0, 125.0),
            Self::A5 => (148.0, 210.0),
            Self::A6 => (105.0, 148.0),
            Self::A6fc => (108.0, 171.0),
            Self::A6Personal => (95.0, 171.0),
            Self::A6pw => (120.0, 170.0),
            Self::A6Slim => (80.0, 171.0),
            Self::A7 => (80.0, 120.0),
            Self::A7x127 => (80.0, 127.0),
            Self::B5 => (176.0, 250.0),
            Self::B6 => (125.0, 176.0),
            Self::B6Slim => (98.0, 176.0),
            Self::M5x74 => (74.0, 105.0),
            Self::M5x67 => (67.0, 105.0),
            Self::M5x62 => (62.0, 105.0),
            Self::Letter => (215.9, 279.4),
            Self::Custom {
                width_mm,
                height_mm,
            } => (*width_mm, *height_mm),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Left,
    Right,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct Margins {
    pub header_mm: f64,
    pub footer_mm: f64,
    pub inner_mm: f64,
    pub outer_mm: f64,
}

impl Default for Margins {
    /// A5（148×210）按 archive 的谐和边距规则推导：
    /// 装订 13、外侧 18、页头 15、页脚 19。
    fn default() -> Self {
        Self {
            header_mm: 15.0,
            footer_mm: 19.0,
            inner_mm: 13.0,
            outer_mm: 18.0,
        }
    }
}

impl Margins {
    /// 按纸张尺寸校验四周边距；section 覆盖与全书默认共用。
    pub(crate) fn validate_for(&self, paper: &PaperSize) -> Result<(), String> {
        let (width, height) = paper.dims_mm();
        for v in [self.header_mm, self.footer_mm, self.inner_mm, self.outer_mm] {
            check_range("区域留白", v, 0.0, 1000.0)?;
        }
        if width - self.inner_mm - self.outer_mm < 1.0
            || height - self.header_mm - self.footer_mm < 1.0
        {
            return Err("扣除四周留白后，页心宽高必须至少为 1mm".into());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct PageSettings {
    pub paper: PaperSize,
    pub margins: Margins,
}

impl Default for PageSettings {
    fn default() -> Self {
        Self {
            paper: PaperSize::A5,
            margins: Margins::default(),
        }
    }
}

impl PageSettings {
    pub(crate) fn validate(&self) -> Result<(), String> {
        let (width, height) = self.paper.dims_mm();
        for (name, value) in [("纸宽", width), ("纸高", height)] {
            check_range(name, value, 30.0, 1000.0)?;
        }
        self.margins.validate_for(&self.paper)
    }
}

pub(crate) fn check_range(name: &str, value: f64, min: f64, max: f64) -> Result<(), String> {
    if !value.is_finite() || !(min..=max).contains(&value) {
        return Err(format!("{name} 必须在 {min}–{max} 之间，收到 {value}"));
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Rect {
    pub fn center(self) -> (f64, f64) {
        (self.x + self.width / 2.0, self.y + self.height / 2.0)
    }
}

#[derive(Debug, Clone)]
pub struct PageLayout {
    pub paper: Rect,
    pub body: Rect,
    pub header: Rect,
    pub footer: Rect,
    pub inner: Rect,
    pub outer: Rect,
    pub binding_side: Side,
}

impl PageLayout {
    /// 只由编排层调用；physical_page 从 1 开始且跨节连续。
    pub(crate) fn resolve(settings: &PageSettings, physical_page: usize) -> Self {
        let (width, height) = settings.paper.dims_mm();
        let m = &settings.margins;
        // 装订固定在左侧：奇数页是右手页，装订边在左。
        let binding_left = physical_page % 2 == 1;
        let (left, right) = if binding_left {
            (m.inner_mm, m.outer_mm)
        } else {
            (m.outer_mm, m.inner_mm)
        };
        let body = Rect {
            x: left,
            y: m.header_mm,
            width: width - left - right,
            height: height - m.header_mm - m.footer_mm,
        };
        let left_region = Rect {
            x: 0.0,
            y: body.y,
            width: left,
            height: body.height,
        };
        let right_region = Rect {
            x: width - right,
            y: body.y,
            width: right,
            height: body.height,
        };
        Self {
            paper: Rect {
                x: 0.0,
                y: 0.0,
                width,
                height,
            },
            body,
            header: Rect {
                x: body.x,
                y: 0.0,
                width: body.width,
                height: m.header_mm,
            },
            footer: Rect {
                x: body.x,
                y: height - m.footer_mm,
                width: body.width,
                height: m.footer_mm,
            },
            inner: if binding_left {
                left_region
            } else {
                right_region
            },
            outer: if binding_left {
                right_region
            } else {
                left_region
            },
            binding_side: if binding_left {
                Side::Left
            } else {
                Side::Right
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Margins, PageSettings, PaperSize};

    /// A5 默认边距遵循 archive 的谐和规则：宽×9%/12%、高×7%/9%。
    #[test]
    fn default_margins_follow_the_archive_rule_for_a5() {
        let margins = Margins::default();
        assert_eq!(
            (
                margins.header_mm,
                margins.footer_mm,
                margins.inner_mm,
                margins.outer_mm
            ),
            (15.0, 19.0, 13.0, 18.0)
        );
        let page = PageSettings::default();
        assert_eq!(page.paper, PaperSize::A5);
        assert_eq!(page.margins.inner_mm, 13.0);
    }

    /// 预设纸张的 JSON kind 必须与前端 `PaperSize` / `PRESET_DIMS_MM` 一致。
    #[test]
    fn preset_papers_serialize_with_expected_kind_and_dims() {
        let cases = [
            (PaperSize::A4, "a4", (210.0, 297.0)),
            (PaperSize::A5sTnStandard, "a5sTnStandard", (110.0, 210.0)),
            (PaperSize::TnPassport, "tnPassport", (88.0, 125.0)),
            (PaperSize::A5, "a5", (148.0, 210.0)),
            (PaperSize::A6, "a6", (105.0, 148.0)),
            (PaperSize::A6fc, "a6fc", (108.0, 171.0)),
            (PaperSize::A6Personal, "a6Personal", (95.0, 171.0)),
            (PaperSize::A6pw, "a6pw", (120.0, 170.0)),
            (PaperSize::A6Slim, "a6Slim", (80.0, 171.0)),
            (PaperSize::A7, "a7", (80.0, 120.0)),
            (PaperSize::A7x127, "a7x127", (80.0, 127.0)),
            (PaperSize::B5, "b5", (176.0, 250.0)),
            (PaperSize::B6, "b6", (125.0, 176.0)),
            (PaperSize::B6Slim, "b6Slim", (98.0, 176.0)),
            (PaperSize::M5x74, "m5x74", (74.0, 105.0)),
            (PaperSize::M5x67, "m5x67", (67.0, 105.0)),
            (PaperSize::M5x62, "m5x62", (62.0, 105.0)),
            (PaperSize::Letter, "letter", (215.9, 279.4)),
        ];
        for (paper, kind, dims) in cases {
            let json = serde_json::to_value(&paper).expect("序列化预设纸张");
            assert_eq!(json, serde_json::json!({ "kind": kind }));
            let parsed: PaperSize = serde_json::from_value(json).expect("反序列化预设纸张");
            assert_eq!(parsed, paper);
            assert_eq!(paper.dims_mm(), dims);
        }
    }
}
