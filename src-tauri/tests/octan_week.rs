//! 八分周视图：整周约束、两页一周的日期顺序、迷你月历与真实 LaTeX 输出。
use base6_techo_lib::templates::document::{Document, generate_document_latex, plan_document};

fn document(body: &str, pages: usize) -> Document {
    serde_json::from_str(&format!(
        r#"{{
            "sections": [{{"pages": {pages}, "body": {body}}}]
        }}"#
    ))
    .expect("valid document json")
}

fn octan(start: &str, end: &str) -> String {
    format!(r#"{{"kind":"octanWeek","startDate":"{start}","endDate":"{end}"}}"#)
}

/// 按输出页切开，便于检查每一阅读页的内容。
fn pages(tex: &str) -> Vec<&str> {
    tex.split("% physical=").skip(1).collect()
}

/// 只取格子日期节点（north west 锚点），排除迷你月历的中心锚点文字。
fn cell_dates(page: &str) -> Vec<String> {
    page.lines()
        .filter(|line| line.contains("anchor=north west"))
        .map(|line| {
            line.rsplit_once('{')
                .and_then(|(_, tail)| tail.strip_suffix("};"))
                .unwrap_or("")
                .to_string()
        })
        .collect()
}

fn centered_texts(page: &str) -> Vec<String> {
    page.lines()
        .filter(|line| line.contains("anchor=center"))
        .map(|line| {
            line.rsplit_once('{')
                .and_then(|(_, tail)| tail.strip_suffix("};"))
                .unwrap_or("")
                .to_string()
        })
        .collect()
}

#[test]
fn two_pages_cover_one_week_in_reading_order() {
    let doc = document(&octan("2026-08-03", "2026-08-09"), 2);
    let tex = generate_document_latex(&doc).unwrap();
    let pages = pages(&tex);
    assert_eq!(pages.len(), 2);
    assert_eq!(cell_dates(pages[0]), ["3", "6", "7"]);
    assert_eq!(cell_dates(pages[1]), ["4", "5", "8", "9"]);
}

#[test]
fn blank_quadrant_holds_current_and_next_month() {
    let doc = document(&octan("2026-08-03", "2026-08-09"), 2);
    let tex = generate_document_latex(&doc).unwrap();
    let pages = pages(&tex);
    let mini = centered_texts(pages[0]);
    assert!(mini.iter().any(|text| text == "2026年8月"), "{mini:?}");
    assert!(mini.iter().any(|text| text == "2026年9月"), "{mini:?}");
    // 本周日期在迷你月历里用高亮色，周外的 1/2/10 日仍用文字色。
    assert!(pages[0].contains("text=ink"));
    // 后半页没有空白格，不画迷你月历。
    assert!(centered_texts(pages[1]).is_empty());
}

#[test]
fn date_format_and_weekday_language_reach_the_cells() {
    let body = r#"{
        "kind":"octanWeek",
        "startDate":"2026-08-03",
        "endDate":"2026-08-09",
        "dateFormat":"%a. %m/%d",
        "weekdayLang":"en"
    }"#;
    let doc = document(body, 2);
    let tex = generate_document_latex(&doc).unwrap();
    assert_eq!(
        cell_dates(pages(&tex)[0]),
        ["Mon. 08/03", "Thu. 08/06", "Fri. 08/07"]
    );
}

#[test]
fn line_style_and_center_gap_are_drawn() {
    let body = r#"{
        "kind":"octanWeek",
        "startDate":"2026-08-03",
        "endDate":"2026-08-09",
        "lineStyle":"dashDot",
        "centerGapMm":3.5
    }"#;
    let doc = document(body, 2);
    let tex = generate_document_latex(&doc).unwrap();
    assert!(tex.contains("dash dot"));
    assert!(tex.contains("(74,101.5) -- (74,16)"), "{tex}");
}

#[test]
fn rejects_ranges_that_are_not_whole_weeks() {
    for (start, end) in [
        ("2026-08-04", "2026-08-09"),
        ("2026-08-03", "2026-08-08"),
        ("2026-08-09", "2026-08-03"),
    ] {
        let doc = document(&octan(start, end), 2);
        assert!(
            generate_document_latex(&doc).is_err(),
            "{start}..{end} should be rejected"
        );
    }
}

#[test]
fn page_count_must_match_the_number_of_weeks() {
    let doc = document(&octan("2026-08-03", "2026-08-16"), 3);
    let error = plan_document(&doc).err().expect("page mismatch");
    assert!(error.contains("每周需要 2 页"), "{error}");
    let doc = document(&octan("2026-08-03", "2026-08-16"), 4);
    assert_eq!(plan_document(&doc).unwrap().pages().len(), 4);
}

#[test]
fn rejects_invalid_dates_and_format_directives() {
    for body in [
        r#"{"kind":"octanWeek","startDate":"2026-02-30","endDate":"2026-03-08"}"#,
        r#"{"kind":"octanWeek","startDate":"2026-08-03","endDate":"2026-08-09","dateFormat":"%Q"}"#,
        r#"{"kind":"octanWeek","startDate":"2026-08-03","endDate":"2026-08-09","weekdayHeaders":"一,二"}"#,
        r#"{"kind":"octanWeek","startDate":"2026-08-03","endDate":"2026-08-09","lineWidthPt":0}"#,
    ] {
        let doc = document(body, 2);
        assert!(generate_document_latex(&doc).is_err(), "{body}");
    }
}
