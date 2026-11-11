//! 月打卡：两段式表格、逐页推进、页数约束与参数校验。
use base6_techo_lib::templates::document::{Document, generate_document_latex, plan_document};

fn document(body: &str, pages: usize) -> Document {
    serde_json::from_str(&format!(
        r#"{{
            "sections": [{{"pages": {pages}, "body": {body}}}]
        }}"#
    ))
    .expect("valid document json")
}

fn tracker(start: &str, months: usize) -> String {
    format!(r#"{{"kind":"tracker","startMonth":"{start}","months":{months}}}"#)
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
    let doc = document(&tracker("2026-07", 2), 2);
    let tex = generate_document_latex(&doc).unwrap();
    let pages = pages(&tex);
    assert_eq!(pages.len(), 2);
    // 7 月 31 天、8 月 31 天：两页都以 31 结尾。
    assert_eq!(texts(pages[0], "south east").last().unwrap(), "31");
    assert_eq!(texts(pages[1], "south east").last().unwrap(), "31");
}

#[test]
fn august_2026_matches_archive_table_geometry() {
    let doc = document(&tracker("2026-08", 1), 1);
    let tex = generate_document_latex(&doc).unwrap();
    let page = pages(&tex)[0];
    // 上表 16 条列界 × 4 段 + 5 条横线 × 15 段；
    // 下表 18 × 4 + 5 × 17，共 296 条格线。
    assert_eq!(page.matches("\\draw[ink,line width=").count(), 296);
    // 打卡项 4 行 → 4 条连接箭头。
    assert_eq!(page.matches("\\draw[->,ink,line width=").count(), 4);
    assert_eq!(texts(page, "south east").len(), 31);
    // 1 号在左上表格内，整页逆时针旋转 90° 后的位置。
    assert!(page.contains("at (33.589474,133.684211) {1}"), "{page}");
}

#[test]
fn item_count_controls_rows_and_arrows() {
    let body = r#"{"kind":"tracker","startMonth":"2026-08","months":1,"items":6}"#;
    let doc = document(body, 1);
    let page = generate_document_latex(&doc).unwrap();
    assert_eq!(page.matches("\\draw[->,ink,line width=").count(), 6);
}

#[test]
fn page_count_must_match_the_number_of_months() {
    let doc = document(&tracker("2026-07", 3), 2);
    let error = plan_document(&doc).err().expect("page mismatch");
    assert!(error.contains("月打卡每月需要 1 页"), "{error}");
    let doc = document(&tracker("2026-07", 3), 3);
    assert_eq!(plan_document(&doc).unwrap().pages().len(), 3);
}

#[test]
fn rejects_invalid_tracker_inputs() {
    for body in [
        r#"{"kind":"tracker","startMonth":"2026-13","months":1}"#,
        r#"{"kind":"tracker","startMonth":"2026-7","months":1}"#,
        r#"{"kind":"tracker","startMonth":"2026-07","months":0}"#,
        r#"{"kind":"tracker","startMonth":"2026-07","months":121}"#,
        r#"{"kind":"tracker","startMonth":"2026-07","months":1,"items":0}"#,
        r#"{"kind":"tracker","startMonth":"2026-07","months":1,"items":31}"#,
        r#"{"kind":"tracker","startMonth":"9999-12","months":2}"#,
        r#"{"kind":"tracker","startMonth":"2026-07","months":1,"lineColor":"red"}"#,
    ] {
        let doc = document(body, 1);
        assert!(generate_document_latex(&doc).is_err(), "{body}");
    }
}
