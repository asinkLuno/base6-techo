mod cache;
pub mod compile;
pub mod templates;

use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::{FilePath, FsExt, OpenOptions};

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
        let payload = encode_response(&out.log, &tex, &out.pdf)?;
        Ok(tauri::ipc::Response::new(payload))
    })
    .await
    .map_err(|e| format!("生成任务异常终止：{e}"))?
}

/// 与 `src/lib/generatePdf.ts` 的 `parseCompileResponse` 对应：
/// `[u32 log_len LE][log utf8][u32 tex_len LE][tex utf8][pdf bytes]`。
fn encode_response(log: &str, tex: &str, pdf: &[u8]) -> Result<Vec<u8>, String> {
    let log_len = u32::try_from(log.len()).map_err(|_| "编译日志过大".to_string())?;
    let tex_len = u32::try_from(tex.len()).map_err(|_| "LaTeX 源码过大".to_string())?;
    let mut payload = Vec::with_capacity(8 + log.len() + tex.len() + pdf.len());
    payload.extend_from_slice(&log_len.to_le_bytes());
    payload.extend_from_slice(log.as_bytes());
    payload.extend_from_slice(&tex_len.to_le_bytes());
    payload.extend_from_slice(tex.as_bytes());
    payload.extend_from_slice(pdf);
    Ok(payload)
}

/// 「另存为」：保存对话框和落盘都在后端完成，目标路径不经过 webview。
/// 字节走原始 IPC body；建议文件名放 header（前端 encodeURIComponent，
/// 非 ASCII 进不了 header）。返回用户选定的目标，取消时返回 `None`。
#[tauri::command]
async fn save_pdf_file(
    app: tauri::AppHandle,
    request: tauri::ipc::Request<'_>,
) -> Result<Option<String>, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("请求体应为原始字节".to_string());
    };
    if !bytes.starts_with(b"%PDF") {
        return Err("写入内容不是 PDF".to_string());
    }
    let header = decode_header(request.headers(), "name")?;
    let name = suggested_name(header.as_deref(), DEFAULT_PDF_NAME, "pdf");
    // spawn_blocking 要求 'static，把字节复制出来再移进闭包
    let bytes = bytes.to_vec();
    tauri::async_runtime::spawn_blocking(move || save_via_dialog(&app, "PDF", "pdf", &name, &bytes))
        .await
        .map_err(|e| format!("保存任务异常终止：{e}"))?
}

/// 「导出配置」：对话框与写盘同样在后端，接收已序列化的 JSON 文本。
#[tauri::command]
async fn save_config_file(
    app: tauri::AppHandle,
    contents: String,
    name: String,
) -> Result<Option<String>, String> {
    let name = suggested_name(Some(name.as_str()), DEFAULT_CONFIG_NAME, "json");
    tauri::async_runtime::spawn_blocking(move || {
        save_via_dialog(&app, "JSON", "json", &name, contents.as_bytes())
    })
    .await
    .map_err(|e| format!("保存任务异常终止：{e}"))?
}

/// 用户选定的配置文件：路径只用于提示，解析交给前端。
#[derive(Serialize)]
struct OpenedConfigFile {
    target: String,
    contents: String,
}

/// 「导入配置」：对话框与读取都在后端，返回选定目标与 UTF-8 文本。
#[tauri::command]
async fn open_config_file(app: tauri::AppHandle) -> Result<Option<OpenedConfigFile>, String> {
    tauri::async_runtime::spawn_blocking(move || open_config_via_dialog(&app))
        .await
        .map_err(|e| format!("读取任务异常终止：{e}"))?
}

/// 解码 header 里的百分号编码文本；header 缺失或不是 UTF-8 时按缺省处理。
fn decode_header(headers: &tauri::http::HeaderMap, name: &str) -> Result<Option<String>, String> {
    let Some(raw) = headers.get(name) else {
        return Ok(None);
    };
    let raw = raw.to_str().map_err(|_| "建议文件名无效".to_string())?;
    let decoded = percent_encoding::percent_decode_str(raw)
        .decode_utf8()
        .map_err(|e| format!("建议文件名无效：{e}"))?;
    Ok(Some(decoded.into_owned()))
}

const DEFAULT_PDF_NAME: &str = "base6-techo.pdf";
const DEFAULT_CONFIG_NAME: &str = "base6-techo-config.json";
/// 配置是外部输入，读进内存前先限长。
const CONFIG_MAX_BYTES: u64 = 16 * 1024 * 1024;

/// 对话框默认文件名：只取文件名部分，缺失扩展名时补 `extension`。
fn suggested_name(raw: Option<&str>, fallback: &str, extension: &str) -> String {
    let name = raw
        .and_then(|value| Path::new(value).file_name())
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or(fallback);
    if has_extension(Path::new(name), extension) {
        name.to_owned()
    } else {
        format!("{name}.{extension}")
    }
}

fn has_extension(path: &Path, extension: &str) -> bool {
    path.extension()
        .and_then(|actual| actual.to_str())
        .is_some_and(|actual| actual.eq_ignore_ascii_case(extension))
}

/// Linux 等平台的对话框不强制补扩展名；补在末尾而不是替换用户输入。
fn ensure_extension(target: FilePath, extension: &str) -> FilePath {
    match target {
        FilePath::Path(path) if !has_extension(&path, extension) => {
            let mut name = path.into_os_string();
            name.push(".");
            name.push(extension);
            FilePath::Path(PathBuf::from(name))
        }
        other => other,
    }
}

