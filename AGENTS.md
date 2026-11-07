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
- 包管理器：yarn（lockfile v1）。
