---

name: base6-techo
description: 离线手帐 PDF 生成器的界面体系 —— daisyUI 5 素纸基底 + 群青蓝单强调，安静可靠的工具
colors:
ultramarine: "oklch(45% 0.24 277.023)"
ultramarine-content: "oklch(93% 0.034 272.788)"
paper-white: "oklch(100% 0 0)"
mist: "oklch(98% 0 0)"
hairline: "oklch(95% 0 0)"
ink: "oklch(21% 0.006 285.885)"
slate: "oklch(14% 0.005 285.823)"
error: "oklch(71% 0.194 13.428)"
error-content: "oklch(27% 0.105 12.094)"
typography:
display:
fontFamily: "ui-sans-serif, system-ui, sans-serif"
fontSize: "1.875rem"
fontWeight: 700
title:
fontFamily: "ui-sans-serif, system-ui, sans-serif"
fontSize: "1.5rem"
fontWeight: 700
heading:
fontFamily: "ui-sans-serif, system-ui, sans-serif"
fontSize: "1.125rem"
fontWeight: 600
body:
fontFamily: "ui-sans-serif, system-ui, sans-serif"
fontSize: "1rem"
fontWeight: 400
lineHeight: 1.5
label:
fontFamily: "ui-sans-serif, system-ui, sans-serif"
fontSize: "0.875rem"
fontWeight: 600
meta:
fontFamily: "ui-sans-serif, system-ui, sans-serif"
fontSize: "0.875rem"
fontWeight: 400
rounded:
field: "0.25rem"
box: "0.5rem"
selector: "0.5rem"
spacing:
"3": "0.75rem"
"4": "1rem"
"6": "1.5rem"
"8": "2rem"
components:
button-primary:
backgroundColor: "{colors.ultramarine}"
textColor: "{colors.ultramarine-content}"
rounded: "{rounded.field}"
height: "2.5rem"
padding: "0 1rem"
button-ghost:
backgroundColor: "transparent"
textColor: "{colors.ink}"
rounded: "{rounded.field}"
height: "2.5rem"
button-icon-ghost:
backgroundColor: "transparent"
textColor: "{colors.ink}"
rounded: "9999px"
size: "1.5rem"
card:
backgroundColor: "{colors.paper-white}"
rounded: "{rounded.box}"
input-field:
backgroundColor: "{colors.paper-white}"
textColor: "{colors.ink}"
rounded: "{rounded.field}"
height: "2.5rem"
badge-outline:
textColor: "{colors.ink}"
rounded: "{rounded.selector}"
height: "1.5rem"
navbar:
backgroundColor: "{colors.mist}"
height: "4rem"
---

# Design System: base6-techo

## Overview

**Creative North Star: "素纸"**

界面是一张安静的素纸，等着一本手帐被排出来。这里是生成印刷品的工坊台面，不是展台：颜色收成一层纸白与墨色，唯一的彩色是群青蓝——写在按钮和关键动作上，像素纸上一支待用的笔。密度是舒适的工具密度：一栏编辑、一栏设置，间距宽松但不散。产出物（毫米级精确的手帐 PDF）是主角，界面为它让路。

性格来自组件的克制：按钮、输入框、折叠面板都收敛、不抢戏，反馈明确、状态清晰，像安静可靠的工具。整个体系直接建在 daisyUI 5（Tailwind v4 CSS 插件）的语义组件类上，light/dark 双主题靠同一套语义 token 自动切换，不允许为某个画面手搓替代组件。

明确不像什么：不像营销落地页——没有渐变大图、大标语、插画满屏；不像密集企业后台——没有高密度数据表格、多层面板和工具栏堆叠。本产品是轻编辑器。

**Key Characteristics:**

- 素纸基底：页面与卡片同为纸白（base-100），层次靠柔和阴影的轻微悬浮感，不靠重色块
- 单强调色：群青蓝只用于主按钮与关键动作，出现越少越有力
- 系统字体、零 webfont：中英文都跟随系统渲染
- 组件即规范：一切外观交给 daisyUI 语义类（`btn`/`card`/`fieldset`/`collapse`…），禁止裸写样式复刻
- 卡片外裸标题：栏目标题不包卡片，直接排版在页面上

## Colors

素纸与墨：一组无彩纸色承担全部背景与文字，一支群青蓝承担全部强调。取值来自 daisyUI 5.7.50 内置主题（oklch），light 为正典值；dark 下只有纸色变深、群青提亮，状态色不变。

### Primary

