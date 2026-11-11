# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

主要用户是手帐（手帳）爱好者：想自己定制笔记本内页、打印后装订成册的人。他们不需要会写 LaTeX——通过图形界面组合版式，产品负责产出印刷级 PDF。已确认计划公开发布给其他手帐爱好者使用（开发者本人是第一用户）。

## Product Purpose

base6-techo 让用户在本地设计并生成可直接打印装订的手帐/笔记本 PDF：

- 以「section（版式组合）」为单位组合全书：每节指定页数、是否计入页码、页心模板（空白页、横线页、点阵页、网格页、方眼罫、八分周视图、月历、月打卡）；横线可调行距/线色/线宽，并可加贯穿整页的左侧竖线（美式横线本），点阵可调行距/列距/点半径/点色/中心点色。
- 页面设置：纸张（A4/A5/B5/A6/B6/Letter/自定义 30–1000mm）、装订边（左/右）、四周留白（页头/页脚/装订侧/外侧）。
- 装订方式（拼版）：单页（按阅读顺序）、骑马订（整本一帖、尾部补齐到 4 的倍数）、锁线分帖（每帖纸张数可调，末帖自动补白）。
- 内嵌 Tectonic 引擎（编译进 App 本体）本地生成 LaTeX/TikZ 并输出 PDF，内嵌预览（pdf.js），全程离线；浏览器纯网页形态可看界面但无引擎，生成会提示需桌面应用。

成功 = 用户不写一行 LaTeX，就能拿到毫米级精确、印刷页序已按装订方式排好、双面打印后直接可装订成册的 PDF。

## Positioning

「内嵌 LaTeX 引擎的离线手帐 PDF 生成器」：Tectonic 直接编译进 Tauri 应用（含 Android arm64 真机），宏包离线预打包随资源分发，无服务端、无账户、无网络依赖；同时输出面向真实装订工艺的拼版结果（骑马订/锁线、纸张正反面配页、补白），毫米级坐标。在线模板站与通用 PDF 工具既不能离线内置 LaTeX 引擎，也不产出按帖配页的装订-ready 输出。

## Operating Context

- 桌面 Linux（开发与日常使用，`yarn tauri dev`）与 Android arm64 真机（无线 adb、debug/release APK）。
- 打印语境：原尺寸、每张纸 1 个 PDF 页面、双面打印；骑马订用短边翻转，自定义纵向输出用长边翻转；保留空白面，不启用打印驱动的小册子配页。
- 装订语境：骑马订沿中缝对折；锁线按帖叠放锁线装订；拼版输出的纸面宽是成品两倍，不缩放不旋转。
- 宏包缓存：桌面端预热 → zip 随前端资源分发 → App 首启解压到私有目录；未命中仍可在线补齐。

## Capabilities and Constraints

已确认能力：

- section 列表：增删、拖拽排序、重命名（自定义名称仅用于编辑列表，留空显示「Section N」，不进入 PDF）、逐节配置页数/计页码/模板，以及本节边距与页头/页脚/水印；全书页数 1–999，超出有溢出提示。
- 页心模板：`blank`、`linear`（兼容别名 `lined`，可选美式横线本左侧竖线）、`dots`、`grid`、`hogen`（方眼罫）、`octanWeek`（八分周视图）、`month`（月历）、`tracker`（月打卡）；横线与方格间距 0.1–1000mm、线宽 0.01–10pt、线色 `#RRGGBB`；左侧竖线距纸张左缘 0–1000mm、线宽 0.01–10pt，贯穿整页高度且不受页头/页脚区域限制；点阵行距/列距 0.1–1000mm、点半径 0.01–10mm、点色与中心点色 `#RRGGBB`。方格与横线、点阵一致，从页心中心向四周等距扩展，最外侧格线封闭成边框。`hogen` 复刻 Midori 方眼罫：5mm 格距、横线下 1mm 断口、隔线外伸 1.2mm、0.7pt 线宽与每 10 格页缘标记点固定，只开放线色；格线同样从页心中心向四周扩展。
- 页头/页脚与水印：全书默认一份，每个 section 可逐项覆盖或继承；未修改的项实时跟随全书。内容（空白/文字/年月线）、页码开关、对齐（居中/装订侧/外侧）、字号、颜色、装订侧/外侧水印均已接入界面。四周边距同样支持全书默认与逐项按节覆盖。
- 拼版：`none` / `booklet` / `thread`（sheetsPerSignature 1–250）；补白页完全空白、不消耗显示页码。
- UI：简体中文（默认）/ English 双语，两份词条必须同步维护；主题仅 light/dark。

技术约束（以 AGENTS.md 为准）：

- 前端组件一律 daisyUI 5 + Tailwind v4，禁止手搓组件或引入第二套视觉库；动效优先 daisyUI/Tailwind，复杂动效用 yarn 添加 motion。
- React 19 + TypeScript + Vite；react-router v8 hash 路由，功能页 lazy 分包；zustand persist（key `base6-techo:settings`）；包管理 yarn；Biome 做 lint/format。
- Rust 后端：`generate_document_pdf(&Document)` 纯函数生成 LaTeX，Tectonic 编译；serde `deny_unknown_fields`，非法值前端入口 clamp 修正。
- 框架当前不自动换行、缩字或扩展区域，组件超长文字被裁剪；全书共享纸张与装订方向，边距与装饰可按节覆盖。
- 用户文字按普通文本转义，不接受 LaTeX 代码。

明确未决：

- 当前主线是「更多页心模板 + 界面与体验打磨」（已确认）。
- 公开发布渠道与形式（GitHub 发布、APK 直装、应用商店等）未定。

## Brand Commitments

- 名称：base6-techo（techo = 手帳/手帐）；应用名、仓库名、持久化 key 均用此名。
- 「我的手帐」「base6」是文档与示例中的惯用示例文案，不是品牌 slogan。
- 无 logo/字体/色彩等额外视觉承诺；现有视觉体系后续由 DESIGN.md 记录。

## Evidence on Hand

- `docs/latex-framework.md`：后端框架、IPC 协议、拼版规则的完整说明；`docs/latex-framework-worklog.md`：实施与验证记录。
- `build/`（本地构建产物）：framework-sample.pdf、booklet-sample.pdf 等真实编译样例；`scripts/check-framework-sample.py`、`scripts/check-imposition-samples.py` 可核对实际 PDF。
- `src-tauri/icons/`：现有应用图标。
- 无用户证言、截图素材、营销文案；发布相关材料不可杜撰。

## Product Principles

1. 打印即所得：毫米级精确，PDF 所见即最终印刷面，不依赖用户二次调整。
2. 完全离线：引擎、宏包、生成全部在本地完成，无服务端、无账户、无网络依赖（宏包缓存补齐除外）。
3. 装订优先：输出直接服务真实装订工艺（配页、正反面、补白），不把半成品留给用户手工重排。
4. 严格校验：非法输入一律拒绝或在入口钳制，绝不产出含糊结果；前端类型与 Rust schema 严格对齐。
5. 简单可扩展：页心模板体系留有明确扩展点，新增模板不动核心页序与拼版逻辑。
