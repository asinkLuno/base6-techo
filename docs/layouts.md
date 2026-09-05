# 版式全览与业务逻辑

本文梳理 base6-techo 的所有版式（Pattern）、它们的参数、页数计算逻辑、
绘版逻辑，以及它们如何汇入“Section → 拼版 → PDF”的整体渲染流程。

## 总览：架构与数据流

- 前端 `src/lib/schema.ts` 定义 `PatternKind`（16 种版式）、`defaults`（每种版式的默认参数）、
  `patternNames`（中文名）、`PATTERN_GROUPS`（分组）。
- 前端把每个版式配置序列化成 JSON `section.pattern`（`kind` + 参数），经 `run_pipeline` / `preview_document`
  发给后端。
- 后端 `src-tauri/src/backend.rs` 用 `#[serde(tag = "kind")]` 的 `enum Pattern` 反序列化每种版式，
  每种实现各自的 `validate`、`page_count`、`draw_*`。
- 一个文档 = 若干个 **Section**；每个 Section 一种版式。各 Section 页数由它自己的参数算出
  （见 `pattern.page_count()` 与前端 `effectivePages()`），再按顺序拼成一整本 PDF。
- 版式只负责“绘制内容区”里的线/点/文字/图形；页眉、页脚、装订侧/非装订侧水印、页码由
  公共的 `render_page()` 统一叠加（见“公共页缘逻辑”）。

### 版式分组（前端 `PATTERN_GROUPS`）

| 组 | 版式 |
|----|------|
| 基础 | 点阵 dots、网格 grid、横线 ruled、法文格 seyes、美式横线 us-ruled、古文竖排 vertical |
| 复刻 | Midori、博文館・當用日記、博文館・懐中日記 |
| 日程 | 月历 month、年度追踪 month-tracker、月打卡 tracker、八分周视图 eight、时间轴 timeline、月追踪制图 graph、年历 year |

______________________________________________________________________

## 一、基础组

### 1. 点阵 dots

- **用途**：手帐常用的居中点阵纸。
- **参数**：`pages`（页数）、`spacing`（行距）、`column_spacing`（列距）、`radius`（点径）、
  `color`（颜色）、`center_color`（中心点单独颜色，None 时同 `color`）。
- **页数**：`pages`。
- **绘版**：从内容区中心向四周以 `spacing`/`column_spacing` 扩散生成等距点阵；`centered()` 保证
  中心对称，最接近几何中心的点采用 `center_color`，其余用 `color`。
- **校验**：`pages∈[1,500]`，间距与点径 >0，颜色合法。

### 2. 网格 grid

- **用途**：等距方格纸，四周封闭边框（“锁边”）。
- **参数**：`pages`、`spacing`（间距）、`color`、`width`（线宽）。
- **页数**：`pages`。
- **绘版**：内容区内居中取整格区域（宽/高 = `floor(尺寸/spacing)*spacing`），画四条边框 +
  内部横竖线；剩余边距左右居中对齐。
- **校验**：同点阵（间距、线宽 >0，页数范围）。

### 3. 横线 ruled

- **用途**：内容区内等距横线、左右通边。
- **参数**：`pages`、`spacing`（行距）、`color`、`width`（线宽）。
- **页数**：`pages`。
- **绘版**：`centered(content.y, content.height, spacing)` 生成横线，x 从内容左缘到右缘。
- **校验**：间距、线宽 >0。

### 4. 法文格 seyes（Séyès）

- **用途**：法文小学生用格纸。
- **参数**：`pages`、`spacing`（主格距 8mm）、`margin_line`（第几根竖线为红线，0 表示无）、
  `main_color/main_width`（主线）、`fine_color/fine_width`（细分线）、
  `vline_color/vline_width`（普通竖线）、`margin_color/margin_width`（红线）。
- **页数**：`pages`。
- **绘版**：
  - 主横线：内容区高度内、左右通边整页宽。
  - 细分线：`spacing/4` 相位锁定主线，跳过与主线重合的行（每 4 条细线 1 条主线）。
  - 通页竖线：内容区宽度内每 `spacing` 一条，贯穿整页高度；第 `margin_line` 根用红线/红宽。
