use base6_techo_lib::templates::{
    document::{Document, Section, generate_document_latex, plan_document},
    layout::Side,
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
                ..Default::default()
            },
        ],
        ..Default::default()
    }
}

// 拼版是阅读布局之后的独立步骤；这里的编号均为全书实际页序。
#[test]
fn booklet_pairs_the_whole_book_and_pads_only_at_the_end() {
    use base6_techo_lib::templates::imposition::{Face, Imposition, plan_output};
    let mut doc = document();
    doc.imposition = Imposition::Booklet {};
    let book = plan_document(&doc).unwrap();
    let output = plan_output(&book);
    let pairs: Vec<_> = output
        .pages()
        .iter()
        .map(|p| {
            p.placements
                .iter()
                .map(|p| p.physical_page)
                .collect::<Vec<_>>()
        })
        .collect();
    assert_eq!(
        pairs,
        vec![
            vec![None, Some(1)],
            vec![Some(2), None],
            vec![None, Some(3)],
            vec![Some(4), Some(5)]
        ]
    );
    assert_eq!(output.padded_blank_pages, 3);
    assert_eq!(output.sheet_count, 2);
    assert_eq!(output.signature_count, 1);
    assert_eq!((output.width_mm, output.height_mm), (296.0, 210.0));
    for (index, page) in output.pages().iter().enumerate() {
        let sheet = page.sheet.as_ref().unwrap();
        assert_eq!(sheet.signature_index, 0);
        assert_eq!(sheet.sheet_index, index / 2);
        assert_eq!(
            sheet.face,
            if index % 2 == 0 {
                Face::Front
            } else {
                Face::Back
            }
        );
        assert_eq!(page.placements[0].x_mm, 0.0);
        assert_eq!(page.placements[1].x_mm, 148.0);
    }
    // 拼版不重算版心或显示页码，全书第 4 页仍显示 1，装订侧在右。
    assert_eq!(book.pages()[3].context.display_number, Some(1));
    assert_eq!(book.pages()[3].layout.binding_side, Side::Right);
}

#[test]
fn thread_binding_keeps_equal_size_signatures_across_sections() {
    use base6_techo_lib::templates::imposition::{Imposition, plan_output};
    let mut doc = document();
    doc.sections[1].pages = 7; // 全书 10 页；section 边界不影响每帖 8 页。
    doc.imposition = Imposition::Thread {
        sheets_per_signature: 2,
    };
    let book = plan_document(&doc).unwrap();
    let output = plan_output(&book);
    let pairs: Vec<_> = output
        .pages()
        .iter()
        .map(|p| {
            p.placements
                .iter()
                .map(|p| p.physical_page)
                .collect::<Vec<_>>()
        })
        .collect();
    assert_eq!(
        pairs,
        vec![
            vec![Some(8), Some(1)],
            vec![Some(2), Some(7)],
            vec![Some(6), Some(3)],
            vec![Some(4), Some(5)],
            vec![None, Some(9)],
            vec![Some(10), None],
            vec![None, None],
            vec![None, None],
        ]
    );
    assert_eq!(output.signature_count, 2);
    assert_eq!(output.sheet_count, 4);
    assert_eq!(output.padded_blank_pages, 6);
    assert_eq!(output.pages()[4].sheet.as_ref().unwrap().signature_index, 1);
    assert_eq!(output.pages()[4].sheet.as_ref().unwrap().sheet_index, 0);
}

#[test]
fn reading_output_remains_single_pages_in_order() {
    use base6_techo_lib::templates::imposition::plan_output;
    let doc = document();
    let book = plan_document(&doc).unwrap();
    let output = plan_output(&book);
    assert_eq!((output.width_mm, output.height_mm), (148.0, 210.0));
    assert_eq!(output.padded_blank_pages, 0);
    assert_eq!(output.sheet_count, 0);
    assert_eq!(output.signature_count, 0);
    for (index, page) in output.pages().iter().enumerate() {
        assert!(page.sheet.is_none());
        assert_eq!(page.placements.len(), 1);
        assert_eq!(page.placements[0].physical_page, Some(index + 1));
        assert_eq!(page.placements[0].x_mm, 0.0);
    }
}

