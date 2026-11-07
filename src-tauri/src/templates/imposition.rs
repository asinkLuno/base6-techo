//! 阅读页 → 印刷纸张正反面。此层只重排、平移，不改变阅读页布局或编号。
use super::{document::PlannedDocument, layout::Binding};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "mode",
    rename_all = "lowercase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Imposition {
    None {},
    /// 整本作为一帖，尾部补齐到 4 的倍数。
    Booklet {},
    /// 每帖固定纸张数，每张纸对折提供 4 个阅读页；最后一帖补齐。
    Thread {
        #[serde(default = "default_sheets")]
        sheets_per_signature: usize,
    },
}

impl Default for Imposition {
    fn default() -> Self {
        Self::None {}
    }
}

fn default_sheets() -> usize {
    4
}

impl Imposition {
    pub(crate) fn validate(&self) -> Result<(), String> {
        match self {
            Self::Thread {
                sheets_per_signature,
            } if !(1..=250).contains(sheets_per_signature) => {
                Err("锁线每帖纸张数必须在 1–250 之间（每张纸对应 4 个阅读页）".into())
            }
            _ => Ok(()),
        }
    }

    fn signature_pages(&self, page_count: usize) -> Option<usize> {
        match self {
            Self::None {} => None,
            Self::Booklet {} => Some(page_count.div_ceil(4) * 4),
            Self::Thread {
                sheets_per_signature,
            } => Some(sheets_per_signature * 4),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Face {
    Front,
    Back,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SheetSide {
    /// 从 0 开始；不受 section 边界影响。
    pub signature_index: usize,
    /// 当前帖内的纸张索引，从外向内，从 0 开始。
    pub sheet_index: usize,
    pub face: Face,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PagePlacement {
    /// 全书实际页序，从 1 开始。None 为真正的空白，不绘制任何装饰或页码。
    pub physical_page: Option<usize>,
    pub x_mm: f64,
}

#[derive(Debug, Clone)]
pub struct OutputPage {
    pub placements: Vec<PagePlacement>,
    /// None 表示普通阅读页输出；Some 表示一张纸的某一面。
    pub sheet: Option<SheetSide>,
}

#[derive(Debug)]
pub struct OutputPlan {
    pub width_mm: f64,
    pub height_mm: f64,
    pub padded_blank_pages: usize,
    /// 普通阅读页输出时为 0；拼版时每张纸对应两个 PDF 页面。
    pub sheet_count: usize,
    pub signature_count: usize,
    pages: Vec<OutputPage>,
}

impl OutputPlan {
    pub fn pages(&self) -> &[OutputPage] {
        &self.pages
    }
}

/// 输入已经通过 plan_document 校验。打印页序为：第 1 张正面、反面，第 2 张正面、反面……
pub fn plan_output(book: &PlannedDocument<'_>) -> OutputPlan {
    let count = book.pages().len();
    let (width, height) = book.document.page.paper.dims_mm();
    let Some(stride) = book.document.imposition.signature_pages(count) else {
        return reading_output(count, width, height);
    };
    let padded = count.div_ceil(stride) * stride;
    let mut pages = Vec::new();
    for start in (0..padded).step_by(stride) {
        let end = start + stride - 1;
        for sheet in 0..stride / 4 {
            for (face, pair) in [
                (Face::Front, [end - sheet * 2, start + sheet * 2]),
                (Face::Back, [start + sheet * 2 + 1, end - sheet * 2 - 1]),
            ] {
                pages.push(imposed_page(
                    pair,
                    count,
                    width,
                    book.document.page.binding,
                    SheetSide {
                        signature_index: start / stride,
                        sheet_index: sheet,
                        face,
                    },
                ));
            }
        }
    }
    OutputPlan {
        width_mm: width * 2.0,
        height_mm: height,
        padded_blank_pages: padded - count,
        sheet_count: padded / 4,
        signature_count: padded / stride,
        pages,
    }
}

fn reading_output(count: usize, width: f64, height: f64) -> OutputPlan {
    OutputPlan {
        width_mm: width,
        height_mm: height,
        padded_blank_pages: 0,
        sheet_count: 0,
        signature_count: 0,
        pages: (1..=count)
            .map(|physical_page| OutputPage {
                placements: vec![PagePlacement {
                    physical_page: Some(physical_page),
                    x_mm: 0.0,
                }],
                sheet: None,
            })
            .collect(),
    }
}

fn imposed_page(
    mut pair: [usize; 2],
    count: usize,
    width: f64,
    binding: Binding,
    sheet: SheetSide,
) -> OutputPage {
    if binding == Binding::Right {
        pair.swap(0, 1);
    }
    OutputPage {
        placements: pair
            .into_iter()
            .enumerate()
            .map(|(slot, index)| PagePlacement {
                physical_page: (index < count).then_some(index + 1),
                x_mm: slot as f64 * width,
            })
            .collect(),
        sheet: Some(sheet),
    }
}