- **校验**：各线宽、间距 >0，四个颜色合法。

### 5. 美式横线 us-ruled

- **用途**：美式宽横线本（蓝线）+ 左侧红竖边线。
- **参数**：`pages`、`spacing`（8.7mm）、`rule_color/rule_width`（横线蓝）、
  `margin_x`（红边线距页左缘）、`margin_color/margin_width`（红线）。
- **页数**：`pages`。
- **绘版**：横线左右通整页宽；一条红竖线在 x=`margin_x` 贯穿整页高。
- **校验**：间距、线宽 >0，`margin_x>=0`，两色合法。

### 6. 古文竖排 vertical

- **用途**：中国古代竖排书写（自右向左）用的金石竹木式文武线双框 + 界栏。
- **参数**：`pages`、`spacing`（栏距）、`color`、`frame_outer_width`（外框粗）、
  `frame_inner_width`（内框细）、`frame_gap`（内外框间距）。
- **页数**：`pages`。
- **绘版**：界栏自版心中心向左右两边生成，最外侧放不下新一列即止；外粗内细两条矩形框
  （文武线）恰好围住整列数，整块在版心内水平居中、余量留在框外，只画内部竖分隔线。
- **校验**：间距、双框宽、框距 >0。

______________________________________________________________________

## 二、复刻组

### 7. Midori

- **用途**：复刻 Midori 笔记本网格。
- **参数**：`pages`、`line_color`（尺寸/线宽已固定，只留颜色可配；默认线宽 0.7）。
- **页数**：`pages`。
- **绘版**：间距 5mm、格间隙 1mm 的网格；偶数序格线向外延伸 1.2mm 出边；
  每 10 格交叉处用点（上下左右各一个）连接断开的格线。
- **校验**：`pages∈[1,500]`，颜色合法。

### 8. 博文館・當用日記 hakubunkan-toyo-nikki

- **用途**：复刻博文館“當用日記”旧式日记本，一页一天。
- **参数**：`start_date`、`end_date`、`date_format`（如 `%-m月%-d日`）、`line_color`、`line_width`。
- **页数**：**= 起止日之差 + 1**（每天一页）。
- **绘版**：顶部 16pt 日期标题；下方按固定比例分区：受信/发信栏（上区）、摘记栏 + 天气/气温列（下区 14 列）。
  页缘区用淡色虚线。日期逐页推进（`start_date + index 天`）。
- **校验**：结束 ≥ 开始，线宽 >0，日期格式合法（zh-CN）。

### 9. 博文館・懐中日記 hakubunkan-kaichu-nikki

- **用途**：复刻博文館袖珍“懐中日記”，一页放两天。
- **参数**：`start_date`、`end_date`、`date_format`、`date_locale`、
  `weekday_headers`（7 项表头）、`lunar_style`（numeric 旧+数字 / traditional 传统农历）、
  `line_color`、`line_width`、`date_size`。
- **页数**：**= ceil((起止日之差 + 1) / 2)**（每页上下两格各一天）。
- **绘版**：每页上下两栏，各栏 header 显示星期 + 日期 + 农历（右上角）、右侧天气/气温标签列；
  `%a` 会被剔除（星期用 `weekday_headers` 单独渲染）。
- **校验**：结束 ≥ 开始，线宽/字号 >0，7 项 weekday 表头，日期与农历格式合法。

______________________________________________________________________

## 三、日程组

### 10. 月历 month

- **用途**：单月或双页月历，7 列周一为首网格，左上日期、右上月相方块。
- **参数**：`year`、`month`、`phase_color`（月相色）、`line_color/line_width`（格线）、
  `date_size`、`weekday_headers`、`two_page`（双页：周一~三 / 周四~日）、
  `title_format`（如 `%Y年%-m月`）、`show_holidays`、`lunar`（显示农历）、
  `sub_size`（农历/节日字号）、`sub_gap`。