- **群青蓝 Ultramarine** (`oklch(45% 0.24 277.023)`；dark `oklch(58% 0.233 277.117)`): 唯一的强调色。主按钮（生成 PDF、回到首页）、加载态所在的主操作。色相 277°、彩度拉满、深而饱和，是素纸上唯一的颜料。
- **群青上的文字 Ultramarine Content** (`oklch(93% 0.034 272.788)`；dark `oklch(96% 0.018 272.314)`): 群青蓝底色上的文字与图标。

### Neutral

- **纸白 Paper White** (`oklch(100% 0 0)`；dark `oklch(25.33% 0.016 252.42)`): 页面底色与卡片底色（同色——分层交给阴影）。dark 下是深灰蓝夜纸。
- **雾灰 Mist** (`oklch(98% 0 0)`；dark `oklch(23.26% 0.014 253.1)`): 导航栏、404 hero、空状态淡底的第二层纸面。
- **发丝灰 Hairline** (`oklch(95% 0 0)`；dark `oklch(21.15% .012 254.09)`): 虚线边框等最细的界线（`border-base-300`）。
- **墨色 Ink** (`oklch(21% 0.006 285.885)`；dark `oklch(97.807% 0.029 256.847)`): 正文与标题文字；输入框 1px 描边是墨色 20% 透明混合。
- **石板灰 Slate** (`oklch(14% 0.005 285.823)`，两种主题相同): daisyUI neutral 角色，tooltip 气泡底色，文字用 neutral-content（`oklch(92% 0.004 286.32)`）。

### Status（按需取用）

- **赤 Error** (`oklch(71% 0.194 13.428)`): 仅用于错误语义——页数溢出徽章（`badge-error`）、错误提示条（`alert-error`）、删除按钮图标（`text-error`）。
- info / success / warning 主题里存在但界面尚未使用；需要语义状态时才启用。

### Named Rules

**单一强调色 Rule。** 群青蓝是界面上唯一的彩颜料；daisyUI 的 secondary（品红 `oklch(65% .241 354.308)`）与 accent（青绿 `oklch(77% .152 181.912)`）虽然在主题里定义了，界面一律不用。想要强调时，用群青或墨色的字重与透明度，不开新色。

**内容色不进界面 Rule。** 生成到手帐页面里的颜色（横线默认 `#9E9E9E`、线色选择器等）是文档数据，随用户配置变化；它们永远不作为 UI 底色、边框或文字色进入界面。界面只走语义 token。

## Typography

**Display Font:** 系统无衬线（Tailwind 默认栈 `ui-sans-serif, system-ui, sans-serif`），中文跟随各平台系统字渲染
**Body Font:** 同上（单一字族，无衬线组合）
**Label/Mono Font:** 等宽栈（`ui-monospace`，仅 404 数字一处用 `font-mono`）

**Character:** 零 webfont、零字体性格——纸的安静来自不引入声音。层级全靠字号、字重与透明度三件套。

### Hierarchy

- **Display** (700, 1.875rem `text-3xl`): 仅 404 页主标题。
- **Title** (700, 1.5rem `text-2xl`): 设置页等整页标题。
- **Heading** (600, 1.125rem `card-title`): 栏目标题（版式组合 / 页面设置）与卡片标题（预览 / 设置）。卡片外的标题不包卡片直接排版。
- **Body** (400, 1rem, 行高 1.5): 正文与表单内容。
- **Meta** (400, 0.875rem `text-sm` + `opacity-70`): 页数、页码指示等辅助信息，用透明度而非新灰色（60% 在纸白底上对比度踩线，统一 70%）。
- **Label** (600, 0.875rem): 表单字段标题（`fieldset-legend`）、按钮文字、徽章文字（badge 为 400）。

### Named Rules

**零 Web 字体 Rule。** 界面不引入任何 webfont；层级与性格由字重、字号、透明度承担。要「更像品牌」时改结构与留白，不改字体。

## Layout

单壳应用（hash 路由），一屏一主任务：

- **导航栏**：`navbar` 最小高 4rem，`bg-base-200` + `shadow-sm`；左为 ghost 品牌按钮，右为圆形 ghost 设置按钮（设置页内点击返回主界面）。
- **主容器**：`max-w-5xl mx-auto px-4 py-8`。从 3xl 放开到 5xl 是刻意决定——双栏编辑器在 3xl 会挤成窄条。
- **主界面双栏**：`lg:grid-cols-[minmax(0,1fr)_18rem]`，左栏为自适应的版式组合列表，右栏钉死 18rem 放页面设置与生成按钮；`items-start` 顶对齐，窄屏退化为单栏堆叠。
- **节奏**：列表项之间 `gap-3`（0.75rem），区块之间 `space-y-3/4`（0.75–1rem），双栏与主容器间 `gap-6`（1.5rem）；表单内部网格 `gap-4` + `sm:grid-cols-2/3`。
- **表单分组**：一律 `fieldset` + `fieldset-legend`（daisyUI 5 已移除 `form-control`），右栏设置区是无卡片外框的裸 `section`。

