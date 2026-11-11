use base6_techo_lib::templates::{
    components::{Band, BandContent, Decorations, Watermark},
    document::{Document, Section, generate_document_latex, plan_document},
    layout::{Margins, Side},
    patterns::{BodyTemplate, DotsPattern, GridPattern, HogenPattern, LinearPattern},
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
    // 固定边距，留下恰好 1×1mm 的页心。
    doc.page.margins = Margins {
        header_mm: 16.0,
        footer_mm: 16.0,
        inner_mm: 18.0,
        outer_mm: 18.0,
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
    // 显式固定页头/页脚，几何断言与默认美学规则解耦。
    doc.page.margins.header_mm = 16.0;
    doc.page.margins.footer_mm = 16.0;
    doc.page.margins.inner_mm = 20.0;
    doc.page.margins.outer_mm = 8.0;
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
        // 左装订：奇数页装订边在左，偶数页装订边在右。
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

#[test]
fn linear_pattern_stays_in_body_and_skips_header_footer() {
    let doc: Document = serde_json::from_str(
        r#"{
        "page":{
            "paper":{"kind":"a4"},
            "margins":{"headerMm":16,"footerMm":16,"innerMm":18,"outerMm":18}
        },
        "sections":[{"body":{"kind":"linear","spacingMm":7}}]
    }"#,
    )
    .unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    // A4 默认边距：页心 (18,16)-(192,281)，中心 y=148.5；居中序列首线 148.5-18*7=22.5，
    // y 相位 (297-22.5)%7=1.5，上下各留 6.5mm 对称余量。
    assert!(tex.contains("\\pgfdeclarepatternformonly{lines_7_0p4_1p5}"));
    assert!(tex.contains("\\pgfsetfillpattern{lines_7_0p4_1p5}{ink}"));
    assert!(tex.contains("\\pgfpathmoveto{\\pgfpointxy{18}{16}}"));
    assert!(tex.contains("\\pgfpathlineto{\\pgfpointxy{192}{281}}"));
    assert!(!tex.contains("\\draw["));
    assert!(!tex.contains("fancyhdr"));
}

#[test]
fn dots_fill_the_body_with_a_pattern_and_optional_center_dot() {
    let doc: Document = serde_json::from_str(
        r##"{
        "page":{"margins":{"headerMm":16,"footerMm":16,"innerMm":18,"outerMm":18}},
        "sections": [{
            "body": {
                "kind": "dots",
                "spacingMm": 5,
                "columnSpacingMm": 7,
                "radiusMm": 0.3,
                "color": "#7A7A7A",
                "centerColor": "#8B0000"
            }
        }]
    }"##,
    )
    .unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    assert!(tex.contains("\\pgfdeclarepatternformonly{dots_7_5_0p3_"));
    assert!(tex.contains("\\pgfsetfillpattern{"));
    // 列距 7、行距 5 的非方形点阵；中心点 (74,105) 用单独颜色再画一次。
    assert!(tex.contains("\\fill[ink] (74,105) circle (0.3);"));
    // 均匀点阵只产生一个 pattern 填充，不逐点输出。
    assert_eq!(tex.matches("circle (").count(), 1);
}

