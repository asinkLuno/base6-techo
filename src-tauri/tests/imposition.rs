use base6_techo_lib::templates::{
    document::{Document, Section, generate_document_latex, plan_document},
    layout::{Binding, Side},
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
fn right_binding_swaps_both_front_and_back_halves() {
    use base6_techo_lib::templates::imposition::{Imposition, plan_output};
    let mut doc = document();
    doc.sections = vec![Section {
        pages: 8,
        ..Default::default()
    }];
    doc.page.binding = Binding::Right;
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
            vec![Some(1), Some(8)],
            vec![Some(7), Some(2)],
            vec![Some(3), Some(6)],
            vec![Some(5), Some(4)]
        ]
    );
    assert_eq!(output.padded_blank_pages, 0);
    assert_eq!(book.pages()[0].layout.binding_side, Side::Right);
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
            for binding in [Binding::Left, Binding::Right] {
                let doc = Document {
                    page: base6_techo_lib::templates::layout::PageSettings {
                        binding,
                        ..Default::default()
                    },
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
}
