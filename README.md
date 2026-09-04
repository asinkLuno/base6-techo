# base6-techo

Tauri 桌面应用，前端使用 Yarn、TypeScript、React 和 Vite。

排版、拼版和 PDF 生成由 `src-tauri/src/backend.rs` 中的原生 Tauri commands 提供。

## ICS 日历导入

在设置页面底部可以导入 ICS 格式的日历文件，自动提取节假日信息并以红色标记在所有日历视图中。

中国法定节假日可直接使用：

```
https://github.com/NateScarlet/holiday-cn
```

该仓库提供每年的 ICS 文件（如 `2026.ics`），包含节假日和调休安排。

```sh
yarn install
yarn tauri dev
```

## 版式样张展示页

`showcase/index.html` 是介绍、画廊、下载三合一的静态展示页，由脚本扫描 `examples/` 生成，
零运行时依赖、单文件输出：

```sh
# 1. 生成样张（PDF + 对页 PNG）
./scripts/gen-examples.sh

# 2. 生成展示页
node scripts/gen-showcase.mjs

# 3. 本地预览：从仓库根目录起服务（页面以 ../examples/ 相对路径引用样张）
python3 -m http.server 8000
# 打开 http://127.0.0.1:8000/showcase/
```

标题字体为仓库根目录京華老宋体的 web 子集（`showcase/fonts/kinghwa-subset.woff2`，
33 MB → 约 291 KB），重新子集化的步骤见 `scripts/gen-showcase.mjs` 头部注释。

## 检查

```sh
yarn build
cargo check --workspace
```
