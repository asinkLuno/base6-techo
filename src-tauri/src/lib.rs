mod cache;
pub mod compile;
pub mod templates;

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{Emitter, Manager};

/// 实时编译日志事件：编译期间逐条推给前端（`compile-log`）。
#[derive(Clone, Serialize)]
struct CompileLogEvent {
    /// tex | note | warning | error
    kind: String,
    line: String,
}

/// 生成横线本 PDF 的原始 IPC payload：
/// `[u32 log_len LE][log utf8][u32 tex_len LE][tex utf8][pdf bytes]`
/// — PDF 走裸字节避免 JSON 编码，同时把生成的 LaTeX 源码一并回传。
#[tauri::command]
async fn generate_lined_pdf(
    app: tauri::AppHandle,
    params: templates::lined::LinedDocParams,
) -> Result<tauri::ipc::Response, String> {
    generate_pdf(app, move || templates::lined::generate_lined_latex(&params)).await
}

/// 整本框架入口，与旧横线本命令共享相同的响应格式。
#[tauri::command]
async fn generate_document_pdf(
    app: tauri::AppHandle,
    document: templates::document::Document,
) -> Result<tauri::ipc::Response, String> {
    generate_pdf(app, move || {
        templates::document::generate_document_latex(&document)
    })
    .await
}

async fn generate_pdf(
    app: tauri::AppHandle,
    generate: impl FnOnce() -> Result<String, String> + Send + 'static,
) -> Result<tauri::ipc::Response, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let tex = generate()?;
        // 实时日志：编译期间的引擎转写与状态消息经事件推给前端
        let sink: Arc<compile::LogSink> = {
            let app = app.clone();
            Arc::new(move |kind, line| {
                let _ = app.emit(
                    "compile-log",
                    CompileLogEvent {
                        kind: kind.to_string(),
                        line: line.to_string(),
                    },
                );
            })
        };
        let out = compile_document(&app, &tex, vec![], &sink)?;
        let log = out.log.into_bytes();
        let tex_bytes = tex.into_bytes();
        let mut payload = Vec::with_capacity(8 + log.len() + tex_bytes.len() + out.pdf.len());
        payload.extend_from_slice(&(log.len() as u32).to_le_bytes());
        payload.extend_from_slice(&log);
        payload.extend_from_slice(&(tex_bytes.len() as u32).to_le_bytes());
        payload.extend_from_slice(&tex_bytes);
        payload.extend_from_slice(&out.pdf);
        Ok(tauri::ipc::Response::new(payload))
    })
    .await
    .map_err(|e| format!("生成任务异常终止：{e}"))?
}

/// 把预览的 PDF 字节写到用户在「另存为」对话框选定的路径（桌面端）。
/// Android 的 content:// URI 由 fs 插件的 writeFile 处理，不走本命令。
/// 字节走原始 IPC body，路径放 header（前端 encodeURIComponent，非 ASCII 进不了 header）。
#[tauri::command]
async fn write_pdf_file(request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let raw_path = request
        .headers()
        .get("path")
        .and_then(|v| v.to_str().ok())
        .ok_or("缺少保存路径")?;
    let path = percent_encoding::percent_decode_str(raw_path)
        .decode_utf8()
        .map_err(|e| format!("保存路径无效：{e}"))?
        .into_owned();
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("请求体应为原始字节".to_string());
    };
    // 自定义命令不受 fs 插件 scope 约束，路径又来自 webview：只接受另存为
    // 对话框会返回的绝对 .pdf 路径，并确认内容确实是 PDF。
    let path = validate_pdf_target(&path, bytes)?;
    // spawn_blocking 要求 'static，把字节复制出来再移进闭包
    let bytes = bytes.to_vec();
    tauri::async_runtime::spawn_blocking(move || {
        std::fs::write(&path, bytes).map_err(|e| format!("写入文件失败：{e}"))
    })
    .await
    .map_err(|e| format!("写入任务异常终止：{e}"))?
}

fn validate_pdf_target(path: &str, bytes: &[u8]) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    if !path.is_absolute() {
        return Err("保存路径必须是绝对路径".into());
    }
    let is_pdf = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("pdf"));
    if !is_pdf {
        return Err("保存路径必须以 .pdf 结尾".into());
    }
    if !bytes.starts_with(b"%PDF") {
        return Err("写入内容不是 PDF".into());
    }
    Ok(path)
}

fn compile_document(
    app: &tauri::AppHandle,
    source: &str,
    extra_files: Vec<(String, Vec<u8>)>,
    sink: &Arc<compile::LogSink>,
) -> Result<compile::CompileOutput, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let jobs_dir = data_dir.join("jobs");
    let job_root = next_job_root(&jobs_dir);
    let result = compile::compile(source, &job_root, &extra_files, sink);
    prune_jobs(&jobs_dir, &job_root);
    result
}

