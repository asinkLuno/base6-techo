//! 真实编译一页 3×4 的 2027 年历（含 iCal 导入的节假日与农历副标签），
//! 产出 build/year-sample.pdf 供目视核对。
use base6_techo_lib::{
    compile,
    templates::document::{Document, generate_document_latex},
};
use std::path::PathBuf;

#[test]
fn year_calendar_compiles_to_real_pdf() {
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
        "page": {"paper": {"kind": "b5"}, "margins": {"innerMm": 18, "outerMm": 14, "headerMm": 12, "footerMm": 12}},
        "decorations": {
            "header": {"content": {"kind": "text", "text": "2027"}, "style": {"sizePt": 8}},
            "footer": {"pageNumber": true, "align": "outer"}
        },
        "holidays": {
            "2027-01-01": "元旦",
            "2027-02-07": "春节",
            "2027-02-08": "春节",
            "2027-02-09": "春节",
            "2027-04-05": "清明",
            "2027-05-01": "劳动节",
            "2027-10-01": "国庆",
            "2027-10-02": "国庆",
            "2027-10-03": "国庆"
        },
        "lunar": {
            "2027-01-01": "冬月廿四",
            "2027-02-06": "正月",
            "2027-02-07": "初二",
            "2027-02-08": "初三",
            "2027-06-05": "五月",
            "2027-06-06": "初二",
            "2027-12-31": "冬月初五"
        },
        "sections": [{"pages": 1, "body": {"kind": "year", "startMonth": "2027-01", "months": 12, "showLunar": true}}]
    }"##,
    )
    .unwrap();
    let tex = generate_document_latex(&doc).unwrap();
    let job = root.join("build/year-e2e");
    let out = compile::compile(&tex, &job, &[], &compile::noop_sink()).expect("编译年历");
    assert!(out.pdf.starts_with(b"%PDF"));
    assert!(out.pdf.len() > 2000);
    assert!(!out.log.contains("Missing character"), "{}", out.log);
    std::fs::write(root.join("build/year-sample.tex"), &tex).unwrap();
    std::fs::write(root.join("build/year-sample.pdf"), &out.pdf).unwrap();
}