/// 在阻塞线程里弹保存对话框并写盘：桌面写普通路径，Android 由 fs 插件经
/// ContentResolver 写 SAF 的 content:// URI。
fn save_via_dialog(
    app: &tauri::AppHandle,
    filter_name: &str,
    extension: &str,
    name: &str,
    contents: &[u8],
) -> Result<Option<String>, String> {
    let Some(target) = app
        .dialog()
        .file()
        .add_filter(filter_name, &[extension])
        .set_file_name(name)
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let target = ensure_extension(target, extension);
    let mut options = OpenOptions::new();
    options.write(true).create(true).truncate(true);
    let mut file = app
        .fs()
        .open(target.clone(), options)
        .map_err(|e| format!("打开保存目标失败：{e}"))?;
    file.write_all(contents)
        .map_err(|e| format!("写入文件失败：{e}"))?;
    Ok(Some(target.to_string()))
}

fn open_config_via_dialog(app: &tauri::AppHandle) -> Result<Option<OpenedConfigFile>, String> {
    let Some(target) = app
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    let mut options = OpenOptions::new();
    options.read(true);
    let file = app
        .fs()
        .open(target.clone(), options)
        .map_err(|e| format!("打开配置文件失败：{e}"))?;
    let contents = read_text_limited(file, CONFIG_MAX_BYTES)?;
    Ok(Some(OpenedConfigFile {
        target: target.to_string(),
        contents,
    }))
}

/// 读取 UTF-8 文本；超过 `limit` 字节直接报错，避免异常大文件占满内存。
fn read_text_limited(mut reader: impl Read, limit: u64) -> Result<String, String> {
    let mut text = String::new();
    reader
        .by_ref()
        .take(limit + 1)
        .read_to_string(&mut text)
        .map_err(|e| match e.kind() {
            std::io::ErrorKind::InvalidData => "配置文件不是有效的 UTF-8 文本".to_string(),
            _ => format!("读取配置文件失败：{e}"),
        })?;
    if text.len() as u64 > limit {
        return Err(format!("配置文件超过 {} MB", limit / (1024 * 1024)));
    }
    Ok(text)
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
            save_pdf_file,
            save_config_file,
            open_config_file
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
    fn response_round_trips_the_frontend_framing() {
        let payload = encode_response("log 日志", "\\documentclass", b"%PDF-1.7").unwrap();
        let length_at = |offset: usize| {
            u32::from_le_bytes(payload[offset..offset + 4].try_into().unwrap()) as usize
        };
        let log_len = length_at(0);
        assert_eq!(&payload[4..4 + log_len], "log 日志".as_bytes());
        let tex_offset = 4 + log_len;
        let tex_len = length_at(tex_offset);
        assert_eq!(
            &payload[tex_offset + 4..tex_offset + 4 + tex_len],
            "\\documentclass".as_bytes()
        );
        assert_eq!(&payload[tex_offset + 4 + tex_len..], b"%PDF-1.7");

        assert_eq!(
            encode_response("", "", b"").unwrap(),
            vec![0, 0, 0, 0, 0, 0, 0, 0]
        );
    }

    #[test]
    fn header_name_is_percent_decoded() {
        let mut headers = tauri::http::HeaderMap::new();
        headers.insert("name", "base6-%E6%97%A5.pdf".parse().unwrap());
        assert_eq!(
            decode_header(&headers, "name").unwrap().as_deref(),
            Some("base6-日.pdf")
        );
        assert_eq!(decode_header(&headers, "missing").unwrap(), None);
        headers.insert("name", "bad%E2%28".parse().unwrap());
        assert!(decode_header(&headers, "name").is_err());
    }

    #[test]
    fn suggested_name_keeps_extension_and_drops_directories() {
        let pdf = |raw: Option<&str>| suggested_name(raw, DEFAULT_PDF_NAME, "pdf");
        assert_eq!(pdf(None), "base6-techo.pdf");
        assert_eq!(pdf(Some("")), "base6-techo.pdf");
        assert_eq!(
            pdf(Some("base6-techo-20261111-0905.pdf")),
            "base6-techo-20261111-0905.pdf"
        );
        assert_eq!(pdf(Some("notes")), "notes.pdf");
        assert_eq!(pdf(Some("../../etc/x")), "x.pdf");

        let json = |raw: Option<&str>| suggested_name(raw, DEFAULT_CONFIG_NAME, "json");
        assert_eq!(json(None), "base6-techo-config.json");
        assert_eq!(json(Some("share")), "share.json");
        assert_eq!(json(Some("share.JSON")), "share.JSON");
    }

    #[test]
    fn chosen_target_gets_the_filter_extension_appended_but_never_replaced() {
        let name = |path: &str| ensure_extension(FilePath::Path(path.into()), "pdf").to_string();
        assert_eq!(name("/tmp/notes"), "/tmp/notes.pdf");
        assert_eq!(name("/tmp/notes.PDF"), "/tmp/notes.PDF");
        assert_eq!(name("/tmp/notes.txt"), "/tmp/notes.txt.pdf");
        assert_eq!(
            ensure_extension(FilePath::Path("/tmp/config".into()), "json").to_string(),
            "/tmp/config.json"
        );
    }

    #[test]
    fn read_text_limited_reads_utf8_and_rejects_binary_or_oversize() {
        use std::io::Cursor;

        assert_eq!(
            read_text_limited(Cursor::new("配置".as_bytes()), 9).unwrap(),
            "配置"
        );
        // 恰好等于上限仍可读；多一个字节就报错
        assert_eq!(read_text_limited(Cursor::new("abc"), 3).unwrap(), "abc");
        assert!(read_text_limited(Cursor::new("abcd"), 3).is_err());
        assert!(read_text_limited(Cursor::new([0xff, 0xfe]), 16).is_err());
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
