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
    finish_bootstrap(cache_base, read_cache_zip(app).as_deref())
}

fn finish_bootstrap(cache_base: PathBuf, cache_zip: Option<&[u8]>) -> Result<PathBuf, String> {
    if stamp_matches(&cache_base) {
        return Ok(cache_base);
    }
    install_cache(cache_base, cache_zip)
}

/// 缓存包随 App 版本更新：戳里的版本不一致时必须重新解包，否则升级后
/// 离线设备拿到的仍是旧 bundle。
fn stamp_matches(cache_base: &Path) -> bool {
    fs::read_to_string(cache_base.join(STAMP_FILE))
        .is_ok_and(|stamp| stamp.trim() == env!("CARGO_PKG_VERSION"))
}

fn install_cache(cache_base: PathBuf, cache_zip: Option<&[u8]>) -> Result<PathBuf, String> {
    match cache_zip {
        Some(bytes) => {
            unpack_zip(bytes, &cache_base)?;
            fs::write(cache_base.join(STAMP_FILE), env!("CARGO_PKG_VERSION"))
                .map_err(|e| e.to_string())?;
            println!(
                "[base6-techo] offline cache installed at {}",
                cache_base.display()
            );
        }
        None => {
            // No bundled cache (e.g. desktop dev before running the prewarm
            // script): start empty; the engine will fetch from the network.
            for dir in ["bundles", "formats"] {
                fs::create_dir_all(cache_base.join(dir)).map_err(|e| e.to_string())?;
            }
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
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").ok()?;
    read_dev_cache(Path::new(&manifest_dir).parent()?)
}

fn read_dev_cache(project_root: &Path) -> Option<Vec<u8>> {
    ["dist", "public"]
        .into_iter()
        .find_map(|rel| fs::read(project_root.join(rel).join(CACHE_ASSET)).ok())
}

fn unpack_zip(bytes: &[u8], dest: &Path) -> Result<(), String> {
    zip::ZipArchive::new(Cursor::new(bytes))
        .map_err(|e| format!("缓存包无法打开：{e}"))?
        .extract(dest)
        .map_err(|e| format!("缓存包解压失败：{e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    fn temp_dir(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("base6-cache-{name}-{}", std::process::id()))
    }

    fn zip_with(entries: &[(&str, &[u8])]) -> Vec<u8> {
        let mut writer = zip::ZipWriter::new(Cursor::new(Vec::new()));
        let options = SimpleFileOptions::default();
        for (name, data) in entries {
            writer.start_file(*name, options).unwrap();
            writer.write_all(data).unwrap();
        }
        writer.finish().unwrap().into_inner()
    }

    #[test]
    fn unpack_zip_restores_nested_files() {
        let dest = temp_dir("nested");
        let bytes = zip_with(&[("bundles/a/b.txt", b"hello"), ("formats/c.bin", b"bin")]);

        unpack_zip(&bytes, &dest).unwrap();

        assert_eq!(fs::read(dest.join("bundles/a/b.txt")).unwrap(), b"hello");
        assert_eq!(fs::read(dest.join("formats/c.bin")).unwrap(), b"bin");
        let _ = fs::remove_dir_all(&dest);
    }

    #[test]
    fn unpack_zip_rejects_broken_archive() {
        let dest = temp_dir("broken");
        assert!(unpack_zip(b"not a zip", &dest).is_err());
        let _ = fs::remove_dir_all(&dest);
    }

    #[test]
    fn read_dev_cache_prefers_dist_then_public() {
        let root = temp_dir("dev-cache");
        fs::create_dir_all(root.join("public")).unwrap();
        fs::write(root.join("public").join(CACHE_ASSET), b"public").unwrap();
        assert_eq!(read_dev_cache(&root).unwrap(), b"public");

        fs::create_dir_all(root.join("dist")).unwrap();
        fs::write(root.join("dist").join(CACHE_ASSET), b"dist").unwrap();
        assert_eq!(read_dev_cache(&root).unwrap(), b"dist");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn read_dev_cache_returns_none_without_asset() {
        let root = temp_dir("dev-cache-missing");
        fs::create_dir_all(&root).unwrap();
        assert!(read_dev_cache(&root).is_none());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn finish_bootstrap_keeps_existing_cache_untouched() {
        let base = temp_dir("stamped");
        fs::create_dir_all(&base).unwrap();
        fs::write(base.join(STAMP_FILE), env!("CARGO_PKG_VERSION")).unwrap();

        // 版本一致时不应再看缓存包内容（这里传的是坏 zip）。
        finish_bootstrap(base.clone(), Some(b"not a zip")).unwrap();

        assert_eq!(
            fs::read_to_string(base.join(STAMP_FILE)).unwrap(),
            env!("CARGO_PKG_VERSION")
        );
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn finish_bootstrap_reinstalls_when_stamp_version_changes() {
        let base = temp_dir("stale-version");
        fs::create_dir_all(&base).unwrap();
        fs::write(base.join(STAMP_FILE), "0.0.0").unwrap();
        let bytes = zip_with(&[("bundles/new.txt", b"new")]);

        finish_bootstrap(base.clone(), Some(&bytes)).unwrap();

        assert_eq!(fs::read(base.join("bundles/new.txt")).unwrap(), b"new");
        assert_eq!(
            fs::read_to_string(base.join(STAMP_FILE)).unwrap(),
            env!("CARGO_PKG_VERSION")
        );
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn install_cache_unpacks_bundled_zip_and_stamps_it() {
        let base = temp_dir("install-zip");
        let bytes = zip_with(&[("bundles/x.txt", b"x")]);

        install_cache(base.clone(), Some(&bytes)).unwrap();

        assert_eq!(fs::read(base.join("bundles/x.txt")).unwrap(), b"x");
        assert_eq!(
            fs::read_to_string(base.join(STAMP_FILE)).unwrap(),
            env!("CARGO_PKG_VERSION")
        );
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn install_cache_without_bundle_creates_empty_dirs() {
        let base = temp_dir("install-empty");

        install_cache(base.clone(), None).unwrap();

        assert!(base.join("bundles").is_dir());
        assert!(base.join("formats").is_dir());
        assert!(!base.join(STAMP_FILE).exists());
        let _ = fs::remove_dir_all(&base);
    }
}
