use base6_techo_lib::templates::{
    document::{Document, Section, generate_document_latex, plan_document},
    layout::{Binding, Side},
    patterns::{BodyTemplate, LinearPattern},
};

fn document() -> Document {
    Document {
        sections: vec![
            Section {
                pages: 3,
                numbered: false,
                ..Default::default()
            },
            Section {
                pages: 2,
                body: BodyTemplate::Linear(LinearPattern::default()),
                ..Default::default()
            },
        ],
        ..Default::default()
    }
}

#[test]
fn binding_follows_book_order_even_across_unnumbered_sections() {
    let doc = document();
    let plan = plan_document(&doc).unwrap();
    assert_eq!(plan.pages().len(), 5);
    for (i, page) in plan.pages().iter().enumerate() {
        assert_eq!(page.context.physical_page, i + 1);
        assert_eq!(
            page.layout.binding_side,
            if i % 2 == 0 { Side::Left } else { Side::Right }
        );
    }
    let page = &plan.pages()[3];
    assert_eq!(page.context.section_index, 1);
    assert_eq!(page.context.local_index, 0);
    assert_eq!(page.context.display_number, Some(1));
    assert_eq!(plan.pages()[4].context.display_number, Some(2));
    assert_eq!(plan.pages()[0].context.display_number, None);
}

#[test]
fn right_binding_mirrors_all_regions() {
    let mut doc = document();
    doc.page.binding = Binding::Right;
    doc.page.margins.inner_mm = 20.0;
    doc.page.margins.outer_mm = 8.0;
    let plan = plan_document(&doc).unwrap();
    let odd = &plan.pages()[0].layout;
    let even = &plan.pages()[1].layout;
    assert_eq!(odd.binding_side, Side::Right);
    assert_eq!(odd.body.x, 8.0);
    assert_eq!(even.body.x, 20.0);
    assert_eq!(odd.body.width, 120.0);
    assert_eq!(odd.inner.x, 128.0);
    assert_eq!(odd.outer.x, 0.0);
    assert_eq!(odd.header.x, odd.body.x);
    assert_eq!(odd.footer.width, odd.body.width);
    assert_eq!(odd.body.y, doc.page.margins.header_mm);
    assert_eq!(odd.body.y + odd.body.height, odd.footer.y);
}

#[test]
fn rejects_invalid_documents_at_the_boundary() {
    let mut doc = document();
    doc.sections.clear();
    assert!(generate_document_latex(&doc).is_err());
    doc = document();
    doc.sections[0].pages = 0;
    assert!(plan_document(&doc).is_err());
    doc = document();
    doc.sections[0].pages = 999;
    assert!(plan_document(&doc).is_err());
    doc = document();
    doc.page.margins.inner_mm = f64::NAN;
    assert!(plan_document(&doc).is_err());
    doc = document();
    doc.page.margins.header_mm = 210.0;
    assert!(plan_document(&doc).is_err());
    doc = document();
    doc.sections[1].body = BodyTemplate::Linear(LinearPattern {
        spacing_mm: 0.001,
        ..Default::default()
    });
    assert!(plan_document(&doc).is_err());
}

