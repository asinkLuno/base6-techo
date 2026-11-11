//! 一日时间轴：日期推进、小时刻度分页、昼夜着色与页数约束。
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

fn daily(start: &str, end: &str) -> String {
    format!(r#"{{"kind":"daily","startDate":"{start}","endDate":"{end}"}}"#)
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

/// 日期标题贴外侧：左装订页 `south east`，右装订页 `south west`。
fn titles(page: &str) -> Vec<String> {
    let mut out = texts(page, "south east");
    out.extend(texts(page, "south west"));
    out
}

#[test]
fn pages_advance_one_day_at_a_time() {
    let doc = document(&daily("2026-08-31", "2026-09-02"), 3);
    let tex = generate_document_latex(&doc).unwrap();
    let pages = pages(&tex);
    assert_eq!(pages.len(), 3);
    assert_eq!(titles(pages[0]), ["2026年8月31日"]);
    assert_eq!(titles(pages[1]), ["2026年9月1日"]);
    assert_eq!(titles(pages[2]), ["2026年9月2日"]);
}

#[test]
fn one_page_day_labels_every_hour_from_00_to_24() {
    let doc = document(&daily("2026-08-31", "2026-08-31"), 1);
    let tex = generate_document_latex(&doc).unwrap();
    let labels = texts(pages(&tex)[0], "center");
    assert_eq!(labels.len(), 25, "{labels:?}");
    assert_eq!(labels.first().map(String::as_str), Some("00"));
    assert_eq!(labels.last().map(String::as_str), Some("24"));
}

#[test]
fn two_page_day_splits_hours_in_reading_order() {
    let body =
        r#"{"kind":"daily","startDate":"2026-08-31","endDate":"2026-08-31","pagesPerDay":2}"#;
    let doc = document(body, 2);
    let tex = generate_document_latex(&doc).unwrap();
    let pages = pages(&tex);
    let first = texts(pages[0], "center");
    let second = texts(pages[1], "center");
    assert_eq!(first.first().map(String::as_str), Some("00"));
    assert_eq!(first.last().map(String::as_str), Some("12"));
    assert_eq!(second.first().map(String::as_str), Some("12"));
    assert_eq!(second.last().map(String::as_str), Some("24"));
    // 标题两页都保留当天日期。
    assert_eq!(titles(pages[1]), ["2026年8月31日"]);
}

#[test]
fn night_owl_hours_wrap_in_labels() {
    let body = r#"{"kind":"daily","startDate":"2026-08-31","endDate":"2026-08-31","startHour":20,"endHour":30}"#;
    let doc = document(body, 1);
    let tex = generate_document_latex(&doc).unwrap();
    let labels = texts(pages(&tex)[0], "center");
    assert_eq!(labels.first().map(String::as_str), Some("20"));
    assert_eq!(labels.last().map(String::as_str), Some("06"));
}

#[test]
fn sun_window_colors_day_and_night_ticks() {
    let body = r##"{
        "kind":"daily",
        "startDate":"2026-08-31",
        "endDate":"2026-08-31",
        "sun":{
            "latitude":31.23,
            "longitude":121.47,
            "utcOffsetHours":8,
            "daylightColor":"#E5B93F",
            "nightColor":"#496A9F"
        }
    }"##;
    let doc = document(body, 1);
    let tex = generate_document_latex(&doc).unwrap();
    assert!(tex.contains("\\definecolor{ink}{HTML}{E5B93F}"), "{tex}");
    assert!(tex.contains("\\definecolor{ink}{HTML}{496A9F}"), "{tex}");
}

#[test]
fn page_count_must_match_days_times_pages_per_day() {
    let doc = document(&daily("2026-08-31", "2026-09-06"), 6);
    let error = plan_document(&doc).err().expect("page mismatch");
    assert!(error.contains("天数 × 每日页数"), "{error}");
    let doc = document(&daily("2026-08-31", "2026-09-06"), 7);
    assert_eq!(plan_document(&doc).unwrap().pages().len(), 7);

    let body =
        r#"{"kind":"daily","startDate":"2026-08-31","endDate":"2026-08-31","pagesPerDay":2}"#;
    let doc = document(body, 1);
    assert!(plan_document(&doc).is_err());
    let doc = document(body, 2);
    assert_eq!(plan_document(&doc).unwrap().pages().len(), 2);
}

#[test]
fn rejects_invalid_daily_inputs() {
    for body in [
        r#"{"kind":"daily","startDate":"2026-02-30","endDate":"2026-03-01"}"#,
        r#"{"kind":"daily","startDate":"2026-09-02","endDate":"2026-09-01"}"#,
        r#"{"kind":"daily","startDate":"2026-08-31","endDate":"2026-08-31","startHour":12,"endHour":12}"#,
        r#"{"kind":"daily","startDate":"2026-08-31","endDate":"2026-08-31","startHour":0,"endHour":31}"#,
        r#"{"kind":"daily","startDate":"2026-08-31","endDate":"2026-08-31","pagesPerDay":3}"#,
        r#"{"kind":"daily","startDate":"2026-01-01","endDate":"2027-12-31","pagesPerDay":2}"#,
        r#"{"kind":"daily","startDate":"2026-08-31","endDate":"2026-08-31","titleFormat":"%Q"}"#,
        r#"{"kind":"daily","startDate":"2026-08-31","endDate":"2026-08-31","lineColor":"red"}"#,
        r##"{"kind":"daily","startDate":"2026-08-31","endDate":"2026-08-31","sun":{"latitude":91,"longitude":0,"utcOffsetHours":8,"daylightColor":"#E5B93F","nightColor":"#496A9F"}}"##,
        r##"{"kind":"daily","startDate":"2026-08-31","endDate":"2026-08-31","sun":{"latitude":0,"longitude":0,"utcOffsetHours":15,"daylightColor":"#E5B93F","nightColor":"#496A9F"}}"##,
    ] {
        let doc = document(body, 1);
        assert!(generate_document_latex(&doc).is_err(), "{body}");
    }
}
