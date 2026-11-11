//! 月打卡真实编译：连续两个月，包含两段式表格、日期与连接箭头。
use base6_techo_lib::{
    compile,
    templates::document::{Document, generate_document_latex},
};
use std::path::PathBuf;

#[test]
fn two_months_compile_to_real_pdf() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf();
    compile::set_engine_env(
        &root.join("build/prewarm-work/tectonic-cache"),
        &root.join("build/prewarm-work/home"),
    );
    let doc: Document = serde_json::from_str(
        r#"{
        "sections": [{
            "pages": 2,
            "numbered": true,
            "body": {
                "kind": "tracker",
                "startMonth": "2026-07",
                "months": 2,
                "items": 4,
                "dateSizePt": 8
            }
        }]
    }"#,
    )
    .unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    assert_eq!(tex.matches("% physical=").count(), 2);
    let job = root.join("build/tracker-e2e");
    let out = compile::compile(&tex, &job, &[], &compile::noop_sink()).expect("编译月打卡");
    assert!(out.pdf.starts_with(b"%PDF"));
    assert!(out.pdf.len() > 2000);
    assert!(!out.log.contains("Missing character"), "{}", out.log);
    std::fs::write(root.join("build/tracker-sample.tex"), &tex).unwrap();
    std::fs::write(root.join("build/tracker-sample.pdf"), &out.pdf).unwrap();
}
