mod cache;
pub mod compile;
pub mod templates;

use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::Manager;

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
        let out = compile_document(&app, &tex, vec![])?;
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
    // spawn_blocking 要求 'static，把字节复制出来再移进闭包
    let bytes = bytes.to_vec();
    tauri::async_runtime::spawn_blocking(move || {
        std::fs::write(&path, bytes).map_err(|e| format!("写入文件失败：{e}"))
    })
    .await
    .map_err(|e| format!("写入任务异常终止：{e}"))?
}

fn compile_document(
    app: &tauri::AppHandle,
    source: &str,
    extra_files: Vec<(String, Vec<u8>)>,
) -> Result<compile::CompileOutput, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let job_root = data_dir.join("jobs").join(stamp.to_string());
    let result = compile::compile(source, &job_root, &extra_files);
    prune_jobs(&data_dir.join("jobs"), 5);
    result
}

/// Keep the newest `keep` job dirs around for debugging.
fn prune_jobs(jobs_dir: &Path, keep: usize) {
    let Ok(entries) = std::fs::read_dir(jobs_dir) else {
        return;
    };
    let mut dirs: Vec<_> = entries.flatten().map(|e| e.path()).collect();
    dirs.sort();
    while dirs.len() > keep {
        let oldest = dirs.remove(0);
        let _ = std::fs::remove_dir_all(oldest);
    }
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