- **页数**：`two_page ? 2 : 1`。单页模式每页推进一个月（`month_ym(year, month, index)`）。
- **绘版**：网格交叉处留 0.2mm 缺口；左上角日期；右上角按照面比例画的月相圆盘
  （`moon_illumination`，以 2000-01-06 朔为历元的近似算法）。`show_holidays=false` 时节日名与
  周末都不染红。
- **校验**：month∈[1,12]，线宽/日期字号/农历字号 >0，7 项表头，标题格式（不支持农历占位）、颜色合法。

### 11. 年度追踪 month-tracker

- **用途**：跨多月的年度打卡/追踪表。
- **参数**：`start`/`end`（"YYYY-MM"）、`two_page`（双页：第 1 页 1–15 日，第 2 页 16–31 日）、
  `line_color/line_width`、`date_size`。
- **页数**：`two_page ? 2 : 1`。
- **绘版**：横轴 1–31 日期列，纵轴月份行；顶部开口的表头行放日期，下方每月一行空格；
  竖线不过表头行、交叉留 GAP。单页 1–31 横排，双页按日拆分两页且格大小一致。
- **校验**：起止为 `YYYY-MM`，跨度 1..=60 个月，线宽/字号 >0。

### 12. 月打卡 tracker

- **用途**：单月的打卡习惯表。
- **参数**：`year`、`month`、`items`（打卡项数 1..30）、`line_color/line_width`、`date_size`。
- **页数**：恒 1。
- **绘版**：横放设计坐标系后整体逆时针转 90° 落到页面；表头行日期 + `items` 行空格，
  顶部边线不画（开口样式）。
- **校验**：month∈[1,12]，items∈[1,30]，线宽/字号 >0。

### 13. 八分周视图 eight

- **用途**：一周 8 格布局（一页前半 / 一页后半），每格配日期、月相；空白格放当月迷你月历。
- **参数**：`start_date`/`end_date`（须整周：周一 / 周日）、`date_format`、`date_locale`、
  `weekday_lang`、`title_format`、`weekday_headers`、`line_color/line_width/line_style`、
  `center_gap`、`date_size`、`lunar`。
- **页数**：**= 整周数 × 2**（每两周 → 左右两页）。
  - 奇数页（index 偶数）：空 / 周一 / 周四 / 周五；
  - 偶数页（index 奇数）：周二 / 周三 / 周六 / 周日。
- **绘版**：中心留 `center_gap` 空隙后向上下左右画线分四格（不画外框），中心一个点；
  每个填日子的格右上角画月相；空白格（左上象限）内上下画当月 + 次月迷你月历，
  本周日期红色；跨月的周恰为所跨两月。
- **页级规则**：`validate` 要求开始为周一、结束为周日、结束 ≥ 开始；`weeks()` 枚举所有整周。
- **校验**：整周约束、线宽/字号 >0、7 项表头、日期/标题格式、农历范围（1901-02-19 至 2101-01-28）合法。

### 14. 时间轴 timeline

- **用途**：按小时的一天时间轴，可叠加日出日落昼夜着色。
- **参数**：`start`/`end`（小时，0..30，end>start）、`pages`（1 单页 / 2 左右双页分半）、
  `line_color/line_width`、`label_size`、`title_format`、`start_date`/`end_date`、
  以及可选的 `latitude`/`longitude`/`timezone`（三者须同时设置）、`daylight_color`/`night_color`。
- **页数**：**= 起止日天数 × pages**（`pages=1` 单页，`pages=2` 每天跨左右两页）。
- **绘版**：轴线在装订侧；奇数页画 `start..mid` 小时、偶数页画 `mid..end`；整点刻度 + 半小时间隔；
  沿轴线向外散布方形点。若提供经纬度/时区，用太阳高度角（`solar_elevation`）判断昼夜，
  每个小时的轴线/刻度/点用 `daylight_color`（白天）或 `night_color`（夜间）着色。
- **校验**：`0<=start<end<=30`，页数 ∈{1,2}，起止日期必备且 end≥start，
  经纬度范围与已知时区，三个定位参数须同设，颜色与标题格式合法。