#[test]
fn repeated_dots_pages_reuse_one_pattern_declaration() {
    let doc: Document =
        serde_json::from_str(r#"{"sections":[{"pages":3,"body":{"kind":"dots"}}]}"#).unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    // 同相位的多页共用同一个 pattern；重复声明会被 PGF 判为错误。
    assert_eq!(tex.matches("\\pgfdeclarepatternformonly").count(), 1);
}

#[test]
fn dots_can_omit_the_center_dot_and_reject_invalid_parameters() {
    let doc: Document =
        serde_json::from_str(r##"{"sections":[{"body":{"kind":"dots","centerColor":null}}]}"##)
            .unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    assert!(tex.contains("\\pgfdeclarepatternformonly{"));
    assert!(!tex.contains("\\fill[ink]"));

    for body in [
        BodyTemplate::Dots(DotsPattern {
            spacing_mm: 0.01,
            ..Default::default()
        }),
        BodyTemplate::Dots(DotsPattern {
            column_spacing_mm: f64::NAN,
            ..Default::default()
        }),
        BodyTemplate::Dots(DotsPattern {
            radius_mm: 0.0,
            ..Default::default()
        }),
        BodyTemplate::Dots(DotsPattern {
            color: "red".into(),
            ..Default::default()
        }),
        BodyTemplate::Dots(DotsPattern {
            center_color: Some("#GGGGGG".into()),
            ..Default::default()
        }),
    ] {
        let mut doc = document();
        doc.sections[1].body = body;
        assert!(plan_document(&doc).is_err());
    }
}

#[test]
fn grid_spreads_from_the_page_center_with_a_closed_border() {
    let doc: Document = serde_json::from_str(
        r##"{
        "page":{"margins":{"headerMm":16,"footerMm":16,"innerMm":18,"outerMm":18}},
        "sections":[{"body":{"kind":"grid","spacingMm":5,"color":"#7A9AC9","lineWidthPt":0.2}}]
    }"##,
    )
    .unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    // A5 默认页心 (18,16)-(130,194)：中心 (74,105)，从中心向四周扩展，
    // 横线 19…129、竖线 20…190，方格范围 (19,20)-(129,190)。
    assert!(tex.contains("\\pgfdeclarepatternformonly{grid_5_0p2_4_0}"));
    assert!(tex.contains("\\pgfsetfillpattern{grid_5_0p2_4_0}{ink}"));
    // 填充范围外扩半条线宽（0.035146mm），边框不被裁剪框切掉一半。
    assert!(tex.contains("\\pgfpathmoveto{\\pgfpointxy{18.964854}{19.964854}}"));
    assert!(tex.contains("\\pgfpathlineto{\\pgfpointxy{129.035146}{190.035146}}"));
    assert!(!tex.contains("\\draw["));
}

#[test]
fn dense_grid_output_stays_compact_and_rejects_invalid_parameters() {
    let doc: Document = serde_json::from_str(
        r#"{"sections":[{"pages":100,"body":{"kind":"grid","spacingMm":0.1}}]}"#,
    )
    .unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    assert!(tex.len() < 200_000, "tex={} bytes", tex.len());
    assert_eq!(tex.matches("\\pgfdeclarepatternformonly").count(), 1);

    for body in [
        BodyTemplate::Grid(GridPattern {
            spacing_mm: 0.01,
            ..Default::default()
        }),
        BodyTemplate::Grid(GridPattern {
            spacing_mm: f64::NAN,
            ..Default::default()
        }),
        BodyTemplate::Grid(GridPattern {
            line_width_pt: 0.0,
            ..Default::default()
        }),
        BodyTemplate::Grid(GridPattern {
            color: "blue".into(),
            ..Default::default()
        }),
    ] {
        let mut doc = document();
        doc.sections[1].body = body;
        assert!(plan_document(&doc).is_err());
    }
}

#[test]
fn hogen_grid_reproduces_midori_geometry_from_the_page_center() {
    let doc: Document = serde_json::from_str(
        r##"{
        "page":{"margins":{"headerMm":16,"footerMm":16,"innerMm":18,"outerMm":18}},
        "sections":[{"body":{"kind":"hogen","color":"#A9D1AE"}}]
    }"##,
    )
    .unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    // A5 默认页心 (18,16)-(130,194)，中心 (74,105)。四周各预留 1mm 断口 +
    // 1.2mm 外伸后，每边放 10 格（x 24..124）、17 格（y 20..190）。
    assert!(tex.contains("\\pgfdeclarepatternformonly{hogen_5_1_0p7_4_0}"));
    assert!(tex.contains("\\pgfsetfillpattern{hogen_5_1_0p7_4_0}{ink}"));
    // 填充范围再外扩半条线宽（0.7pt = 0.123011mm），保证外框线不被裁掉一半。
    assert!(tex.contains("\\pgfpathmoveto{\\pgfpointxy{23.876989}{19.876989}}"));
    assert!(tex.contains("\\pgfpathlineto{\\pgfpointxy{124.123011}{190.123011}}"));
    // 每 10 格一条标记线：纵向 ±10 格落在最外圈，横向 ±10 格仍在内部。
    assert!(tex.contains("\\fill[ink] (24,18.5) circle (0.4);"));
    assert!(tex.contains("\\fill[ink] (74,191.5) circle (0.4);"));
    assert!(tex.contains("\\fill[ink] (22.5,105) circle (0.4);"));
    assert!(tex.contains("\\fill[ink] (125.5,55) circle (0.4);"));
    // 偶数格线向外伸 1.2mm，与格线间隔 1mm；标记线与最外圈不伸出。
    assert!(tex.contains("(64,19) -- (64,17.8)"));
    assert!(tex.contains("(23,95) -- (21.8,95)"));
    // 纵线 21 条（-10..10）可伸出 8 条 × 2；横线 35 条（-17..17）
    // 可伸出 14 条 × 2（±17 是边框，标记线 0 与 ±10 改画点），共 44 条短线，
    // 合并成一条路径。
    let fringe: Vec<&str> = tex
        .lines()
        .filter(|line| line.starts_with("\\draw[ink,line width=0.246022mm]"))
        .collect();
    assert_eq!(fringe.len(), 1);
    assert_eq!(fringe[0].matches(" -- ").count(), 44);
    assert!(!tex.contains("fancyhdr"));
}

