//! 年历：分页切块、单元格布局、节假日着色与页数/边界校验。
use base6_techo_lib::templates::document::{Document, generate_document_latex};

fn document(body: &str, pages: usize, holidays: &str) -> Document {
    serde_json::from_str(&format!(
        r#"{{
            "page": {{"margins": {{"headerMm": 16, "footerMm": 16, "innerMm": 18, "outerMm": 18}}}},
            "holidays": {holidays},
            "sections": [{{"pages": {pages}, "body": {body}}}]
        }}"#
    ))
    .expect("valid document json")
}

fn year(rows: usize, cols: usize, months: usize) -> String {
    format!(
        r#"{{"kind":"year","startMonth":"2027-01","months":{months},"rows":{rows},"cols":{cols},"showHolidays":true}}"#
    )
}

fn pages(tex: &str) -> Vec<&str> {
    tex.split("% physical=").skip(1).collect()
}

fn texts(page: &str) -> Vec<String> {
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
fn twelve_months_fit_on_three_by_four_single_page() {
    let doc = document(&year(3, 4, 12), 1, "{}");
    let tex = generate_document_latex(&doc).unwrap();
    assert_eq!(pages(&tex).len(), 1);
    let labels = texts(pages(&tex)[0]);
    for month in 1..=12 {
        assert!(
            labels.iter().any(|t| t == &format!("2027年{month}月")),
            "缺少 {month} 月：{labels:?}"
        );
    }
}

#[test]
fn months_split_across_pages_and_tail_page_keeps_empty_cells() {
    // 每页 2 个月，5 个月 → 3 页，最后一页只有 1 个月。
    let doc = document(&year(1, 2, 5), 3, "{}");
    let tex = generate_document_latex(&doc).unwrap();
    let pages = pages(&tex);
    assert_eq!(pages.len(), 3);
    assert!(texts(pages[0]).iter().any(|t| t == "2027年1月"));
    assert!(texts(pages[0]).iter().any(|t| t == "2027年2月"));
    assert!(texts(pages[2]).iter().any(|t| t == "2027年5月"));
    assert!(!texts(pages[2]).iter().any(|t| t == "2027年6月"));
}

/// 每段文字节点前的 `\definecolor{ink}{HTML}{...}` 决定它的颜色，按出现顺序配对。
fn colors_by_label(page: &str) -> Vec<(String, String)> {
    let mut color = String::new();
    let mut pairs = Vec::new();
    for line in page.lines() {
        if let Some(rest) = line.strip_prefix("\\definecolor{ink}{HTML}{") {
            color = rest.trim_end_matches('}').to_string();
        } else if line.contains("anchor=center") {
            let label = line
                .rsplit_once('{')
                .and_then(|(_, tail)| tail.strip_suffix("};"))
                .unwrap_or("");
            pairs.push((label.to_string(), color.clone()));
        }
    }
    pairs
}

#[test]
fn holidays_and_weekends_use_the_holiday_color() {
    let holidays = r#"{"2027-01-01":"元旦","2027-01-04":"调休"}"#;
    let doc = document(&year(1, 1, 1), 1, holidays);
    let tex = generate_document_latex(&doc).unwrap();
    let page = pages(&tex)[0];
    // 元旦与调休都在节日色里，普通工作日仍是文字色。
    assert!(page.contains("HTML}{D96A6A}"), "缺少节日色：{page}");
    assert!(page.contains("HTML}{000000}"), "缺少文字色：{page}");
    // 2027-01-02 是周六、03 是周日，同样走节日色；05 是周二，必须不是。
    let colors = colors_by_label(page);
    let color_of = |label: &str| {
        colors
            .iter()
            .find(|(text, _)| text == label)
            .map(|(_, color)| color.as_str())
    };
    for day in ["1", "2", "3", "4"] {
        assert_eq!(color_of(day), Some("D96A6A"), "{day} 号应为节日色");
    }
    assert_eq!(color_of("5"), Some("000000"), "5 号是普通工作日");
}

#[test]
fn show_holidays_off_uses_only_text_color() {
    let body = r#"{"kind":"year","startMonth":"2027-01","months":1,"rows":1,"cols":1,"showHolidays":false}"#;
    let doc = document(body, 1, r#"{"2027-01-01":"元旦"}"#);
    let tex = generate_document_latex(&doc).unwrap();
    assert!(!pages(&tex)[0].contains("HTML}{D96A6A}"));
}

#[test]
fn page_count_must_match_grid_capacity() {
    let doc = document(&year(1, 2, 5), 2, "{}");
    assert!(generate_document_latex(&doc).is_err());

    // 与模板推导一致时才通过。
    let ok = document(&year(1, 2, 5), 3, "{}");
    assert!(generate_document_latex(&ok).is_ok());
}

#[test]
fn invalid_holiday_keys_are_rejected() {
    let doc = document(&year(1, 1, 1), 1, r#"{"2027-02-30":"不存在的日期"}"#);
    let err = generate_document_latex(&doc).unwrap_err();
    assert!(err.contains("2027-02-30"), "{err}");
}

#[test]
fn oversized_holiday_name_and_grid_are_rejected() {
    let long_name = format!("\"2027-01-01\":\"{}\"", "节".repeat(200));
    let doc = document(&year(1, 1, 1), 1, &format!("{{{long_name}}}"));
    assert!(generate_document_latex(&doc).is_err());

    let doc = document(&year(13, 1, 12), 1, "{}");
    assert!(generate_document_latex(&doc).is_err());
}
