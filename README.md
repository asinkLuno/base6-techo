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

`showcase/` 是 Astro + React Islands 的静态展示页：介绍、画廊、下载三合一，静态输出到 `showcase/dist/`。

```sh
# 1. 生成样张（PDF + 对页 PNG）到 examples/
./scripts/gen-examples.py

# 2. 多阶段构建：Dockerfile 内先 Astro 构建，再以 nginx 服务（dist/ 打进镜像）
docker compose -f showcase/compose.yaml up -d --build
# 打开 http://localhost:8080/showcase/
```

站点用 Astro（`src/pages/` + `src/components/`），交互区块（尺寸切换、仿手写动画的 `Gallery.tsx`）为 React Islands。字体子集在 `showcase/public/fonts/`（`public/` 随构建复制到 `dist/fonts/`）。

## 检查

```sh
yarn build
cargo check --workspace
```