#[test]
fn imposition_rejects_invalid_signature_sizes_and_accepts_json_defaults() {
    use base6_techo_lib::templates::imposition::Imposition;
    let mut doc = document();
    for sheets in [0, 251, usize::MAX] {
        doc.imposition = Imposition::Thread {
            sheets_per_signature: sheets,
        };
        assert!(generate_document_latex(&doc).is_err());
    }
    let explicit: Document = serde_json::from_str(
        r#"{
        "imposition":{"mode":"thread","sheetsPerSignature":2},"sections":[{}]
    }"#,
    )
    .unwrap();
    assert_eq!(
        explicit.imposition,
        Imposition::Thread {
            sheets_per_signature: 2
        }
    );
    assert_eq!(
        serde_json::to_value(&explicit.imposition).unwrap(),
        serde_json::json!({"mode":"thread","sheetsPerSignature":2})
    );
    assert!(
        serde_json::from_str::<Document>(
            r#"{"imposition":{"mode":"none","unexpected":true},"sections":[{}]}"#
        )
        .is_err()
    );
    let doc: Document =
        serde_json::from_str(r#"{"imposition":{"mode":"thread"},"sections":[{}]}"#).unwrap();
    assert_eq!(
        doc.imposition,
        Imposition::Thread {
            sheets_per_signature: 4
        }
    );
    assert!(
        serde_json::from_str::<Document>(
            r#"{"imposition":{"mode":"booklet","sheetsPerSignature":2},"sections":[{}]}"#
        )
        .is_err()
    );
}

#[test]
fn imposition_covers_every_reading_page_exactly_once_at_signature_boundaries() {
    use base6_techo_lib::templates::imposition::{Imposition, plan_output};
    for count in [1, 4, 5, 8, 10, 999] {
        for sheets in [1, 2, 4, 250] {
            let doc = Document {
                sections: vec![Section {
                    pages: count,
                    ..Default::default()
                }],
                imposition: Imposition::Thread {
                    sheets_per_signature: sheets,
                },
                ..Default::default()
            };
            let book = plan_document(&doc).unwrap();
            let output = plan_output(&book);
            let mut visible: Vec<_> = output
                .pages()
                .iter()
                .flat_map(|page| page.placements.iter().filter_map(|p| p.physical_page))
                .collect();
            visible.sort_unstable();
            assert_eq!(visible, (1..=count).collect::<Vec<_>>());
            let padded = count.div_ceil(sheets * 4) * sheets * 4;
            assert_eq!(output.pages().len(), padded / 2);
            assert_eq!(output.padded_blank_pages, padded - count);
            assert_eq!(output.sheet_count, padded / 4);
            assert_eq!(output.signature_count, padded / (sheets * 4));
        }
    }
}

#[test]
fn patterns_are_declared_in_preamble_and_track_imposed_x_phase() {
    use base6_techo_lib::templates::{
        imposition::Imposition,
        patterns::{BodyTemplate, DotsPattern, GridPattern, HogenPattern},
    };
    let doc = Document {
        imposition: Imposition::Booklet {},
        sections: vec![
            Section {
                pages: 2,
                body: BodyTemplate::Dots(DotsPattern::default()),
                ..Default::default()
            },
            Section {
                pages: 2,
                body: BodyTemplate::Grid(GridPattern::default()),
                ..Default::default()
            },
            Section {
                pages: 2,
                body: BodyTemplate::Hogen(HogenPattern::default()),
                ..Default::default()
            },
        ],
        ..Default::default()
    };
    let tex = generate_document_latex(&doc).unwrap();
    let (preamble, body) = tex.split_once("\\begin{document}").expect("document body");
    assert!(
        preamble.contains("\\pgfdeclarepatternformonly{dots_"),
        "dots pattern should live in preamble"
    );
    assert!(
        preamble.contains("\\pgfdeclarepatternformonly{grid_"),
        "grid pattern should live in preamble"
    );
    assert!(
        preamble.contains("\\pgfdeclarepatternformonly{hogen_"),
        "hogen pattern should live in preamble"
    );
    assert!(
        !body.contains("\\pgfdeclarepatternformonly"),
        "pattern declarations must not appear inside tikzpicture/scope"
    );
    // 左半页(xshift=0)与右半页(xshift=148)在 5mm 间距下 x 相位不同，各自声明独立 pattern。
    assert_eq!(
        preamble
            .matches("\\pgfdeclarepatternformonly{dots_")
            .count(),
        2
    );
    assert_eq!(
        preamble
            .matches("\\pgfdeclarepatternformonly{grid_")
            .count(),
        2
    );
    assert_eq!(
        preamble
            .matches("\\pgfdeclarepatternformonly{hogen_")
            .count(),
        2
    );
    assert_eq!(
        body.matches("\\begin{scope}").count(),
        body.matches("\\end{scope}").count()
    );
}

