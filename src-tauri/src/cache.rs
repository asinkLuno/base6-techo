//! First-run bootstrap of the prewarmed offline bundle cache.
//!
//! `scripts/make-offline-cache.sh` warms a tectonic cache on the desktop
//! against the official online bundle and zips it into `public/tectonic-cache.zip`.
//! Vite copies that into `dist/`, Tauri embeds the whole frontend dist into the
//! app binary, so `AssetResolver::get("tectonic-cache.zip")` works identically
//! on desktop and Android. On first launch we unpack it into the app-private
//! cache dir; the cache is content-addressed and portable across devices/ABIs.

use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

use tauri::Manager;

const CACHE_ASSET: &str = "tectonic-cache.zip";
const STAMP_FILE: &str = ".prewarm-ok";

/// Returns the directory that must be exported as `TECTONIC_CACHE_DIR`
/// (base dir containing `bundles/` and `formats/`).
pub fn bootstrap(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let cache_base = tectonic_cache_dir(app)?;
    if cache_base.join(STAMP_FILE).exists() {
        return Ok(cache_base);
    }
    match read_cache_zip(app) {
        Some(bytes) => {
            unpack_zip(&bytes, &cache_base)?;
            fs::write(cache_base.join(STAMP_FILE), env!("CARGO_PKG_VERSION"))
                .map_err(|e| e.to_string())?;
            println!("[base6-techo] offline cache installed at {}", cache_base.display());
        }
        None => {
            // No bundled cache (e.g. desktop dev before running the prewarm
            // script): start empty; the engine will fetch from the network.
            fs::create_dir_all(cache_base.join("bundles")).map_err(|e| e.to_string())?;
            fs::create_dir_all(cache_base.join("formats")).map_err(|e| e.to_string())?;
            println!("[base6-techo] no bundled cache; starting empty");
        }
    }
    Ok(cache_base)
}

fn tectonic_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    // app_cache_dir is app-private and writable without any permission on
    // Android; on desktop it maps to ~/.cache/<identifier>.
    let base = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    Ok(base.join("tectonic"))
}

fn read_cache_zip(app: &tauri::AppHandle) -> Option<Vec<u8>> {
    // Embedded frontend asset — same key on desktop and Android.
    if let Some(item) = app.asset_resolver().get(CACHE_ASSET.to_string()) {
        return Some(item.bytes);
    }
    // Fallbacks for dev builds: the vite dist/ and public/ dirs.
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let project_root = Path::new(&manifest_dir).parent().map(Path::to_path_buf);
        for rel in ["dist", "public"] {
            if let Some(root) = &project_root {
                if let Ok(bytes) = fs::read(root.join(rel).join(CACHE_ASSET)) {
                    return Some(bytes);
                }
            }
        }
    }
    None
}

fn unpack_zip(bytes: &[u8], dest: &Path) -> Result<(), String> {
    let mut archive =
        zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| format!("缓存包无法打开：{e}"))?;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| format!("缓存包损坏：{e}"))?;
        let rel = entry.mangled_name();
        let out_path = dest.join(&rel);
        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut out = fs::File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