### 15. 月追踪制图 graph

- **用途**：极细方格纸，横轴 1–31 代表 31 天（每天 5 小格，日界线加粗），可配纵轴刻度。
- **参数**：`axis`（数字在右/左，对应旋转方向）、`line_color/line_width`、`date_size`、
  `y_min`/`y_max`（纵轴范围，同时设置才画刻度）、`y_steps`（刻度段数）。
- **页数**：恒 1。
- **绘版**：横放设计坐标系后整体逆时针转 90° 落到页面；31 天各 5 小格，每 5 条格线加粗，
  31 外多留一组 5 格；标签 1–31 压在日界粗线上；有纵轴范围时在轴带内标注 `[y_min,y_max]`
  均分 `y_steps` 段的刻度数字。
- **校验**：线宽/字号 >0，`y_max > y_min`（若同时设置），`y_steps>0`，颜色合法。

### 16. 年历 year

- **用途**：整年月历网格（默认 1×2，左右双页为一行四个月）。
- **参数**：`start`/`end`（"YYYY-MM"）、`rows`/`cols`（每页网格，1..12）、`date_size`、
  `weekday_lang`、`title_format`、`weekday_headers`、`show_holidays`、`lunar`。
- **页数**：**= ceil(总月数 / (rows×cols))**。双页一行：`page_months` 里同一“行”的
  `rows×cols` 个月横跨左右两页各取一半。
- **绘版**：复用八分周视图的迷你月历 `push_one_month`；每格月历撑满列宽、高度按列宽等比并
  垂直居中于行带内；`show_holidays=false` 时无节日名、周末也不染红。
- **校验**：起止为 `YYYY-MM` 且 end≥start，rows/cols∈[1,12]，7 项表头，标题格式（支持农历占位）、字号 >0。

______________________________________________________________________

## 公共页缘逻辑（`render_page` / `DocumentSettings`）

所有版式共享一套页缘装饰，由 `DocumentSettings` 控制，叠加在版式绘制之上：

- **页头 / 页脚带状区**（`BandSettings`）：`mode=Text` 画一至两行文字，`mode=Date` 画固定的
  “Date:/No.” 横线填写位；`align` 居中 / 靠装订外 / 靠装订内；可选 `page_number` 显示页码。
- **装订侧水印 / 非装订侧水印**：垂直 90° 文字块，奇数页装订在左、偶数页在右，内外侧镜像。
- **页码**：`document.page_number` 控制是否参与页码；只把参与页码的 Section 记入 `page_number` 计数。
- 页眉/页脚/水印的边距若被置 0（对应前端的 headerEnabled/footerEnabled/watermarkEnabled 关闭），
  相应区域不绘制。

## 拼版与输出

- **页面位置**：`geometry_for(page, number)` 按奇偶页决定装订侧（左/右）与内容区边距
  （`binding` 在装订侧、`non_binding` 在外侧）。
- **页数串联**：`generate_with_log` 依次为每个 Section 生成 `page_count()` 页，页码按
  `document.page_number` 决定是否递增。
- **拼版**：`bind.mode` 可为 `booklet`（骑马钉，整本按 4 页补齐）或 `thread`（锁线分册，按
  `sheets_per_group` 纸张数分组），或 `null`（不拼版、按顺序输出）。
- **渲染**：每页把线条/点/路径/文字汇总成 TikZ，`render_latex` 统一输出（含均匀点阵 pattern 合并、
  字体资源注册、PDF 书签），再由 `compile` 调用 tectonic 编译成 PDF。

## 前端字段映射速查

- `section.pattern` → `PatternKind` + 参数（`defaults[kind]` 初始化，切换版式用 `defaults[kind]` 重置）。
- `effectivePages(section)`（前端）与 `Pattern::page_count()`（后端）逻辑一致，用于头部“成品 N 页”统计。
- Section 级开关（参与页码、页头、页脚、装订侧/非装订侧水印）经 `sectionRequest()` 变换成
  `RenderSectionRequest` 发给后端。
