//! 月历真实编译：连续三个月，包含网格、标题与逐日月相。
use base6_techo_lib::{
    compile,
    templates::document::{Document, generate_document_latex},
};
use std::path::PathBuf;

#[test]
fn three_months_compile_to_real_pdf() {
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
            "pages": 3,
            "numbered": true,
            "body": {
                "kind": "month",
                "startMonth": "2026-06",
                "months": 3,
                "titleFormat": "%Y年%-m月",
                "dateSizePt": 9
            }
        }]
    }"#,
    )
    .unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    assert_eq!(tex.matches("% physical=").count(), 3);
    let job = root.join("build/month-e2e");
    let out = compile::compile(&tex, &job, &[], &compile::noop_sink()).expect("编译月历");
    assert!(out.pdf.starts_with(b"%PDF"));
    assert!(out.pdf.len() > 2000);
    assert!(!out.log.contains("Missing character"), "{}", out.log);
    std::fs::write(root.join("build/month-sample.tex"), &tex).unwrap();
    std::fs::write(root.join("build/month-sample.pdf"), &out.pdf).unwrap();
}
