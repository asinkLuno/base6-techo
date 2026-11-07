//! Thin wrapper around the tectonic engine, shared by the Tauri command
//! (`compile_tex`) and the desktop `prewarm` binary.

use std::fs;
use std::path::{Component, Path, PathBuf};

const DOC_NAME: &str = "document.tex";
const PDF_NAME: &str = "document.pdf";
const LOG_NAME: &str = "document.log";

pub struct CompileOutput {
    pub pdf: Vec<u8>,
    pub log: String,
}

/// Point tectonic (and its `directories`-based path resolution) at app-private
/// dirs. Must be called once before any engine use — done in the Tauri setup
/// hook, single-threaded. `set_var` is unsafe as of edition 2024.
pub fn set_engine_env(cache_dir: &Path, home_dir: &Path) {
    unsafe {
        std::env::set_var("TECTONIC_CACHE_DIR", cache_dir);
        std::env::set_var("XDG_CACHE_HOME", home_dir);
        std::env::set_var("HOME", home_dir);
        // Keeps \today / \time deterministic across devices.
        std::env::set_var("TZ", "UTC0");
    }
}

/// Compile `source` (the main document, in memory) inside `job_root`.
/// `extra_files` are additional project files (`\input`, graphics) written
/// into `job_root` before the run.
///
/// The engine is wrapped in `catch_unwind`: tectonic unwraps internally in
/// several places (e.g. cache misses while offline), and a panic crossing the
/// async-command/FFI boundary would abort the whole process.
pub fn compile(
    source: &str,
    job_root: &Path,
    extra_files: &[(String, Vec<u8>)],
) -> Result<CompileOutput, String> {
    // Fresh job dir per run: tectonic writes outputs and reads \input files here.
    if job_root.exists() {
        fs::remove_dir_all(job_root)
            .map_err(|e| format!("无法清理任务目录 {}：{e}", job_root.display()))?;
    }
    fs::create_dir_all(job_root)
        .map_err(|e| format!("无法创建任务目录 {}：{e}", job_root.display()))?;
    for (name, data) in extra_files {
        let path = job_root.join(clean_rel_path(name)?);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("无法创建子目录：{e}"))?;
        }
        fs::write(&path, data).map_err(|e| format!("无法写入文件 {name}：{e}"))?;
    }

    let source = source.to_string();
    let job_root = job_root.to_path_buf();
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| run_engine(&source, &job_root)))
    {
        Ok(result) => result,
        Err(payload) => {
            let msg = payload
                .downcast_ref::<String>()
                .cloned()
                .or_else(|| payload.downcast_ref::<&str>().map(|s| s.to_string()))
                .unwrap_or_else(|| "未知 panic".to_string());
            Err(format!("引擎内部 panic：{msg}"))
        }
    }
}

/// Reject absolute paths and `..` components in user-provided file names.
fn clean_rel_path(name: &str) -> Result<PathBuf, String> {
    let p = Path::new(name);
    if p.is_absolute() {
        return Err(format!("非法路径（不允许绝对路径）：{name}"));
    }
    let mut out = PathBuf::new();
    for comp in p.components() {
        match comp {
            Component::Normal(c) => out.push(c),
            Component::CurDir => {}
            _ => return Err(format!("非法路径（不允许 `..` 等成分）：{name}")),
        }
    }
    Ok(out)
}

fn run_engine(source: &str, job_root: &Path) -> Result<CompileOutput, String> {
    let config = tectonic::config::PersistentConfig::open(false)
        .map_err(|e| format!("无法打开 tectonic 配置：{e}"))?;
    // only_cached = false: prefer the local (prewarmed) cache; missing files
    // fall back to the network bundle.
    let bundle = config
        .default_bundle(false)
        .map_err(|e| format!("无法加载宏包 bundle：{e}"))?;
    let format_cache = config
        .format_cache_path()
        .map_err(|e| format!("无法定位 format 缓存：{e}"))?;

    let mut builder = tectonic::driver::ProcessingSessionBuilder::default();
    builder
        .bundle(bundle)
        .format_cache_path(&format_cache)
        .primary_input_buffer(source.as_bytes())
        .tex_input_name(DOC_NAME)
        .format_name("latex")
        .output_format(tectonic::driver::OutputFormat::Pdf)
        .output_dir(job_root)
        .filesystem_root(job_root)
        .keep_logs(true)
        .keep_intermediates(false)
        .print_stdout(false);

    let mut status = tectonic::status::NoopStatusBackend::default();
    let mut session = builder
        .create(&mut status)
        .map_err(|e| format!("无法创建编译会话：{e}"))?;
    session.run(&mut status).map_err(|e| format!("编译失败：{e}"))?;

    let pdf = fs::read(job_root.join(PDF_NAME)).map_err(|e| format!("未找到 PDF 输出：{e}"))?;
    let log = fs::read_to_string(job_root.join(LOG_NAME)).unwrap_or_default();
    Ok(CompileOutput { pdf, log })
}
