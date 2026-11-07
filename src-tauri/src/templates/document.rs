//! 入口：边界校验 → 整本编排与区域布局 → 印刷拼版 → LaTeX。
use super::{
    components::Decorations,
    imposition::Imposition,
    layout::{PageLayout, PageSettings},
    patterns::BodyTemplate,
};
use serde::{Deserialize, Serialize};

const MAX_PAGES: usize = 999;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct Document {
    pub page: PageSettings,
    pub decorations: Decorations,
    pub sections: Vec<Section>,
    pub imposition: Imposition,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct Section {
    pub pages: usize,
    pub numbered: bool,
    pub body: BodyTemplate,
}

impl Default for Section {
    fn default() -> Self {
        Self {
            pages: 1,
            numbered: true,
            body: BodyTemplate::Blank,
        }
    }
}

/// 三种页序明确命名，组件不能把显示页码误当作装订依据。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PageContext {
    pub physical_page: usize,
    pub section_index: usize,
    pub local_index: usize,
    pub display_number: Option<usize>,
}

pub struct PlannedPage<'a> {
    pub context: PageContext,
    pub layout: PageLayout,
    pub(crate) section: &'a Section,
}

/// 只能通过 plan_document 构造；其中的参数已在边界校验。
pub struct PlannedDocument<'a> {
    pub(crate) document: &'a Document,
    pages: Vec<PlannedPage<'a>>,
}

impl<'a> PlannedDocument<'a> {
    pub fn pages(&self) -> &[PlannedPage<'a>] {
        &self.pages
    }
}

fn validate(document: &Document) -> Result<usize, String> {
    document.page.validate()?;
    document.imposition.validate()?;
    document.decorations.validate()?;
    if document.sections.is_empty() {
        return Err("文档至少需要一个 section".into());
    }
    let mut total = 0;
    for section in &document.sections {
        if !(1..=MAX_PAGES).contains(&section.pages) {
            return Err(format!("每节页数必须在 1–{MAX_PAGES} 之间"));
        }
        total += section.pages;
        if total > MAX_PAGES {
            return Err(format!("全书不能超过 {MAX_PAGES} 页"));
        }
        section.body.validate()?;
    }
    Ok(total)
}

pub fn plan_document(document: &Document) -> Result<PlannedDocument<'_>, String> {
    let total = validate(document)?;
    let mut pages = Vec::with_capacity(total);
    let mut next_number = 1;
    for (section_index, section) in document.sections.iter().enumerate() {
        for local_index in 0..section.pages {
            let physical_page = pages.len() + 1;
            let display_number = if section.numbered {
                let current = next_number;
                next_number += 1;
                Some(current)
            } else {
                None
            };
            pages.push(PlannedPage {
                context: PageContext {
                    physical_page,
                    section_index,
                    local_index,
                    display_number,
                },
                layout: PageLayout::resolve(&document.page, physical_page),
                section,
            });
        }
    }
    Ok(PlannedDocument { document, pages })
}

pub fn generate_document_latex(document: &Document) -> Result<String, String> {
    let plan = plan_document(document)?;
    Ok(super::latex::render(&plan))
}
