//! 八分周视图真实编译：两周四页，包含迷你月历、本周高亮与月相。
use base6_techo_lib::{
    compile,
    templates::document::{Document, generate_document_latex},
};
use std::path::PathBuf;

#[test]
fn two_weeks_compile_to_real_pdf() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf();
    compile::set_engine_env(
        &root.join("build/prewarm-work/tectonic-cache"),
        &root.join("build/prewarm-work/home"),
    );
    let doc: Document = serde_json::from_str(
        r##"{
        "sections": [{
            "pages": 4,
            "numbered": true,
            "body": {
                "kind": "octanWeek",
                "startDate": "2026-08-03",
                "endDate": "2026-08-16",
                "dateFormat": "%a %-d",
                "weekdayLang": "en",
                "lineStyle": "dashDot",
                "centerGapMm": 3,
                "dateSizePt": 10
            }
        }]
    }"##,
    )
    .unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    assert_eq!(tex.matches("% physical=").count(), 4);
    let job = root.join("build/octan-week-e2e");
    let out = compile::compile(&tex, &job, &[], &compile::noop_sink()).expect("编译八分周视图");
    assert!(out.pdf.starts_with(b"%PDF"));
    assert!(out.pdf.len() > 2000);
    assert!(!out.log.contains("Missing character"), "{}", out.log);
    std::fs::write(root.join("build/octan-week-sample.tex"), &tex).unwrap();
    std::fs::write(root.join("build/octan-week-sample.pdf"), &out.pdf).unwrap();
}