#[test]
fn hogen_grid_rejects_invalid_color() {
    let mut doc = document();
    doc.sections[1].body = BodyTemplate::Hogen(HogenPattern {
        color: "#GGGGGG".into(),
    });
    assert!(plan_document(&doc).is_err());
}

#[test]
fn hogen_grid_degrades_to_nothing_when_the_body_cannot_fit_one_cell() {
    let mut doc = document();
    doc.page.paper = base6_techo_lib::templates::layout::PaperSize::Custom {
        width_mm: 37.0,
        height_mm: 33.0,
    };
    // 固定边距，留下恰好 1×1mm 的页心。
    doc.page.margins = Margins {
        header_mm: 16.0,
        footer_mm: 16.0,
        inner_mm: 18.0,
        outer_mm: 18.0,
    };
    doc.sections = vec![Section {
        pages: 1,
        body: BodyTemplate::Hogen(HogenPattern::default()),
        ..Default::default()
    }];
    // 1mm 页心扣掉两侧 2.2mm 预留后放不下 5mm 格：只保留空白页，不输出 pattern。
    let tex = generate_document_latex(&doc).unwrap();
    assert!(!tex.contains("\\pgfdeclarepatternformonly{hogen"));
}

#[test]
fn linear_stripes_are_centered_with_symmetric_margins() {
    let doc: Document = serde_json::from_str(
        r#"{
        "page":{"margins":{"headerMm":16,"footerMm":16,"innerMm":18,"outerMm":18}},
        "sections":[{"body":{"kind":"linear","spacingMm":2}}]
    }"#,
    )
    .unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    // A5 默认页心 (18,16)-(130,194) 高 178，中心 y=105；间距 2 时首线 105-44*2=17，
    // 末线 193，上下各留 1mm，不再压在页心边界上。
    assert!(tex.contains("\\pgfdeclarepatternformonly{lines_2_0p4_1}"));
    assert!(tex.contains("\\pgfpathmoveto{\\pgfpointxy{18}{16}}"));
    assert!(tex.contains("\\pgfpathlineto{\\pgfpointxy{130}{194}}"));
}

#[test]
fn linear_margin_line_spans_full_page_height() {
    let doc: Document = serde_json::from_str(
        r##"{
        "sections":[{"body":{
            "kind":"linear",
            "spacingMm":7,
            "marginLine":{"xMm":25,"color":"#D96A6A","widthPt":0.4}
        }}]
    }"##,
    )
    .unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    assert!(tex.contains("\\definecolor{ink}{HTML}{D96A6A}"));
    // A5 纸高 210mm：竖线从纸张上缘通到下缘，不受页头/页脚区域限制。
    assert!(
        tex.contains("\\draw[ink,line width=0.140584mm] (25,0) -- (25,210);"),
        "missing full-height margin line"
    );
}

#[test]
fn invalid_linear_margin_line_is_rejected() {
    for margin_line in [r#"{"xMm":-1}"#, r#"{"widthPt":0}"#, r##"{"color":"red"}"##] {
        let json = format!(
            r#"{{"sections":[{{"body":{{"kind":"linear","marginLine":{margin_line}}}}}]}}"#
        );
        let doc: Document = serde_json::from_str(&json).unwrap();
        assert!(plan_document(&doc).is_err(), "应拒绝 {margin_line}");
    }
}

#[test]
fn dense_linear_output_stays_compact() {
    let doc: Document = serde_json::from_str(
        r#"{"sections":[{"pages":100,"body":{"kind":"linear","spacingMm":0.1}}]}"#,
    )
    .unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    // 改造前逐线输出约 15MB；pattern 后每页固定十几行，且全文档只声明一次。
    assert!(tex.len() < 200_000, "tex={} bytes", tex.len());
    assert_eq!(tex.matches("\\pgfdeclarepatternformonly").count(), 1);
}

#[test]
fn section_decorations_override_book_defaults_and_can_inherit() {
    let doc: Document = serde_json::from_str(
        r##"{
        "decorations": {
            "header": {"content": {"kind": "text", "text": "全书"}},
            "footer": {"pageNumber": true, "align": "center"}
        },
        "sections": [
            {
                "pages": 1,
                "numbered": true,
                "decorations": {
                    "header": {"content": {"kind": "text", "text": "本节"}},
                    "footer": {"pageNumber": false, "align": "outer"},
                    "innerWatermark": {"text": "装订", "style": {"sizePt": 7}}
                }
            },
            {"pages": 1, "numbered": true}
        ]
    }"##,
    )
    .unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    // 第一节用覆盖值：本节页头 + 水印，且它自己的页脚不显示页码。
    assert_eq!(tex.matches("本节").count(), 1);
    assert_eq!(tex.matches("装订").count(), 1);
    // 第二节没有覆盖，回落到全书默认页头。
    assert_eq!(tex.matches("全书").count(), 1);
}

