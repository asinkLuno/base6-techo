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

## 检查

```sh
yarn build
cargo check --workspace
```
