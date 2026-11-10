# base6-techo

基于 **Tauri 2 + Tectonic** 的 LaTeX 编辑/编译应用，支持桌面（Linux）与 Android（arm64 真机）。

架构：Tectonic 以 Rust 依赖直接编进 Tauri 的 `libapp.so`；C/C++ 依赖（HarfBuzz、FreeType、Graphite2、ICU、fontconfig）由 vcpkg 按 `arm64-android` triplet 交叉编译。LaTeX 宏包用「离线预打包」：桌面端预热缓存 → zip 随前端资源分发 → App 首次启动解压到私有目录；缓存未命中时仍可在线补齐。

## 环境准备（一次性，全部用户空间，不需要 root）

```bash
scripts/setup-android-env.sh     # SDK 组件 / cargo-ndk / vcpkg + C 依赖（ICU、HarfBuzz 较慢）
```

要求：Rust（`aarch64-linux-android` target）、Node/yarn、JDK 17+、`~/Android/Sdk` 里有 NDK r28+（r29 已验证）。环境变量统一在 `scripts/env.sh` 里定义。

## 日常开发

```bash
# 桌面（Linux，走 vcpkg x64-linux 依赖）
scripts/make-offline-cache.sh    # 首次：编 x64-linux 依赖 + prewarm 预热离线缓存（需联网）
yarn tauri dev                   # 编辑 LaTeX → 编译 → 内嵌 PDF 预览
yarn tauri build                 # 桌面安装包

# Android（arm64-v8a 真机）
scripts/build-android.sh         # debug APK（加 --release 出 release）
adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/debug/*.apk
```

真机用无线调试（Android 11+）：开发者选项 → 无线调试 → 配对（`adb pair ip:port`）→ `adb connect ip:port`，免 root 免 udev 规则。

## 脚本一览

| 脚本                            | 作用                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `scripts/env.sh`                | 统一环境变量（ANDROID_HOME/NDK/VCPKG/ACLOCAL_PATH 等），供其他脚本 source                      |
| `scripts/setup-android-env.sh`  | 幂等安装：SDK 组件、cargo-ndk、vcpkg、gperf/autoconf-archive（用户空间）、arm64-android C 依赖 |
| `scripts/patch-tectonic.sh`     | 给 cargo registry 里的 tectonic 源码打 Android 必打补丁（见下），幂等、自校验                  |
| `scripts/make-offline-cache.sh` | 构建 `prewarm` 工具并预热离线缓存 → `public/tectonic-cache.zip`                                |
| `scripts/trim-icu-data.sh`      | 裁剪 vcpkg 静态 ICU 数据包（33 MiB → 8.9 MiB），`--restore` 还原；见「ICU 数据裁剪」           |
| `scripts/build-android.sh`      | 交叉编译 + 出 APK（自动裁剪 ICU、拷贝 NDK 的 `libc++_shared.so` 进 jniLibs）                  |

## Tectonic 的 Android 适配要点（为什么有这些补丁/配置）

- **tectonic 锁定 `=0.16.9`**（`src-tauri/Cargo.toml`），补丁与版本一一对应。
- `tectonic_bridge_core` 的 `output_close` 对同一输出二次 close 会 `unwrap()` panic，panic 穿过 `extern "C"` 边界直接 abort——补丁 (2/2) 修复。`tectonic_engine_xetex` 的 `print_glyph_name` Scudo 崩溃已被上游 0.5.3 修复，补丁 (1/2) 仅对旧版本生效。
- 编译全程 `catch_unwind` 包裹（`src-tauri/src/compile.rs`），panic 转成错误信息回传前端。
- 缓存/HOME 用环境变量钉到 App 私有目录（`TECTONIC_CACHE_DIR` 等），避免 Android 上找不到可写目录。
- ICU/HarfBuzz 是 C++：`build.rs` 为 android target 链接 `-lc++_shared`，并把 NDK 的 `libc++_shared.so` 拷进 jniLibs。
- NDK r28+ 交付 16 KB page size 对齐（Google Play 2025-11 起强制）；vcpkg 用同一个 NDK 编译。

## ICU 数据裁剪

