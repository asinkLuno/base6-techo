# base6-techo 产品主页

产品介绍单页（React + TypeScript + Vite），与 `../` 下的 Tauri 应用相互独立，
拥有自己的 `package.json` 和 `yarn.lock`（独立项目，不是 workspace 成员）。

## 开发

```sh
yarn install
yarn dev      # 本地开发，默认 http://localhost:5173
yarn build    # 类型检查 + 产物输出到 dist/
yarn preview  # 预览构建产物
```

## 结构

- `src/App.tsx` — 页面全部内容：hero、规格表（主打整本拼版 + LaTeX/Tectonic 输出）、版式画廊、示例 PDF、下载。
- `src/index.css` — 全部样式；「印刷工房」方向：切割垫底色 + 毫米标尺栏，纸面/线色取自应用默认值（`src-tauri/src/backend/colors.rs`），页边线红只作细线使用。
- `public/examples/` — 由 base6-techo 生成的示例 PDF（复制自 `../examples/`），「示例」区块直接链接。
- `public/examples/patterns/` — 16 种版式各一份样张 PDF，由 `../examples/patterns/*.json`
  经 `target/debug/techo-pipeline` 实际生成（改参数后重跑 JSON 即可再生成）。
  样张统一 0xProto 字体（`../examples/fonts/0xProtoNerdFont-Regular.ttf`）+ 装订侧
  base6 水印；當用日記 / 懷中日記两款的旧历、六耀注记需要 CJK 字体，改用京華老宋体。
- `public/img/patterns/` — 上述样张 PDF 首页经 pdftoppm 转出的 PNG，即版式卡片配图；
  重新生成样张后同样重跑一次即可同步。
- `public/img/` — 博文館日记复刻版式的渲染样张（复制自仓库根目录）。

版式卡片的小预览图是纯 CSS 背景渐变画的，未依赖图片；如需替换为真实渲染图，
给对应 `Pattern` 加 `img` 字段即可（参考复刻系列）。

下载区直接链接 GitHub Releases 的最新产物（`releases/latest/download/<文件名>`）。
资产文件名里带版本号，所以发新版本时要把 `src/App.tsx` 里的 `APP_VERSION` 一并更新。

部署：`yarn build` 后把 `dist/` 静态托管即可（已设 `base: './'`，可放在任意路径）。
