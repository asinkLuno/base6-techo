//! 年历：分页切块、单元格布局、节假日着色、农历副标签与页数/边界校验。
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

/// 带农历映射的文档；`lunar` 是 `YYYY-MM-DD` → 标签。
fn document_with_lunar(body: &str, pages: usize, lunar: &str) -> Document {
    serde_json::from_str(&format!(
        r#"{{
            "page": {{"margins": {{"headerMm": 16, "footerMm": 16, "innerMm": 18, "outerMm": 18}}}},
            "lunar": {lunar},
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

/// 同上但开启农历副标签。
fn year_with_lunar(rows: usize, cols: usize, months: usize) -> String {
    format!(
        r#"{{"kind":"year","startMonth":"2027-01","months":{months},"rows":{rows},"cols":{cols},"showHolidays":true,"showLunar":true}}"#
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

#[test]
fn lunar_labels_are_drawn_under_the_day_number() {
    let lunar = r#"{"2027-01-01":"冬月廿四","2027-01-08":"腊月"}"#;
    let doc = document_with_lunar(&year_with_lunar(1, 1, 1), 1, lunar);
    let tex = generate_document_latex(&doc).unwrap();
    let page = pages(&tex)[0];
    let labels = texts(page);
    // 初一显示月份名，普通日显示日名。
    assert!(labels.iter().any(|t| t == "冬月廿四"), "{labels:?}");
    assert!(labels.iter().any(|t| t == "腊月"), "{labels:?}");
}

#[test]
fn lunar_labels_reuse_the_day_color() {
    // 2027-01-02 是周六，默认走节日色；同一天的农历副标签必须同色。
    let lunar = r#"{"2027-01-02":"廿五"}"#;
    let doc = document_with_lunar(&year_with_lunar(1, 1, 1), 1, lunar);
    let tex = generate_document_latex(&doc).unwrap();
    let colors = colors_by_label(pages(&tex)[0]);
    let color_of = |label: &str| {
        colors
            .iter()
            .find(|(text, _)| text == label)
            .map(|(_, color)| color.as_str())
    };
    assert_eq!(color_of("2"), Some("D96A6A"));
    assert_eq!(color_of("廿五"), Some("D96A6A"));
}

#[test]
fn show_lunar_off_draws_no_lunar_even_when_labels_exist() {
    let lunar = r#"{"2027-01-01":"冬月廿四"}"#;
    let doc = document_with_lunar(&year(1, 1, 1), 1, lunar);
    let tex = generate_document_latex(&doc).unwrap();
    assert!(!texts(pages(&tex)[0]).iter().any(|t| t == "冬月廿四"));
}

#[test]
fn missing_lunar_entry_is_silently_skipped() {
    // 只有部分日期有标签（超出农历范围的年份就是这样），其余日期照常出日号。
    let lunar = r#"{"2027-01-01":"冬月廿四"}"#;
    let doc = document_with_lunar(&year_with_lunar(1, 1, 1), 1, lunar);
    let tex = generate_document_latex(&doc).unwrap();
    let labels = texts(pages(&tex)[0]);
    assert!(labels.iter().any(|t| t == "15"), "缺少日号：{labels:?}");
}

#[test]
fn invalid_lunar_entries_are_rejected() {
    let doc = document_with_lunar(&year_with_lunar(1, 1, 1), 1, r#"{"2027-02-30":"初一"}"#);
    let err = generate_document_latex(&doc).unwrap_err();
    assert!(err.contains("2027-02-30"), "{err}");

    let doc = document_with_lunar(&year_with_lunar(1, 1, 1), 1, r#"{"2027-01-01":"  "}"#);
    let err = generate_document_latex(&doc).unwrap_err();
    assert!(err.contains("农历标签不能为空"), "{err}");

    let long = format!("\"2027-01-01\":\"{}\"", "农".repeat(200));
    let doc = document_with_lunar(&year_with_lunar(1, 1, 1), 1, &format!("{{{long}}}"));
    assert!(generate_document_latex(&doc).is_err());
}

#[test]
fn lunar_label_font_shrinks_to_fit_the_cell() {
    // 副标签字号 = min(日期字号 × 0.5, 格宽 / 字数)；A5 3×4 下格宽约 3.57mm。
    let lunar = r#"{"2027-01-01":"冬月廿四","2027-01-02":"廿五"}"#;
    let doc = document_with_lunar(&year_with_lunar(3, 4, 12), 1, lunar);
    let tex = generate_document_latex(&doc).unwrap();
    // 日期字号 5pt → 副标签 2.5pt；4 字标签受格宽限制会更小，但不能小于 1pt。
    assert!(
        tex.contains("\\fontsize{2.5}{3}"),
        "缺少 2.5pt 副标签：{tex}"
    );
    let four = tex
        .lines()
        .find(|line| line.contains("冬月廿四"))
        .expect("缺少四字标签");
    assert!(
        !four.contains("\\fontsize{2.5}"),
        "四字标签应当更小：{four}"
    );
}

#[test]
fn dense_grid_falls_back_to_a_single_row_day_number() {
    // 12 行 × 1 列：格高约 (页心高 - 3mm) / 8，放不下「日号 + 农历」两行，
    // 此时仍然出日号，但不硬塞农历以免与下一行重叠。
    let lunar = r#"{"2027-01-01":"冬月廿四"}"#;
    let doc = document_with_lunar(&year_with_lunar(12, 1, 12), 1, lunar);
    let tex = generate_document_latex(&doc).unwrap();
    let labels = texts(pages(&tex)[0]);
    assert!(labels.iter().any(|t| t == "15"), "缺少日号：{labels:?}");
    assert!(
        !labels.iter().any(|t| t == "冬月廿四"),
        "格高不足时不该画农历"
    );
}
