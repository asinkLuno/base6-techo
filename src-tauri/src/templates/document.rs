//! 入口：边界校验 → 整本编排与区域布局 → 印刷拼版 → LaTeX。
use super::{
    components::Decorations,
    imposition::Imposition,
    layout::{Margins, PageLayout, PageSettings, PaperSize},
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
    /// 本节覆盖的页头、页脚与水印；None 表示继承 Document.decorations。
    pub decorations: Option<Decorations>,
    /// 本节覆盖的四周边距；None 表示继承 Document.page.margins。
    pub margins: Option<Margins>,
}

impl Default for Section {
    fn default() -> Self {
        Self {
            pages: 1,
            numbered: true,
            body: BodyTemplate::Blank,
            decorations: None,
            margins: None,
        }
    }
}

impl Section {
    /// 校验本节并把页数累加进全书总数；`total` 用于跨节的页数上限。
    fn validate(&self, paper: &PaperSize, total: &mut usize) -> Result<(), String> {
        if !(1..=MAX_PAGES).contains(&self.pages) {
            return Err(format!("每节页数必须在 1–{MAX_PAGES} 之间"));
        }
        *total += self.pages;
        if *total > MAX_PAGES {
            return Err(format!("全书不能超过 {MAX_PAGES} 页"));
        }
        self.body.validate()?;
        if let Some(required) = self.body.required_pages()
            && self.pages != required
        {
            return Err(format!(
                "八分周视图每周需要 2 页，当前日期范围应为 {required} 页"
            ));
        }
        if let Some(decorations) = &self.decorations {
            decorations.validate()?;
        }
        if let Some(margins) = &self.margins {
            margins.validate_for(paper)?;
        }
        Ok(())
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
        section.validate(&document.page.paper, &mut total)?;
    }
    Ok(total)
}

pub fn plan_document(document: &Document) -> Result<PlannedDocument<'_>, String> {
    let total = validate(document)?;
    let mut pages = Vec::with_capacity(total);
    let mut next_number = 1;
    for (section_index, section) in document.sections.iter().enumerate() {
        // 纸张与装订方向全书共用，只有四周边距可按节覆盖。
        let settings = PageSettings {
            paper: document.page.paper.clone(),
            binding: document.page.binding,
            margins: section
                .margins
                .clone()
                .unwrap_or_else(|| document.page.margins.clone()),
        };
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
                layout: PageLayout::resolve(&settings, physical_page),
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
