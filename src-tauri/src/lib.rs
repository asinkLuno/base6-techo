mod backend;

pub use backend::RunPipelineRequest;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            backend::list_system_fonts,
            backend::write_text_file,
            backend::read_text_file,
            backend::run_pipeline,
            backend::preview_document,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}

/// CLI/SDK 入口：serde 结构校验 + 语义校验通过后生成 PDF，写入 body.output。
pub fn generate_pipeline(body: backend::RunPipelineRequest) -> Result<std::path::PathBuf, String> {
    backend::generate(body, false, None).map(|(path, _)| path)
}
