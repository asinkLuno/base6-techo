fn main() {
    let target = std::env::var("TARGET").unwrap_or_default();
    if target.contains("android") {
        // HarfBuzz/ICU (vcpkg, C++) are linked into libapp.so — pull in the
        // NDK's C++ runtime. Done here rather than .cargo/config.toml because
        // tauri can override the latter's rustflags.
        println!("cargo:rustc-link-arg=-lc++_shared");
    } else {
        // tectonic 静态链接了自己的 HarfBuzz 8.3，而 GTK/Pango 走 dlopen 加载系统的
        // libharfbuzz 15。可执行文件默认会把静态库符号导出为动态符号，于是系统
        // HarfBuzz 会把自己的 `hb_font_create` / `hb_face_create` 解析到这份 8.3
        // （`LD_DEBUG=bindings` 可见：`binding file /usr/lib/libharfbuzz.so.0 to
        // base6-techo: normal symbol hb_font_create`）。两套 ABI 混用后，字体布局
        // 一跑就 SIGSEGV，栈里停在 `hb_table_lazy_loader_t<OT::head>::create`。
        // 隐藏静态库符号即可让系统 HarfBuzz 只跟自己绑定。
        println!("cargo:rustc-link-arg=-Wl,--exclude-libs,ALL");
    }
    tauri_build::build()
}