Android 上 ICU 是静态链接进 `.so` 的，而 ICU 完整数据包（`libicudata.a` / `icudt79l.dat`）约 **33 MiB**，装的是所有语言环境、排序规则、时区、RBNF、转写、单位、编码转换器和断行规则——本应用的编译链路只用到其中很小一部分。`scripts/trim-icu-data.sh` 用 vcpkg 自带的 `icupkg` 删条目、`genccode` 重新生成汇编，把归档裁到约 **8.9 MiB**（4321 → 238 项）。

保留集：

- `brkitr/*`：断行规则与词典（含中文 `cjdict`、泰语词典），XeTeX 的 `\XeTeXlinebreaklocale` 依赖；
- `*.cnv` + `cnvalias.icu`：`\XeTeXinputencoding` 的编码转换器（GBK、Big5、Shift_JIS 等）；
- `root/en/en_US/en_US_POSIX/zh/zh_Hant` 语言资源及 `res_index`、`pool`、`supplementalData`；
- `uemoji.icu`、`ulayout.icu`。

Unicode 属性、大小写映射、NFC 归一化、bidi 在 ICU 79 里编译进 `libicuuc`，不在数据包中，因此不受影响。需要其他 `\selectlanguage` / 断行 locale 时，把对应 `*.res` 加进脚本的 keep 列表即可。

注意两点：

- **桌面 Linux 包体不会因此变小**：桌面动态链接系统 ICU，`.deb` 里本来就不含 ICU 数据。脚本同时裁剪 `x64-linux` 的 vcpkg 归档，是为了预热缓存、测试以及将来可能的静态桌面构建走的同一条依赖链。
- 脚本幂等（按大小判断是否已裁剪），原归档备份为 `libicudata.a.orig`，`scripts/trim-icu-data.sh --restore` 可还原。首次运行前需已 `vcpkg install icu:<triplet>`（宿主工具在 `$VCPKG_ROOT/buildtrees/icu/x64-linux-rel/bin`）。`scripts/build-android.sh` 会在链接前自动调用它。

### 裁剪后怎么构建

```bash
scripts/setup-android-env.sh          # 只在新环境/重装 vcpkg 依赖后需要
scripts/build-android.sh --release    # 自动裁剪 + 自动重链 + 出 APK
```

日常只需要最后一条。关键点是**裁剪换掉 `libicudata.a` 后必须重新链接**：cargo 不跟踪 vcpkg 的静态归档，只改归档不会让 `libbase6_techo_lib.so` 失效，增量构建会悄悄沿用旧的全量 ICU。`build-android.sh` 通过裁剪脚本输出的 `ICU_DATA_TRIMMED=1` 标记检测到归档被替换，并自动执行 `cargo clean -p base6-techo --release --target aarch64-linux-android` 强制重链；归档已经是裁剪版时则什么都不做，保持增量构建。

如果绕过脚本直接 `yarn tauri android build` 或 `cargo build --target aarch64-linux-android`，需要自己清一次对应的包（或 `cargo clean`）才能拿到裁剪后的体积。`vcpkg upgrade` / 重装 ICU 会恢复全量数据，下次跑 `build-android.sh` 会重新裁剪并重链。

## 常见问题

- **改了 Rust 代码后 Android 构建很慢**：交叉编译无热更，`tauri android dev` 会重编整条链路；UI 改动有 Vite HMR。
- **离线编译失败**：确认 `public/tectonic-cache.zip` 存在且 App 是重新构建过的（缓存内嵌在前端资源里）；首次启动会解压，日志可见 `offline cache installed`。
- **vcpkg 依赖搬家后报 `-lbz2` 找不到**：删 `src-tauri/target/*/build/tectonic_*` 强制重跑 build script。
- **gen/android**：是生成后需要手工维护的 Android 工程本体，**要进 git**；如果 `tauri android init` 报 identifier 不匹配，删掉 `src-tauri/gen/android` 重新 init（自制的 jniLibs 由 `build-android.sh` 重新拷入）。

## LaTeX 排版框架

后端整本编排、布局与模板扩展说明见 [LaTeX 框架](docs/latex-framework.md)，实施与验证记录见 [工作日志](docs/latex-framework-worklog.md)。
