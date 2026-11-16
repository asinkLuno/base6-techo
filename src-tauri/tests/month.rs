//! 月历：月份推进、网格坐标、表头/标题、月相开关与页数约束。
use base6_techo_lib::templates::document::{Document, generate_document_latex, plan_document};

fn document(body: &str, pages: usize) -> Document {
    serde_json::from_str(&format!(
        r#"{{
            "page": {{"margins": {{"headerMm": 16, "footerMm": 16, "innerMm": 18, "outerMm": 18}}}},
            "sections": [{{"pages": {pages}, "body": {body}}}]
        }}"#
    ))
    .expect("valid document json")
}

fn month(start: &str, months: usize) -> String {
    format!(r#"{{"kind":"month","startMonth":"{start}","months":{months}}}"#)
}

fn pages(tex: &str) -> Vec<&str> {
    tex.split("% physical=").skip(1).collect()
}

fn texts(page: &str, anchor: &str) -> Vec<String> {
    page.lines()
        .filter(|line| line.contains(&format!("anchor={anchor}")))
        .map(|line| {
            line.rsplit_once('{')
                .and_then(|(_, tail)| tail.strip_suffix("};"))
                .unwrap_or("")
                .to_string()
        })
        .collect()
}

#[test]
fn months_advance_one_page_at_a_time() {
    let doc = document(&month("2026-07", 2), 2);
    let tex = generate_document_latex(&doc).unwrap();
    let pages = pages(&tex);
    assert_eq!(pages.len(), 2);
    assert!(texts(pages[0], "center").iter().any(|t| t == "2026年7月"));
    assert!(texts(pages[1], "center").iter().any(|t| t == "2026年8月"));
    assert!(!texts(pages[0], "center").iter().any(|t| t == "2026年8月"));
}

#[test]
fn june_2026_starts_on_monday_and_fills_five_rows() {
    let body = r#"{"kind":"month","startMonth":"2026-06","months":1,"showPhase":false}"#;
    let doc = document(body, 1);
    let tex = generate_document_latex(&doc).unwrap();
    let page = pages(&tex)[0];
    // 1 号在左上格：设计坐标 (0.2, 18.2) 旋转 90° 后落在页心左下。
    assert!(page.contains("(36.2,193.8) {1}"), "{page}");
    // 5 行网格 = 8 条竖线 × 5 段 + 6 条横线 × 7 段 = 82 条线，合并在一条路径里。
    assert_eq!(page.matches(" -- ").count(), 82);
}

#[test]
fn weekday_headers_and_title_are_centered() {
    let doc = document(&month("2026-06", 1), 1);
    let tex = generate_document_latex(&doc).unwrap();
    let centered = texts(pages(&tex)[0], "center");
    assert_eq!(centered.len(), 8, "{centered:?}");
    for header in ["一", "二", "三", "四", "五", "六", "日"] {
        assert!(centered.iter().any(|t| t == header), "{centered:?}");
    }
    assert!(centered.iter().any(|t| t == "2026年6月"));
}

#[test]
fn phase_can_be_turned_off() {
    let with_phase = document(&month("2026-06", 1), 1);
    let page = generate_document_latex(&with_phase).unwrap();
    assert!(page.contains(" circle ("), "phase circle missing");

    let body = r#"{"kind":"month","startMonth":"2026-06","months":1,"showPhase":false}"#;
    let doc = document(body, 1);
    let page = generate_document_latex(&doc).unwrap();
    assert!(!page.contains(" circle ("), "phase circle should be off");
    assert!(!page.contains("\\fill[ink]"), "phase fill should be off");
}

#[test]
fn page_count_must_match_the_number_of_months() {
    let doc = document(&month("2026-07", 3), 2);
    let error = plan_document(&doc).err().expect("page mismatch");
    assert!(error.contains("月历每月需要 1 页"), "{error}");
    let doc = document(&month("2026-07", 3), 3);
    assert_eq!(plan_document(&doc).unwrap().pages().len(), 3);
}

#[test]
fn rejects_invalid_month_inputs() {
    for body in [
        r#"{"kind":"month","startMonth":"2026-13","months":1}"#,
        r#"{"kind":"month","startMonth":"2026-7","months":1}"#,
        r#"{"kind":"month","startMonth":"2026-07","months":0}"#,
        r#"{"kind":"month","startMonth":"2026-07","months":121}"#,
        r#"{"kind":"month","startMonth":"9999-12","months":2}"#,
        r#"{"kind":"month","startMonth":"2026-07","months":1,"titleFormat":"%Q"}"#,
        r#"{"kind":"month","startMonth":"2026-07","months":1,"lineColor":"red"}"#,
    ] {
        let doc = document(body, 1);
        assert!(generate_document_latex(&doc).is_err(), "{body}");
    }
}

#[test]
fn weekday_headers_follow_the_weekday_language() {
    // 表头不再是用户手填的字符串，而是由 weekdayLang 推导，两者不可能互相矛盾。
    let cases = [
        ("zh", ["一", "二", "三", "四", "五", "六", "日"]),
        ("en", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
        ("ja", ["月", "火", "水", "木", "金", "土", "日"]),
    ];
    for (lang, expected) in cases {
        let doc = document(
            &format!(
                r#"{{"kind":"month","startMonth":"2026-06","months":1,"weekdayLang":"{lang}"}}"#
            ),
            1,
        );
        let tex = generate_document_latex(&doc).unwrap();
        let centered = texts(pages(&tex)[0], "center");
        for header in expected {
            assert!(centered.iter().any(|t| t == header), "{lang}: {centered:?}");
        }
    }
}

#[test]
fn hand_written_weekday_headers_are_no_longer_accepted() {
    // 表头改由 weekdayLang 推导后字段被删除。deny_unknown_fields 让残留该键的
    // 旧载荷在解析阶段就失败，而不是被静默忽略——前端迁移必须先丢掉这个键。
    let body = r#"{"kind":"month","startMonth":"2026-06","months":1,"weekdayHeaders":"一,二,三,四,五,六,日"}"#;
    let payload = format!(r#"{{"sections":[{{"pages":1,"body":{body}}}]}}"#);
    let err = serde_json::from_str::<Document>(&payload).unwrap_err();
    assert!(err.to_string().contains("weekdayHeaders"), "{err}");
}