/// 毫秒时间戳 + pid + 序号：同名目录会让并发（或另一个 App 实例）互相清空。
fn next_job_root(jobs_dir: &Path) -> PathBuf {
    static SEQUENCE: AtomicU64 = AtomicU64::new(0);
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let sequence = SEQUENCE.fetch_add(1, Ordering::Relaxed);
    jobs_dir.join(format!("{stamp}-{}-{sequence}", std::process::id()))
}

/// 只保留最近 `JOB_RETENTION` 个任务目录用于排查，且绝不删除当前目录或
/// 最近 `JOB_MIN_AGE` 内仍可能被另一个进程写入的目录。
fn prune_jobs(jobs_dir: &Path, current: &Path) {
    prune_jobs_older_than(jobs_dir, current, JOB_RETENTION, JOB_MIN_AGE);
}

const JOB_RETENTION: usize = 5;
const JOB_MIN_AGE: Duration = Duration::from_secs(30 * 60);

fn prune_jobs_older_than(jobs_dir: &Path, current: &Path, keep: usize, min_age: Duration) {
    let Ok(entries) = std::fs::read_dir(jobs_dir) else {
        return;
    };
    let now = SystemTime::now();
    let mut dirs: Vec<PathBuf> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .collect();
    dirs.sort();
    let mut remaining = dirs.len();
    for dir in dirs {
        if remaining <= keep {
            break;
        }
        if dir == current || !is_older_than(&dir, now, min_age) {
            continue;
        }
        if std::fs::remove_dir_all(&dir).is_ok() {
            remaining -= 1;
        }
    }
}

fn is_older_than(path: &Path, now: SystemTime, min_age: Duration) -> bool {
    path.metadata()
        .and_then(|metadata| metadata.modified())
        .is_ok_and(|modified| now.duration_since(modified).is_ok_and(|age| age >= min_age))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Must run before any compile: pins tectonic's cache/home dirs and
            // unpacks the prewarmed offline cache on first launch.
            match cache::bootstrap(app.handle()) {
                Ok(cache_dir) => {
                    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
                    compile::set_engine_env(&cache_dir, &data_dir);
                }
                Err(e) => eprintln!("[base6-techo] offline cache bootstrap failed: {e}"),
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            generate_lined_pdf,
            generate_document_pdf,
            write_pdf_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("base6-lib-{name}-{}", std::process::id()))
    }

    fn make_jobs(root: &Path, count: usize) -> Vec<PathBuf> {
        fs::create_dir_all(root).unwrap();
        (0..count)
            .map(|index| {
                let job = root.join(format!("job-{index}"));
                fs::create_dir(&job).unwrap();
                job
            })
            .collect()
    }

    fn names(root: &Path) -> Vec<std::ffi::OsString> {
        let mut names: Vec<_> = fs::read_dir(root)
            .unwrap()
            .flatten()
            .map(|entry| entry.file_name())
            .collect();
        names.sort();
        names
    }

    #[test]
    fn pdf_target_requires_absolute_pdf_path_and_pdf_bytes() {
        assert!(validate_pdf_target("/tmp/out.pdf", b"%PDF-1.7").is_ok());
        assert!(validate_pdf_target("/tmp/out.PDF", b"%PDF").is_ok());
        assert!(validate_pdf_target("out.pdf", b"%PDF").is_err());
        assert!(validate_pdf_target("/tmp/out.txt", b"%PDF").is_err());
        assert!(validate_pdf_target("/tmp/out.pdf", b"not a pdf").is_err());
    }

    #[test]
    fn job_roots_are_unique_within_one_millisecond() {
        let jobs_dir = PathBuf::from("/tmp/base6-jobs");
        assert_ne!(next_job_root(&jobs_dir), next_job_root(&jobs_dir));
    }

    #[test]
    fn prune_removes_only_the_oldest_surplus_dirs() {
        let root = temp_dir("prune");
        let jobs = make_jobs(&root, 8);

        prune_jobs_older_than(&root, &jobs[7], 3, Duration::ZERO);

        let expected: Vec<_> = jobs[5..]
            .iter()
            .map(|job| job.file_name().unwrap().to_os_string())
            .collect();
        assert_eq!(names(&root), expected);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn prune_skips_dirs_recently_touched_by_another_process() {
        let root = temp_dir("prune-recent");
        let jobs = make_jobs(&root, 8);

        prune_jobs_older_than(&root, &jobs[7], 1, Duration::from_secs(3600));

        assert_eq!(names(&root).len(), jobs.len());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn prune_never_removes_the_current_job() {
        let root = temp_dir("prune-current");
        let jobs = make_jobs(&root, 2);

        prune_jobs_older_than(&root, &jobs[0], 1, Duration::ZERO);

        assert_eq!(
            names(&root),
            vec![jobs[0].file_name().unwrap().to_os_string()]
        );
        let _ = fs::remove_dir_all(&root);
    }
}
