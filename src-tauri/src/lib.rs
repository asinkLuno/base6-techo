mod cache;
pub mod compile;

use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::Manager;

/// Compile a LaTeX document and return a raw IPC payload:
/// `[u32 log_len LE][log utf8][pdf bytes]` — avoids JSON-encoding the PDF.
#[tauri::command]
async fn compile_tex(
    app: tauri::AppHandle,
    source: String,
    extra_files: Option<Vec<ExtraFile>>,
) -> Result<tauri::ipc::Response, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let out = compile_document(&app, &source, extra_files.unwrap_or_default())?;
        let log = out.log.into_bytes();
        let mut payload = Vec::with_capacity(4 + log.len() + out.pdf.len());
        payload.extend_from_slice(&(log.len() as u32).to_le_bytes());
        payload.extend_from_slice(&log);
        payload.extend_from_slice(&out.pdf);
        Ok(tauri::ipc::Response::new(payload))
    })
    .await
    .map_err(|e| format!("编译任务异常终止：{e}"))?
}

#[derive(serde::Deserialize)]
struct ExtraFile {
    name: String,
    content: Vec<u8>,
}

fn compile_document(
    app: &tauri::AppHandle,
    source: &str,
    extra_files: Vec<ExtraFile>,
) -> Result<compile::CompileOutput, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let job_root = data_dir.join("jobs").join(stamp.to_string());
    let extras: Vec<(String, Vec<u8>)> =
        extra_files.into_iter().map(|f| (f.name, f.content)).collect();
    let result = compile::compile(source, &job_root, &extras);
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
        .invoke_handler(tauri::generate_handler![compile_tex])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
