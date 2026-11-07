//! Desktop helper: warms a tectonic cache against the official online bundle
//! so the app can ship it for offline use (see scripts/make-offline-cache.sh).
//!
//! Usage: prewarm --out <dir>
//! Produces <dir>/tectonic-cache with the standard bundles/ + formats/ layout.

use std::fs;
use std::path::PathBuf;

use base6_techo_lib::compile;
use base6_techo_lib::templates::lined::{
    generate_lined_latex, LinedDocParams, PageNumberPos, PaperSize,
};

/// Documents whose dependencies get pulled into the cache: the actual product
/// templates across paper-size/position code paths. Anything missing is still
/// fetchable online, but offline devices can only use cached packages.
fn warm_docs() -> Vec<(&'static str, String)> {
    let doc = |paper, spacing, pos| LinedDocParams {
        paper,
        line_spacing_mm: spacing,
        page_number_pos: pos,
        pages: 2,
    };
    vec![
        (
            "lined-a4-outer",
            generate_lined_latex(&doc(PaperSize::A4, 7.0, PageNumberPos::Outer)).expect("参数合法"),
        ),
        (
            "lined-a5-center",
            generate_lined_latex(&doc(PaperSize::A5, 8.0, PageNumberPos::Center)).expect("参数合法"),
        ),
        (
            "lined-custom-a6-inner",
            generate_lined_latex(&doc(PaperSize::A6, 5.0, PageNumberPos::Inner)).expect("参数合法"),
        ),
    ]
}

fn main() {
    let mut out_dir = PathBuf::from("prewarmed-cache");
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--out" => {
                out_dir = PathBuf::from(args.next().expect("--out needs a value"));
            }
            other => {
                eprintln!("unknown argument: {other}");
                eprintln!("usage: prewarm --out <dir>");
                std::process::exit(2);
            }
        }
    }

    let cache_dir = out_dir.join("tectonic-cache");
    let home_dir = out_dir.join("home");
    fs::create_dir_all(&cache_dir).expect("create cache dir");
    fs::create_dir_all(&home_dir).expect("create home dir");
    compile::set_engine_env(&cache_dir, &home_dir);

    // Note: compile() wipes the job dir per run, so outputs never leak into
    // the cache; only bundles/ + formats/ accumulate.
    let job_root = out_dir.join("job");
    let mut all_ok = true;
    for (name, doc) in warm_docs() {
        eprintln!("== warming {name} ==");
        match compile::compile(&doc, &job_root, &[]) {
            Ok(out) => eprintln!("   ok: {} bytes pdf", out.pdf.len()),
            Err(e) => {
                eprintln!("   FAILED: {e}");
                all_ok = false;
            }
        }
    }
    let _ = fs::remove_dir_all(&job_root);

    // Summary
    let mut files = 0usize;
    let mut bytes = 0u64;
    for dir in ["bundles", "formats"] {
        collect(&cache_dir.join(dir), &mut files, &mut bytes);
    }
    eprintln!(
        "== cache: {files} files, {:.1} MiB at {} ==",
        bytes as f64 / (1024.0 * 1024.0),
        cache_dir.display()
    );
    if !all_ok {
        std::process::exit(1);
    }
}

fn collect(dir: &std::path::Path, files: &mut usize, bytes: &mut u64) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect(&path, files, bytes);
        } else {
            *files += 1;
            *bytes += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
}
