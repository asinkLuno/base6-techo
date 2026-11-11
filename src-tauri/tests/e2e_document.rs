//! 真实编译一个含空白节、带左侧竖线的横线节、方眼罫节、两侧水印与特殊字符的六页文档。
use base6_techo_lib::{
    compile,
    templates::document::{Document, generate_document_latex},
};
use std::path::PathBuf;

#[test]
fn mixed_sections_compile_to_real_pdf() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf();
    compile::set_engine_env(
        &root.join("build/prewarm-work/tectonic-cache"),
        &root.join("build/prewarm-work/home"),
    );
    let doc: Document = serde_json::from_str(r##"{
        "page": {"paper": {"kind": "a5"}, "margins": {"innerMm": 20, "outerMm": 8}},
        "decorations": {
            "header": {"content": {"kind": "text", "text": "LaTeX 框架 100% & #1_{} $ \\ ^ ~"}, "style": {"sizePt": 8}},
            "footer": {"pageNumber": true, "align": "outer"},
            "innerWatermark": {"text": "INNER 装订侧", "style": {"sizePt": 8}},
            "outerWatermark": {"text": "OUTER 外侧", "style": {"sizePt": 8}}
        },
        "sections": [
            {"pages": 3, "numbered": false},
            {"pages": 2, "body": {
                "kind": "linear",
                "spacingMm": 7.5,
                "marginLine": {"xMm": 25, "color": "#D96A6A", "widthPt": 0.4}
            }},
            {"pages": 1, "body": {"kind": "hogen", "color": "#A9D1AE"}}
        ]
    }"##).unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    let job = root.join("build/framework-e2e");
    let out = compile::compile(&tex, &job, &[], &compile::noop_sink()).expect("编译多节文档");
    assert!(out.pdf.starts_with(b"%PDF"));
    assert!(out.pdf.len() > 2000);
    assert!(!out.log.contains("Missing character"), "{}", out.log);
    std::fs::write(root.join("build/framework-sample.tex"), &tex).unwrap();
    std::fs::write(root.join("build/framework-sample.pdf"), &out.pdf).unwrap();
}