#[test]
fn grid_body_clip_preserves_outer_border_half_width_on_exact_fit() {
    use base6_techo_lib::templates::{
        layout::Margins,
        patterns::{BodyTemplate, GridPattern},
    };
    // A5(148×210) 扣掉 19/19 与 15/15 → 页心 110×180mm，恰好是 5mm 的偶数倍。
    let doc = Document {
        page: base6_techo_lib::templates::layout::PageSettings {
            margins: Margins {
                header_mm: 15.0,
                footer_mm: 15.0,
                inner_mm: 19.0,
                outer_mm: 19.0,
            },
            ..Default::default()
        },
        sections: vec![Section {
            pages: 1,
            body: BodyTemplate::Grid(GridPattern {
                spacing_mm: 5.0,
                line_width_pt: 0.2,
                ..Default::default()
            }),
            ..Default::default()
        }],
        ..Default::default()
    };
    let tex = generate_document_latex(&doc).unwrap();
    // 0.2pt 半线宽 ≈ 0.035146mm：body clip 必须外扩半线宽，避免 19/15/129/195 边框被切半。
    assert!(
        tex.contains("\\clip (18.964854,14.964854) rectangle (129.035146,195.035146);"),
        "{tex}"
    );
}

#[test]
fn start_on_left_and_right_insert_blank_alignment_pages_without_decorations() {
    use base6_techo_lib::templates::{
        document::StartOn,
        imposition::{Imposition, plan_output},
        octan_week::OctanWeekPattern,
        patterns::BodyTemplate,
    };
    let doc: Document = serde_json::from_str(
        r#"{
            "decorations": {
                "header": {"content": {"kind": "text", "text": "HDR"}},
                "footer": {"pageNumber": true, "align": "outer"}
            },
            "imposition": {"mode": "booklet"},
            "sections": [
                {"pages": 2, "startOn": "left", "body": {"kind": "octanWeek", "startDate": "2026-08-03", "endDate": "2026-08-09"}},
                {"pages": 1, "startOn": "right", "body": {"kind": "blank"}}
            ]
        }"#,
    )
    .unwrap();
    assert_eq!(doc.sections[0].start_on, StartOn::Left);
    assert_eq!(doc.sections[1].start_on, StartOn::Right);
    // 第 1 节要求左页(偶)：前插 p1 空白，正文占 p2-p3(对开)；
    // 第 2 节要求右页(奇)：p4 是偶页，前插 p4 空白，正文占 p5。全书共 5 物理页。
    let book = plan_document(&doc).unwrap();
    assert_eq!(book.pages().len(), 5);
    assert!(book.pages()[0].is_alignment_blank());
    assert_eq!(book.pages()[0].context.display_number, None);
    assert!(!book.pages()[1].is_alignment_blank());
    assert_eq!(book.pages()[1].context.physical_page, 2);
    assert_eq!(book.pages()[1].context.display_number, Some(1));
    assert_eq!(book.pages()[1].layout.binding_side, Side::Right);
    assert_eq!(book.pages()[2].context.physical_page, 3);
    assert_eq!(book.pages()[2].context.display_number, Some(2));
    assert_eq!(book.pages()[2].layout.binding_side, Side::Left);
    assert!(book.pages()[3].is_alignment_blank());
    assert_eq!(book.pages()[3].context.display_number, None);
    assert!(!book.pages()[4].is_alignment_blank());
    assert_eq!(book.pages()[4].context.physical_page, 5);
    assert_eq!(book.pages()[4].context.display_number, Some(3));

    // 拼版：5 页补齐到 8 页，p2 与 p3 依然按阅读页序对开相邻。
    let output = plan_output(&book);
    assert_eq!(output.sheet_count, 2);
    assert_eq!(output.padded_blank_pages, 3);

    // 对齐空白页不绘制页头 HDR 与页码：5 页中只有 3 页正文绘制 HDR。
    let tex = generate_document_latex(&doc).unwrap();
    assert_eq!(tex.matches("{HDR}").count(), 3);

    // 边界：正文 999 页 + startOn: left 前插 1 页 = 1000 页，必须被 999 上限拒绝。
    let overflow = Document {
        sections: vec![Section {
            pages: 999,
            start_on: StartOn::Left,
            body: BodyTemplate::Blank,
            ..Default::default()
        }],
        imposition: Imposition::None {},
        ..Default::default()
    };
    assert!(plan_document(&overflow).is_err());

    // 确认 octanWeek 类型构造默认 start_on = Any。
    let default_octan = Section {
        pages: 2,
        body: BodyTemplate::OctanWeek(OctanWeekPattern::default()),
        ..Default::default()
    };
    assert_eq!(default_octan.start_on, StartOn::Any);
}
