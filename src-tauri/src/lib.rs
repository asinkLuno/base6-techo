mod backend;

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