## Elevation & Depth

阴影是氛围性的轻微悬浮，不是结构性分层。页面与卡片同为纸白，深度感全部来自柔和的投影：卡片 `shadow-md` 像轻轻放在台面上的纸，导航栏 `shadow-sm` 只把第二层纸面（`bg-base-200`）与主纸面分开。阴影只表达「这是一张可以拿起来的纸」与「正在进行中」两种意思——拖拽中的 section 升到 `shadow-lg` + 80% 不透明度，是状态反馈而非装饰。体系允许未来把阴影换成描边或色调分层而不伤骨架；当前不主动去阴影。

### Shadow Vocabulary

- **纸浮卡** (`shadow-md`: `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): 卡片、预览区、设置卡、section 折叠项的默认悬浮。
- **纸面分隔** (`shadow-sm`: `0 1px 2px 0 rgb(0 0 0 / 0.05)`): 导航栏对主纸面的轻分隔。
- **拿起** (`shadow-lg`: `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): 仅拖拽中的列表项，配合 `z-10 opacity-80`。
- **daisyUI 内建实体感**：按钮自带轻底影（`0 3px 2px -2px` 底色 30% 混合）与输入框顶部内嵌高光（`--depth: 1`），是组件内建的材质，不算布局阴影。

### Named Rules

**悬浮非结构 Rule。** 阴影表达「轻」与「进行中」，不承担信息架构——同一个 surface 换成描边分层也必须依然成立。禁止用加深阴影制造假层级。

## Shapes

三档圆角全部来自 daisyUI 主题变量：控件 `--radius-field` 0.25rem（按钮、输入框、下拉、tooltip 气泡），容器与徽章/开关 `--radius-box` / `--radius-selector` 各 0.5rem（卡片、alert、hero、折叠项 `rounded-box`；badge、toggle）。边框统一 1px（`--border`）：输入类是墨色 20% 混合的细描边，空状态用 `border-base-300` 的虚线框 + 50% 雾灰底示意「这里还没有内容」。无噪点（`--noise: 0`）、无玻璃拟态、无斜切角——形状语言就是纸和细线。

## Components

组件性格一句话：安静可靠的工具——每个控件都收敛、状态清晰、反馈即时。以下均为本仓库实际使用的 daisyUI 组件与用法约定。

### Buttons

- **Shape:** 圆角 0.25rem（`--radius-field`），高 2.5rem，水平内边距 1rem，字重 600，字号 0.875rem；daisyUI 5 自带 1px 深色边与轻底影。
- **Primary** (`btn btn-primary`): 群青蓝底 + 群青文字；用于每屏唯一的主动作——生成 PDF（`btn-block` 通栏）、404 回首页。生成中在按钮内嵌 `loading loading-spinner loading-xs` 并禁用。
- **Ghost** (`btn btn-ghost`): 透明底无边框；品牌名（`text-base font-semibold`）与全部图标按钮。
- **Icon Button** (`btn btn-ghost btn-circle btn-xs|btn-sm`): 1.5rem / 2rem 圆形，拖拽手柄、删除（`text-error`）、信息说明、翻页；删除与信息按钮必须带 `aria-label`。
- **Hover / Focus:** daisyUI 内建 0.2s 过渡（`cubic-bezier(0,0,.2,1)`）+ 聚焦描边；不额外造 hover 动效。

### Section 折叠卡（签名组件）

`details.collapse.collapse-arrow.rounded-box.bg-base-100.shadow-md`——版式组合列表的基本单元。summary 行内从左到右：拖拽手柄（ghost 圆钮 + `cursor-grab` / `active:cursor-grabbing`，单击不触发展开）、`Section N`（600 字重）、模板徽章、`× 页数`（meta 灰）、右侧删除钮。展开后 `collapse-content` 内用 `fieldset` 网格配置模板与参数。拖拽由 dnd-kit 驱动，6px 激活距离防止卡内输入误拖；拖拽中整卡 `z-10 opacity-80 shadow-lg`。

### Cards / Containers

