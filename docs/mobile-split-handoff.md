# 移动端前端拆分 Handoff（方案 A）

> 状态：**已决策，暂缓执行**——等桌面功能稳定后再拆。
> 决策时间：2026-11-07。重启时按「实施步骤」顺序执行即可，无需回溯本次讨论。

## 决策记录

- 需求：移动端与桌面端 UI 分开做，业务核心（stores / lib / i18n / types）共享。
- Tauri 2 无原生「多前端」概念：一个工程 = 一个 src-tauri + 一个 frontendDist。但有官方机制可拆，方案对比：

| 方案 | 形态                                                                        | 结论                                                      |
| ---- | --------------------------------------------------------------------------- | --------------------------------------------------------- |
| A    | 一个 Tauri 工程 + 平台配置文件（`tauri.android.conf.json`）+ 双前端构建     | ✅ 选定                                                   |
| B    | monorepo 两个独立 Tauri 应用（yarn workspaces，各自 src-tauri / bundle id） | 两端差异大到不像一个产品、或需独立 bundle id 上架时再升级 |
| C    | 单前端运行时分叉（platform() 选路由树）                                     | 不符合「分开做」意图，两端代码共存于同一产物              |

- 方案 A 的关键机制（均为官方行为）：
  - Tauri CLI 跑 `tauri android dev/build` 时自动合并 `tauri.android.conf.json`（linux/macos/windows/ios 同理），可覆盖 `build` 段的 devUrl / frontendDist / before*Command。
  - `import.meta.env.VITE_APP_TARGET` 在 `vite build` 时被静态替换为字面量，esbuild 折叠常量分支后另一端的动态 import 不进产物 → **两端产物互斥**（dev 模式不做 DCE，运行时选择即可）。
  - 选单入口分发而非双 HTML 多页构建：多页会把两端代码打进同一个 dist，APK 里会带上桌面代码。
- 暂缓原因：桌面功能未稳定，目录搬迁的 diff 噪音会干扰当前迭代。

## 重启条件

- 桌面端核心功能（编辑器 / PDF 预览与生成 / 页面设置）进入稳定期，近期无大改页面结构的计划。

## 基线快照（2026-11-07，动手前先核对是否漂移）

- dev 端口 1420 / HMR 1421；`vite.config.ts` 已支持 `TAURI_DEV_HOST`；`server.strictPort: true`。
- 单入口：`index.html` → `/src/main.tsx` → `src/router.tsx`（`createHashRouter`，hash 路由对移动 webview 兼容）→ `src/layouts/RootLayout` + `src/pages/{HomePage,SettingsPage,NotFoundPage}`。
- 组件归属（已核对实际 import，2026-11-07）：

| 文件                                              | 现引用方                           | 拆分去向                                                                                           |
| ------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `PageSettingsPanel` `SectionListItem` `PdfViewer` | 仅 `HomePage`（PdfViewer 为 lazy） | `desktop/components/`                                                                              |
| `NumberField`                                     | 仅被前两者内部引用                 | 随桌面进 `desktop/components/`；它是通用数字输入件，移动端页面用到时再上提共享区 `src/components/` |
| `hooks/useSettingsSync`                           | `RootLayout`                       | 留在共享区 `src/hooks/`（移动布局同样要做主题/语言同步）                                           |

- `stores/` `lib/`（含 generatePdf）`i18n/` `types/` `index.css` 全部共享，**零改动**；vitest 测试路径不变。

## 实施步骤

### 1. 目录调整（git mv 保留历史）

```
src/
  main.tsx                  改：3 行分发器（见步骤 2）
  entries/
    desktop.tsx             新：原 main.tsx 内容，挂桌面 router
    mobile.tsx              新：挂移动 router
  desktop/
    router.tsx              ← git mv src/router.tsx
    layouts/RootLayout.tsx  ← git mv src/layouts/RootLayout.tsx（layouts/ 清空后删）
    pages/{HomePage,SettingsPage,NotFoundPage}.tsx  ← git mv src/pages/*
    components/{PdfViewer,PageSettingsPanel,SectionListItem,NumberField}.tsx  ← git mv src/components/*
  mobile/
    router.tsx / layouts/ / pages/   待建（底部导航/单栏形态）
  components/               清空；两端共用件将来上提到这里
  hooks/ i18n/ lib/ stores/ types/ index.css   原样不动
```

