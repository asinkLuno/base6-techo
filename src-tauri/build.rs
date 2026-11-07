fn main() {
    let target = std::env::var("TARGET").unwrap_or_default();
    if target.contains("android") {
        // HarfBuzz/ICU (vcpkg, C++) are linked into libapp.so — pull in the
        // NDK's C++ runtime. Done here rather than .cargo/config.toml because
        // tauri can override the latter's rustflags.
        println!("cargo:rustc-link-arg=-lc++_shared");
    }
    tauri_build::build()
}
