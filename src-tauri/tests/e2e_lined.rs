//! 端到端验证：横线本生成的 LaTeX 经 tectonic 编译出真实 PDF。
//!
//! 依赖仓库内的预热缓存 `build/prewarm-work/tectonic-cache`（首次遇到新宏包时
//! 会联网补拉，之后离线可用）。

use std::path::PathBuf;

use base6_techo_lib::compile;
use base6_techo_lib::templates::lined::{
    LinedDocParams, PageNumberPos, PaperSize, generate_lined_latex,
};

#[test]
fn lined_template_compiles_to_real_pdf() {
    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri has a parent")
        .to_path_buf();
    let cache = repo_root.join("build/prewarm-work/tectonic-cache");
    let home = repo_root.join("build/prewarm-work/home");
    assert!(
        cache.join("bundles").exists(),
        "预热缓存不存在，先跑 scripts/make-offline-cache.sh"
    );

    compile::set_engine_env(&cache, &home);

    let params = LinedDocParams {
        paper: PaperSize::A4,
        line_spacing_mm: 7.0,
        page_number_pos: PageNumberPos::Outer,
        pages: 2,
    };
    let tex = generate_lined_latex(&params).expect("参数合法");
    let job = std::env::temp_dir().join(format!("base6-e2e-lined-{}", std::process::id()));
    let out =
        compile::compile(&tex, &job, &[], &compile::noop_sink()).expect("tectonic 编译横线本");
    let _ = std::fs::remove_dir_all(&job);

    assert!(out.pdf.starts_with(b"%PDF"), "输出不是 PDF");
    assert!(
        out.pdf.len() > 2000,
        "PDF 过小（{} 字节），疑似空文档",
        out.pdf.len()
    );

    // 留一份样例到 build/（gitignored）供人工目检。
    let sample = repo_root.join("build/lined-sample.pdf");
    std::fs::write(&sample, &out.pdf).expect("写样例 PDF");
    println!("sample written to {}", sample.display());
}