`index.html` 不动（仍指向 `/src/main.tsx`，首帧主题脚本唯一存在于此）。

### 2. `src/main.tsx` 改为分发器

```ts
// 构建期按目标裁剪：桌面产物不含移动代码，反之亦然
if (import.meta.env.VITE_APP_TARGET === "mobile") {
  import("./entries/mobile");
} else {
  import("./entries/desktop");
}
```

`entries/desktop.tsx` = 原 main.tsx 内容（`import "../index.css"`、`import "../i18n"`、`RouterProvider` 挂 `../desktop/router`）；`entries/mobile.tsx` 同构挂 `../mobile/router`。

### 3. `src/vite-env.d.ts` 补类型

```ts
interface ImportMetaEnv {
  readonly VITE_APP_TARGET: "desktop" | "mobile";
}
```

### 4. `vite.config.ts` 按目标算端口 / outDir

```ts
const target = process.env.VITE_APP_TARGET === "mobile" ? "mobile" : "desktop";

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: target === "mobile" ? 1430 : 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: target === "mobile" ? 1431 : 1421 }
      : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    outDir: target === "mobile" ? "dist-mobile" : "dist",
    emptyOutDir: true,
  },
}));
```

### 5. `package.json` 脚本

```json
"dev": "vite",
"dev:mobile": "VITE_APP_TARGET=mobile vite",
"build": "tsc && vite build",
"build:mobile": "VITE_APP_TARGET=mobile tsc && vite build"
```

注：`VAR=x cmd` 语法 Windows cmd 不支持，若有 Windows 贡献者需 `yarn add -D cross-env` 改写。

### 6. `src-tauri/tauri.android.conf.json`（新增）

```json
{
  "build": {
    "beforeDevCommand": "yarn dev:mobile",
    "devUrl": "http://localhost:1430",
    "beforeBuildCommand": "yarn build:mobile",
    "frontendDist": "../dist-mobile"
  }
}
```

桌面 `src-tauri/tauri.conf.json` 一字不动。

### 7. 收尾

- 修正搬家产生的相对 import（`../` → `../../` 等），跑 `yarn lint:fix`。
- `yarn lint && yarn test && yarn build && yarn build:mobile` 全绿。
- Tauri CLI 在 before*Command 里注入 `TAURI_ENV_PLATFORM=android`，将来需要脚本自动感知平台时可用。

## 验收

1. `yarn build` → `dist/`：产物中不应出现移动端代码（grep 产物 chunk 无 mobile 路由/组件标识）；`yarn build:mobile` → `dist-mobile/` 反之。
2. `yarn tauri dev` 走 1420、`yarn tauri android dev` 走 1430，互不干扰；真机调试照旧设 `TAURI_DEV_HOST=<局域网IP>`。
3. `tsc` 每次全量检查两个入口（类型不分家）；`vitest` 通过（stores/lib 测试不受影响）。

## 安卓落地注意点

- 底部导航用 daisyUI 5 的 `dock` / `dock-label` / `dock-active`（`btm-nav` 已移除；已在 `node_modules/daisyui/daisyui.css` 验证，2026-11-07）。
- viewport 加 `viewport-fit=cover`，底栏用 `env(safe-area-inset-bottom)` 垫高，适配手势条。
- Android 返回键 = webview history back，hash 路由天然兼容，首版无需特殊处理；要拦截时在 `entries/mobile.tsx` 做。
- 将来上 iOS：复制 `tauri.android.conf.json` 为 `tauri.ios.conf.json`，`VITE_APP_TARGET` 枚举扩展即可，模式不变。

## 约束（不变项）

- AGENTS.md 前端组件规范对两套 UI 同样生效：daisyUI / yarn 依赖 / 禁拷源码，impeccable 主张让位于 daisyUI 规则。
- i18n 双语词条两份同步改；zustand persist key `base6-techo:settings` 带版本 + migrate。
- 提交前 `yarn lint`。