- **Corner Style:** `rounded-box` 0.5rem。
- **Background:** `bg-base-100`，与页面同纸色。
- **Shadow Strategy:** `shadow-md`（见 Elevation），不用边框分层。
- **Border:** 无，仅空状态卡用虚线边框（`border-base-300 border border-dashed bg-base-200/50`）。
- **Internal Padding:** `card-body` 1.5rem，内部纵距覆盖为 `gap-4`（1rem）。

### Badges

- **Style:** `badge badge-outline`——透明底、1px currentColor 描边、0.5rem 圆角、高 1.5rem、字号 0.875rem；用于模板名与全书页数。
- **State:** 页数溢出换 `badge-error`（赤底白字）；无选中/未选中态用法。

### Inputs / Fields

- **Style:** `input` / `select` 高 2.5rem，`bg-base-100`，1px 墨色 20% 描边，圆角 0.25rem，字号 0.875rem；下拉 `w-full` 通栏。
- **分组:** `fieldset` + `fieldset-legend`（600 字重）；字段标题可内嵌 tooltip 信息钮。
- **数字输入（NumberField 模式）:** 打字过程中仅提交合法值（在 min–max 内），失焦时 clamp 并回写文本——禁止边打字边改值。
- **取色:** 原生 `input[type=color]`，`h-12 w-full cursor-pointer p-1`。
- **开关:** `toggle`（0.5rem 圆角档），用于「计入页码」这类布尔项；选中态是纸白轨道 + 墨色滑块（daisyUI 5.7 stock 行为），不染主色。
- **Error / Disabled:** 错误走 `alert alert-error`（`role="alert"`）整条提示，不做字段级红框。

### Tooltip

`tooltip tooltip-left` + `data-tip` 挂在 ghost 圆形信息钮上（装订方式说明、悬停/聚焦触发）。本仓库唯一一处自定义 CSS：气泡文字左对齐（daisyUI 默认居中，左侧弹出时左对齐更易读）。气泡为石板灰底、0.875rem、0.25rem 圆角、20rem 上限。

### Navigation

`navbar bg-base-200 shadow-sm`：品牌位是 `btn btn-ghost`（`app.name`，600 字重），右侧 `btn btn-ghost btn-circle` 齿轮按钮；设置页内按钮变「返回」行为（往返跳转），无汉堡、无多级菜单。

### Empty State

虚线纸框：`card border border-dashed border-base-300 bg-base-200/50`，居中两行——600 字重主句 + `text-sm opacity-70` 提示句，下方紧接通栏「添加 section」按钮。

### 404

`hero rounded-box bg-base-200` 居中排：`font-mono text-sm opacity-60` 的 "404"、`text-3xl` 700 字重标题、`btn btn-primary` 回首页。

### Icons

内联手绘 SVG（lucide 风格几何）：24 viewBox、`stroke="currentColor"`、`strokeWidth 2`、圆头圆角，尺寸 `size-4`（拖拽/删除）或 `size-5`（设置/加号）。不引入图标库运行时，不用表情符号当图标。

## Do's and Don'ts

### Do:

- **Do** 一切外观用 daisyUI 语义组件类 + Tailwind 工具类布局；颜色只用 `base-*` / `primary` / `error` 等语义 token，让 light/dark 自动成立。
- **Do** 栏目标题裸排在页面上（`card-title` 不包卡片），卡片只包内容。
- **Do** 阴影只用 `shadow-sm/md` 两档 + 拖拽态 `shadow-lg`；同纸色分层靠悬浮感表达。
- **Do** 数字输入沿用 NumberField 模式（打字中只提交合法值、失焦 clamp 回写）；新增参数字段先套这个模式。
- **Do** 图标内联 SVG、`strokeWidth 2`、`currentColor`、`size-4/5`；交互钮带 `aria-label`。
- **Do** zh-CN 与 en 词条同步修改；文案简短、命令式（「生成 PDF」「添加 section」）。

### Don't:

- **Don't** 手搓组件替代 daisyUI（不裸写按钮/弹窗/下拉，不引入第二套视觉组件库）；daisyUI 达不到时先和用户商量。
- **Don't** 在 UI 里写死 hex 色值（`#9E9E9E` 等只属于生成文档的数据）；不用 secondary/accent，群青蓝之外不出现第二强调色。
- **Don't** 营销落地页手法：渐变、大标语、插画、大面积色块。
- **Don't** 密集企业后台风：高密度表格、多层面板、工具栏堆叠；一屏保持一个主任务。
- **Don't** 用加深阴影、边框叠加或新灰阶制造层级；不引入 webfont；不加纯装饰动画（动效优先 daisyUI/Tailwind 内建，复杂的先经用户同意用 `yarn add motion`）。
