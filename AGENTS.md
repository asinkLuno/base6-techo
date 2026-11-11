# AGENTS.md

## 前端组件规范（强制）

适用范围：`src/` 下所有前端代码。违反此节的实现一律返工。

1. **所有组件用 daisyUI，不用原生、不手写。**
   - 交互与视觉组件一律用 daisyUI 组件类（`btn`、`card`、`input`、`modal`、`tabs`……），配合 Tailwind utility 布局。
   - 禁止裸写样式复刻组件效果（如手搓按钮/弹窗/下拉），禁止用无样式的原生控件凑合。
   - HTML 语义结构（`section`、`nav`、`form` 等）照常写，但外观与交互行为交给 daisyUI 类。
   - 注意 daisyUI 5 的类名变更：`form-control`/`input-bordered` 已移除，表单用 `fieldset`/`fieldset-legend`，输入框默认带边框；写之前可 grep `node_modules/daisyui/daisyui.css` 确认类名存在。

2. **适当加动效，提升体验。**
   - 优先用现成的：daisyUI 自带过渡、Tailwind 的 `transition-*` / `animate-*` / `duration-*`。
   - 复杂声明式动画（时间线、手势、布局动画）需要时用 yarn 添加 Motion（`yarn add motion`），不要手写 CSS keyframes 长链。
   - "适当" = 服务于可用性（反馈、状态变化、层级过渡），不做纯装饰的大动作。

3. **daisyUI 达不到用户要的效果时，先和用户商量。**
   - 列出可行方案（daisyUI 变通 / 引入无头库如 Radix 或 Ark UI / 其他完整库）及取舍，等用户选定再动手。
   - 不要擅自绕开规范手写实现。

4. **组件一律走 yarn 依赖，禁止手工拷贝。**
   - 新增组件库、动画库、图标库等：`yarn add <pkg>`（或 `yarn add -D`）。
   - 禁止从网页/示例项目复制组件源码进仓库（shadcn 式拷贝也不行）。
   - 本项目 UI 库已定 daisyUI，不要再引入第二套视觉组件库；确有需求走规则 3 与用户商量。

## 技术栈速览（勿重复决策）

- React 19 + TypeScript + Vite；Tauri 2 桌面/Android 应用。
- 路由：react-router v8，hash 路由（`createHashRouter`），功能页 `lazy` 分包。
- 状态：zustand（persist 存用户偏好，key: `base6-techo:settings`，带 version + migrate）。
- i18n：react-i18next，词条在 `src/i18n/locales/{zh-CN,en}.json`，两份必须同步改；t() 的 key 有类型检查。
- 样式：Tailwind CSS v4 + daisyUI 5（`src/index.css` 里 `@plugin "daisyui"`；主题列表须与 `src/stores/settings.ts` 的 `ThemeName` 及 `index.html` 首帧脚本白名单三处一致）。
- 主题：仅 light/dark，切换入口在导航栏；设置页只有语言。
- Lint/格式化：Biome（配置 `biome.json`；`yarn lint` 检查、`yarn lint:fix` 自动修、`yarn format` 只格式化；Tailwind 类名排序读 `src/index.css`）。
- 包管理器：yarn（lockfile v1）。

## Rust 质量检查（强制）

- 提交前跑 `yarn verify`：Biome + `tsc --noEmit` + `cargo fmt --check` + `cargo clippy --all-targets -- -D warnings`，四条全绿才算完。
- Rust 测试：`yarn test:rust`（等价 `cargo test --manifest-path src-tauri/Cargo.toml`）；只跑单测用 `cargo test --lib`。
- 规则唯一来源：clippy 在 `src-tauri/Cargo.toml` 的 `[lints]`，格式化在 `src-tauri/rustfmt.toml`，工具链在仓库根 `rust-toolchain.toml`。
- 源码里只设 `warn`，不写 `#![deny(warnings)]`；`-D warnings` 只出现在 `yarn verify`（及将来的 CI）。
- 确需豁免单条 lint 时就地 `#[allow(clippy::xxx)]` 并写明理由（参考 `templates/latex.rs` 的 `too_many_arguments`），不要加全局阈值、不要新建 `clippy.toml`。

## impeccable 设计技能（已集成）

- 已安装 pbakaus/impeccable：技能在 `.agents/skills/impeccable/`，子代理定义在 `.zcode/agents/`。新会话用 `/impeccable <命令>` 传参调用（`init`、`document`、`critique`、`audit`、`polish` 等）；首次使用先 `/impeccable init` 生成 PRODUCT.md。
- 设计检测 hook 在 `.zcode/config.json` 已启用（SessionStart / PostToolUse(Edit|Write) / Stop）：每次编辑 UI 文件后检测器返回 `additionalContext` 结论，Stop 时全规则深检；有发现就处理或明确说明豁免理由，不要默默忽略。
- **优先级：impeccable 的样式主张让位于上面的 daisyUI 规则。** 它若建议定制字体、手写组件、引入第二套视觉方案，一律按「前端组件规范」执行；确需绕开 daisyUI 走规则 3。
- 检测误报用 `npx impeccable ignores add-value <规则> <值> --reason "..."` 豁免（写入 `.impeccable/`，随仓库提交）；全量检测要跑在真实页面上：`npx impeccable detect http://localhost:PORT`（仅扫源码是正则子集）。
- 更新：`npx impeccable update`。遥测已在 `.impeccable/config.json` 关闭；`.gitignore` 已含 impeccable 瞬态文件块（`# impeccable-ignore-start/end`）。