#[test]
fn json_defaults_support_blank_and_linear_sections() {
    let doc: Document = serde_json::from_str(
        r#"{
        "sections": [{"pages": 1}, {"pages": 2, "body": {"kind": "linear", "spacingMm": 7.5}}]
    }"#,
    )
    .unwrap();
    assert_eq!(plan_document(&doc).unwrap().pages().len(), 3);
    assert!(
        generate_document_latex(&doc)
            .unwrap()
            .contains("tikzpicture")
    );
    assert!(serde_json::from_str::<Document>(r#"{"sections":[],"typo":true}"#).is_err());
}

#[test]
fn accepts_exact_page_limit_and_smallest_body() {
    use base6_techo_lib::templates::layout::PaperSize;
    let mut doc = document();
    doc.sections = vec![Section {
        pages: 999,
        ..Default::default()
    }];
    let plan = plan_document(&doc).unwrap();
    assert_eq!(plan.pages().len(), 999);
    assert_eq!(plan.pages()[998].context.display_number, Some(999));
    doc.page.paper = PaperSize::Custom {
        width_mm: 37.0,
        height_mm: 33.0,
    };
    let plan = plan_document(&doc).unwrap();
    assert_eq!(plan.pages()[0].layout.body.width, 1.0);
    assert_eq!(plan.pages()[0].layout.body.height, 1.0);
    doc.page.paper = PaperSize::Custom {
        width_mm: 36.9,
        height_mm: 33.0,
    };
    assert!(plan_document(&doc).is_err());
    doc.page.paper = PaperSize::Custom {
        width_mm: 37.0,
        height_mm: 32.9,
    };
    assert!(plan_document(&doc).is_err());
}

#[test]
fn rejects_nonfinite_dimensions_margins_and_invalid_ink() {
    use base6_techo_lib::templates::layout::PaperSize;
    for value in [f64::NAN, f64::INFINITY, -1.0, 1001.0] {
        let mut doc = document();
        doc.page.paper = PaperSize::Custom {
            width_mm: value,
            height_mm: 210.0,
        };
        assert!(plan_document(&doc).is_err());
        doc = document();
        doc.page.margins.outer_mm = value;
        assert!(plan_document(&doc).is_err());
    }
    for color in ["red", "#12345", "#GGGGGG", "é12345"] {
        let mut doc = document();
        doc.decorations.header.style.color = color.into();
        assert!(generate_document_latex(&doc).is_err());
    }
    let mut doc = document();
    doc.decorations.footer.style.size_pt = 0.0;
    assert!(plan_document(&doc).is_err());
}

#[test]
fn all_regions_share_the_same_mirrored_body_and_centers() {
    let mut doc = document();
    doc.page.margins.inner_mm = 20.0;
    doc.page.margins.outer_mm = 8.0;
    for binding in [Binding::Left, Binding::Right] {
        doc.page.binding = binding;
        let plan = plan_document(&doc).unwrap();
        for page in plan.pages() {
            let l = &page.layout;
            assert_eq!(l.paper.center(), (74.0, 105.0));
            assert_eq!(l.body.height, 178.0);
            assert_eq!(l.header.height, 16.0);
            assert_eq!(l.footer.y, 194.0);
            assert_eq!(l.header.width, l.body.width);
            assert_eq!(l.footer.x, l.body.x);
            assert_eq!(l.inner.width, 20.0);
            assert_eq!(l.outer.width, 8.0);
            assert_eq!(l.inner.y, l.body.y);
            assert_eq!(l.outer.height, l.body.height);
            let (inner_x, _) = l.inner.center();
            let (outer_x, _) = l.outer.center();
            match l.binding_side {
                Side::Left => {
                    assert_eq!((inner_x, outer_x), (10.0, 144.0));
                    assert_eq!(l.body.center(), (80.0, 105.0));
                }
                Side::Right => {
                    assert_eq!((inner_x, outer_x), (138.0, 4.0));
                    assert_eq!(l.body.center(), (68.0, 105.0));
                }
            }
        }
    }
}

#[test]
fn linear_rules_stay_in_body_and_leave_header_footer_clear() {
    let doc: Document = serde_json::from_str(
        r#"{
        "page":{"paper":{"kind":"a4"}},
        "sections":[{"body":{"kind":"linear","spacingMm":7}}]
    }"#,
    )
    .unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    let rules: Vec<_> = tex
        .lines()
        .filter(|line| line.starts_with("\\draw["))
        .collect();
    assert_eq!(rules.len(), 38);
    assert!(rules[0].contains("(18,281) -- (192,281)"));
    assert!(rules[37].contains("(18,22) -- (192,22)"));
    assert!(!tex.contains("fancyhdr"));
}

#[test]
fn exact_rule_spacing_includes_both_body_edges() {
    let doc: Document = serde_json::from_str(
        r#"{
        "sections":[{"body":{"kind":"linear","spacingMm":2}}]
    }"#,
    )
    .unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    let rules: Vec<_> = tex
        .lines()
        .filter(|line| line.starts_with("\\draw["))
        .collect();
    assert_eq!(rules.len(), 90);
    assert!(rules.first().unwrap().contains("(18,194) -- (130,194)"));
    assert!(rules.last().unwrap().contains("(18,16) -- (130,16)"));
}

/// 前端编辑器发出的确切负载形状（src/lib/generatePdf.ts 的 DocumentPayload）：
/// page 带自定义纸张/右装订/边距，sections 为 camelCase linear 三字段齐全；
/// imposition 省略走 serde 默认（单页阅读输出）。
#[test]
fn frontend_section_payload_parses_and_generates() {
    let doc: Document = serde_json::from_str(
        r##"{
        "page": {
            "paper": {"kind": "custom", "widthMm": 120, "heightMm": 200},
            "binding": "right",
            "margins": {"headerMm": 10, "footerMm": 12, "innerMm": 14, "outerMm": 16}
        },
        "sections": [
            {"pages": 4, "numbered": true,
             "body": {"kind": "linear", "spacingMm": 8, "color": "#112233", "lineWidthPt": 0.8}},
            {"pages": 1, "numbered": false, "body": {"kind": "blank"}}
        ]
    }"##,
    )
    .unwrap();
    assert_eq!(plan_document(&doc).unwrap().pages().len(), 5);
    let tex = generate_document_latex(&doc).unwrap();
    assert!(tex.contains("tikzpicture"));
    // 前端写法 #RRGGBB 进入 TikZ 时按 HTML 模型去井号
    assert!(tex.contains("\\definecolor{ink}{HTML}{112233}"));
}