#[test]
fn section_margins_override_book_defaults_and_can_inherit() {
    let doc: Document = serde_json::from_str(
        r#"{
        "page": {"margins": {"headerMm": 16, "footerMm": 16, "innerMm": 18, "outerMm": 18}},
        "sections": [
            {"pages": 1, "margins": {"headerMm": 30, "footerMm": 10, "innerMm": 25, "outerMm": 5}},
            {"pages": 1}
        ]
    }"#,
    )
    .unwrap();
    let plan = plan_document(&doc).unwrap();
    let custom = &plan.pages()[0].layout;
    assert_eq!(custom.body.x, 25.0);
    assert_eq!(custom.body.y, 30.0);
    assert_eq!(custom.body.width, 148.0 - 25.0 - 5.0);
    assert_eq!(custom.body.height, 210.0 - 30.0 - 10.0);
    // 第二节省略 margins，回落到全书默认留白。
    let inherited = &plan.pages()[1].layout;
    assert_eq!(inherited.body.x, 18.0);
    assert_eq!(inherited.body.y, 16.0);
    assert_eq!(inherited.body.width, 148.0 - 18.0 - 18.0);
    assert_eq!(inherited.body.height, 210.0 - 16.0 - 16.0);
}

#[test]
fn invalid_section_margins_are_rejected() {
    for margins in [
        r#"{"headerMm": -1}"#,
        r#"{"headerMm": 500}"#,
        r#"{"innerMm": 1000}"#,
    ] {
        let json = format!(r#"{{"sections": [{{"margins": {margins}}}]}}"#);
        let doc: Document = serde_json::from_str(&json).unwrap();
        assert!(plan_document(&doc).is_err(), "应拒绝 {margins}");
    }
}

#[test]
fn decoration_text_is_capped_at_the_shared_text_limit() {
    let max = "x".repeat(128);
    let over = "x".repeat(129);

    let mut doc = document();
    doc.decorations.header.content = BandContent::Text { text: max };
    assert!(plan_document(&doc).is_ok());

    doc.decorations.header.content = BandContent::Text { text: over.clone() };
    assert!(plan_document(&doc).is_err());

    let mut doc = document();
    doc.decorations.outer_watermark = Some(Watermark {
        text: over.clone(),
        ..Default::default()
    });
    assert!(plan_document(&doc).is_err());

    // 节级覆盖走同一条校验路径。
    let mut doc = document();
    doc.sections[0].decorations = Some(Decorations {
        footer: Band {
            content: BandContent::Text { text: over },
            ..Default::default()
        },
        ..Default::default()
    });
    assert!(plan_document(&doc).is_err());
}

#[test]
fn invalid_section_decorations_are_rejected() {
    for decorations in [
        r#"{"header": {"style": {"sizePt": 0}}}"#,
        r#"{"header": {"style": {"color": "red"}}}"#,
        r##"{"outerWatermark": {"text": "x", "style": {"color": "#XYZXYZ"}}}"##,
    ] {
        let json = format!(r#"{{"sections": [{{"decorations": {decorations}}}]}}"#);
        let doc: Document = serde_json::from_str(&json).unwrap();
        assert!(plan_document(&doc).is_err(), "应拒绝 {decorations}");
    }
}

/// 前端编辑器发出的确切负载形状（src/lib/generatePdf.ts 的 DocumentPayload）：
/// page 带自定义纸张/默认边距，imposition 为锁线 2 张一帖，
/// sections 为 camelCase linear 三字段齐全。
#[test]
fn frontend_section_payload_parses_and_generates() {
    let doc: Document = serde_json::from_str(
        r##"{
        "page": {
            "paper": {"kind": "custom", "widthMm": 120, "heightMm": 200},
            "margins": {"headerMm": 16, "footerMm": 16, "innerMm": 18, "outerMm": 18}
        },
        "imposition": {"mode": "thread", "sheetsPerSignature": 2},
        "sections": [
            {"pages": 4, "numbered": true,
             "body": {"kind": "linear", "spacingMm": 8, "color": "#112233", "lineWidthPt": 0.8}},
            {"pages": 1, "numbered": false, "body": {"kind": "blank"}}
        ]
    }"##,
    )
    .unwrap();
    assert_eq!(
        doc.imposition,
        base6_techo_lib::templates::imposition::Imposition::Thread {
            sheets_per_signature: 2
        }
    );
    assert_eq!(plan_document(&doc).unwrap().pages().len(), 5);
    let tex = generate_document_latex(&doc).unwrap();
    assert!(tex.contains("tikzpicture"));
    // 前端写法 #RRGGBB 进入 TikZ 时按 HTML 模型去井号
    assert!(tex.contains("\\definecolor{ink}{HTML}{112233}"));
}
