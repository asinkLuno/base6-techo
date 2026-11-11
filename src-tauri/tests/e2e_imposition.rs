//! 骑马订与锁线分帖的真实 PDF，坐标检查见 scripts/check-imposition-samples.py。
use base6_techo_lib::{
    compile,
    templates::{
        document::{Document, generate_document_latex},
        imposition::Imposition,
    },
};
use std::path::PathBuf;

#[test]
fn imposed_documents_compile_to_real_pdf() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf();
    compile::set_engine_env(
        &root.join("build/prewarm-work/tectonic-cache"),
        &root.join("build/prewarm-work/home"),
    );
    let mut doc: Document = serde_json::from_str(
        r#"{
        "page": {"margins": {"innerMm":20,"outerMm":8}},
        "decorations": {
            "header":{"content":{"kind":"text","text":"BOOK"}},
            "footer":{"pageNumber":true,"align":"outer"},
            "innerWatermark":{"text":"INNER","style":{"sizePt":8}},
            "outerWatermark":{"text":"OUTER","style":{"sizePt":8}}
        },
        "sections":[{"body":{"kind":"linear","spacingMm":7.5}}]
    }"#,
    )
    .unwrap();
    for (name, count, imposition) in [
        ("booklet", 5, Imposition::Booklet {}),
        (
            "thread",
            10,
            Imposition::Thread {
                sheets_per_signature: 2,
            },
        ),
    ] {
        doc.sections[0].pages = count;
        doc.imposition = imposition;
        let tex = generate_document_latex(&doc).unwrap();
        assert!(tex.contains("paperwidth=296mm,paperheight=210mm"));
        let out = compile::compile(
            &tex,
            &root.join(format!("build/{name}-e2e")),
            &[],
            &compile::noop_sink(),
        )
        .expect("编译拼版 PDF");
        assert!(out.pdf.starts_with(b"%PDF"));
        assert!(!out.log.contains("Missing character"), "{}", out.log);
        std::fs::write(root.join(format!("build/{name}-sample.tex")), tex).unwrap();
        std::fs::write(root.join(format!("build/{name}-sample.pdf")), out.pdf).unwrap();
    }
}
