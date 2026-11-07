//! 原横线本 API 的兼容适配器；布局和 LaTeX 生成统一交给整本框架。
pub use super::layout::PaperSize;
use super::{
    components::{Align, Band, BandContent, Decorations},
    document::{Document, Section, generate_document_latex, plan_document},
    layout::PageSettings,
    patterns::{BodyTemplate, LinearPattern},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PageNumberPos {
    Outer,
    Inner,
    Center,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LinedDocParams {
    pub paper: PaperSize,
    pub line_spacing_mm: f64,
    pub page_number_pos: PageNumberPos,
    #[serde(default = "default_pages")]
    pub pages: u32,
}

fn default_pages() -> u32 {
    1
}

fn document(p: &LinedDocParams) -> Document {
    let align = match p.page_number_pos {
        PageNumberPos::Outer => Align::Outer,
        PageNumberPos::Inner => Align::Inner,
        PageNumberPos::Center => Align::Center,
    };
    Document {
        page: PageSettings {
            paper: p.paper.clone(),
            ..Default::default()
        },
        decorations: Decorations {
            header: Band {
                content: BandContent::Date,
                ..Default::default()
            },
            footer: Band {
                page_number: true,
                align,
                ..Default::default()
            },
            ..Default::default()
        },
        sections: vec![Section {
            pages: p.pages as usize,
            body: BodyTemplate::Linear(LinearPattern {
                spacing_mm: p.line_spacing_mm,
                ..Default::default()
            }),
            ..Default::default()
        }],
    }
}

pub fn validate_params(p: &LinedDocParams) -> Result<(), String> {
    plan_document(&document(p)).map(|_| ())
}

pub fn generate_lined_latex(p: &LinedDocParams) -> Result<String, String> {
    generate_document_latex(&document(p))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn legacy_payload_keeps_default_page_and_paper_names() {
        let params: LinedDocParams = serde_json::from_str(
            r#"{
            "paper":{"kind":"b5"},"lineSpacingMm":7.5,"pageNumberPos":"center"
        }"#,
        )
        .unwrap();
        assert_eq!(params.pages, 1);
        assert_eq!(params.paper, PaperSize::B5);
        let tex = generate_lined_latex(&params).unwrap();
        assert!(tex.contains("paperwidth=176mm,paperheight=250mm"));
        assert!(tex.contains("年"));
        assert!(tex.contains("月"));
    }

    #[test]
    fn legacy_footer_positions_follow_physical_page_parity() {
        let mut params = LinedDocParams {
            paper: PaperSize::A5,
            line_spacing_mm: 7.0,
            page_number_pos: PageNumberPos::Outer,
            pages: 2,
        };
        for (position, expected) in [
            (PageNumberPos::Outer, ["anchor=east", "anchor=west"]),
            (PageNumberPos::Inner, ["anchor=west", "anchor=east"]),
            (PageNumberPos::Center, ["anchor=center", "anchor=center"]),
        ] {
            params.page_number_pos = position;
            let tex = generate_lined_latex(&params).unwrap();
            let pages: Vec<_> = tex.split("% physical=").skip(1).collect();
            for (page, anchor) in pages.iter().zip(expected) {
                let footer = page
                    .lines()
                    .find(|line| line.ends_with("{1};") || line.ends_with("{2};"))
                    .unwrap();
                assert!(footer.contains(anchor), "{footer}");
            }
        }
    }
}
