# LaTeX 框架

Rust 入口为 `templates::document::generate_document_latex(&Document)`；`plan_document` 返回只读的页面计划，便于预览和测试。生成器是纯函数，Tectonic 编译由 `compile` 模块负责。`imposition::plan_output(&book)` 在阅读页计划之后生成印刷输出计划。

## 模块与职责

| 模块            | 职责                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `document.rs`   | 校验整个文档，遍历 section，生成实际页序、显示页码及节内索引                                                                                                                                              |
| `layout.rs`     | 纸张、装订方向、四周留白；统一计算页心、页头、页脚、两侧区域                                                                                                                                              |
| `components.rs` | 页头、页脚、装订侧水印、外侧水印                                                                                                                                                                          |
| `patterns.rs`   | 页心模板注册与分发，当前为 `blank`、`linear`（兼容别名 `lined`，可选左侧竖线）、`dots`、`grid`、`hogen`（方眼罫）、`octanWeek`（八分周视图）、`month`（月历）、`tracker`（月打卡）、`daily`（一日时间轴） |
| `imposition.rs` | 不拼版／骑马订／锁线分帖，补白与纸张正反面配页                                                                                                                                                            |
| `latex.rs`      | 按输出计划平移阅读页到印刷面，TikZ 输出、普通文字转义、数字格式化                                                                                                                                         |
| `lined.rs`      | 原 `LinedDocParams` 和 `generate_lined_latex` 的兼容适配器                                                                                                                                                |

## 页序与区域约定

- `physical_page` 从 1 开始，跨 section 连续，包括不显示页码的页。
- `section_index`、`local_index` 从 0 开始。页心模板以后可用它们确定日期等内容。
- `display_number` 独立连续计数；`numbered: false` 的 section 不消耗显示页码。
- 左装订时全书奇数页装订侧在左、偶数页在右；右装订反向。显示页码和模板索引不参与判断。
- 坐标统一使用毫米，原点位于纸张左上角，y 向下。
- `headerMm`、`footerMm` 表示上下区域的完整高度；`innerMm`、`outerMm` 表示两侧区域的宽度。页心扣除四者。页头和页脚与页心同宽，两侧水印区域与页心同高。
- 每个组件裁剪在自己的区域内，超长文字会被裁剪；框架当前不自动换行、缩字或扩展区域。
- 布局在阅读顺序上完成，然后独立拼版。`physical_page` 仍表示全书阅读页序；印刷面由 `OutputPage` 表示。拼版不修改页心、装饰或显示页码。

## IPC 调用

新增 `generate_document_pdf` 命令，参数名为 `document`。原 `generate_lined_pdf({ params })` 继续可用。

```ts
const payload = await invoke<ArrayBuffer>("generate_document_pdf", {
  document: {
    page: {
      paper: { kind: "a5" },
      binding: "left",
      margins: { headerMm: 16, footerMm: 16, innerMm: 20, outerMm: 8 },
    },
    decorations: {
      header: {
        content: { kind: "text", text: "我的手帐" },
        align: "center",
        style: { sizePt: 10, color: "#333333" },
      },
      footer: { pageNumber: true, align: "outer" },
      innerWatermark: { text: "装订侧" },
      outerWatermark: { text: "base6" },
    },
    imposition: { mode: "none" }, // 可改为 booklet 或 thread，见下文
    sections: [
      { pages: 3, numbered: false, body: { kind: "blank" } },
      {
        pages: 20,
        body: {
          kind: "linear",
          spacingMm: 7.5,
          color: "#9E9E9E",
          lineWidthPt: 0.4,
          // 可选：美式横线本的左侧竖线，贯穿整页高度；null 或省略表示不画。
          marginLine: { xMm: 25, color: "#D96A6A", widthPt: 0.4 },
        },
      },
      {
        pages: 10,
        body: {
          kind: "dots",
          spacingMm: 5,
          columnSpacingMm: 5,
          radiusMm: 0.25,
          color: "#7A7A7A",
          centerColor: "#000000", // 可省略或为 null，表示不画中心点
        },
      },
      {
        pages: 10,
        body: {
          kind: "grid",
          spacingMm: 5,
          color: "#7A9AC9",
          lineWidthPt: 0.2,
        },
        // 本节自己的留白；省略或 null 表示继承 page.margins。
        margins: { headerMm: 20, footerMm: 12, innerMm: 22, outerMm: 10 },
      },
      {
        pages: 10,
        // 方眼罫（复刻 Midori）：几何固定，只开放颜色。
        body: { kind: "hogen", color: "#A9D1AE" },
      },
      {
        // 八分周视图：两周 = 4 页，页数必须等于周数 × 2。
        pages: 4,
        body: {
          kind: "octanWeek",
          startDate: "2026-08-03", // 必须是周一
          endDate: "2026-08-16", // 必须是周日
          dateFormat: "%a %-d",
          weekdayLang: "en",
          titleFormat: "%Y年%-m月",
          weekdayHeaders: "一,二,三,四,五,六,日",
          lineColor: "#7A7A7A",
          textColor: "#000000",
          highlightColor: "#8B0000",
          phaseColor: "#E5B93F",
          lineWidthPt: 0.4,
          lineStyle: "solid", // solid | dashed | dotted | dashDot
          centerGapMm: 2,
          dateSizePt: 10,
        },
      },
    ],
  },
});
```

`sections[].margins` 可省略或为 `null`，表示继承顶层 `page.margins`；给出对象时整块覆盖本节四周边距，纸张与装订方向仍全书共用。`sections[].decorations` 可省略或为 `null`，表示继承顶层 `decorations`；给出对象时整块覆盖（页头、页脚、两侧水印一起替换），字段形状与顶层相同。前端编辑器只保存与全书不同的项，生成前再合并成完整对象，因此未修改的项会实时跟随全书设置。`decorations.header/footer.pageNumber` 只控制是否绘制页码，页码是否消耗由 `section.numbered` 决定。

响应维持原二进制协议：`[u32 log_len LE][log UTF-8][u32 tex_len LE][tex UTF-8][PDF bytes]`。

默认纸张 A5、左装订。边距按 archive 的谐和规则由纸张尺寸推导：装订边为宽 × 9%（≥8mm）、外侧为宽 × 12%（≥7mm）、页头为高 × 7%（≥6mm）、页脚为高 × 9%（≥8mm）；A5 即页头 15、页脚 19、装订 13、外侧 18mm。切换纸张时前端按该规则重算边距，手动修改边距后仍会随换纸重置。默认装饰为空。section 默认 1 页、参与编号、空白页心。页头页脚 `content.kind` 支持 `empty`、`text`、`date`（年/月填写线）；`pageNumber` 可与文字组合，分两行居中排布。对齐支持 `center`、`inner`、`outer`。

颜色使用 `#RRGGBB`；字号 1–72pt；横线间距与方格间距 0.1–1000mm、线宽 0.01–10pt；点阵行距与列距 0.1–1000mm、点半径 0.01–10mm，点色与中心点色均为 `#RRGGBB`。`octanWeek` 把一周拆成两页、每页四格：第 1、3、5… 页放周一/周四/周五，第 2、4、6… 页放周二/周三/周六/周日；每页左上格在第 1 页让给当月与次月的迷你月历，当周日期用高亮色。日期范围必须是完整的周一至周日，`pages` 必须等于周数 × 2（最多 499 周、998 页），否则整份文档被拒绝。格子右上角按日期画近似月相。格式串支持 `%Y`、`%m`、`%-m`、`%d`、`%-d`、`%a`、`%%`；星期短名支持 `zh`、`en`、`ja`。`month` 每月一页、页数等于 `months`（1–120），从 `startMonth`（`YYYY-MM`）连续推进：7 列周一为首、网格交叉处留 0.2mm 缺口，整块日历横放后逆时针旋转 90° 贴到页心，标题竖排在左侧；`showPhase` 控制是否在每天右上角画近似月相。月相与星期表头校验由 `moon.rs`、`common.rs` 提供，八分周视图与本模板共用。`tracker` 是月打卡：每月一页、页数等于 `months`（1–120），从 `startMonth` 连续推进；上表 1–14 日带打卡项列，下表 15–月末，两表左缘用折线箭头按打卡项逐行连接，顶部不封口；每页 `items` 行（1–30）。`daily` 是一日时间轴：从 `startDate` 起每天 `pagesPerDay` 页（1 或 2），页数等于天数 × 每日页数（最多 999 页）；时间轴竖排在装订侧，整点范围 `startHour < endHour`（0–30，可跨午夜），每 15 分钟、30 分钟与整点画不同长度的刻度，整点号写到外侧，再从刻度向外画点线到页缘；日期标题横排在外侧顶部，字号为整点号的 1.5 倍。一天两页时按时间顺序拆成前/后半天，与该页左右装订无关。`sun`（`latitude`/`longitude`/`utcOffsetHours`/`daylightColor`/`nightColor`）开启时用太阳高度角决定每段轴线的颜色，日出日落取 -0.833°；时区只接受数值偏移，不引入时区数据库。整页与月历一样横放后逆时针旋转 90°，竖线不过表头、交叉处留 0.2mm 缺口，格线由 `table.rs` 的 `TableGrid` 统一绘制，月历与月打卡共用。点阵相对页心居中排布，`centerColor` 与 `color` 相同时中心点并入点阵图案。方格与横线、点阵一致，从页心中心向四周等距扩展，最外侧格线自然收口成边框。`hogen` 复刻 Midori 方眼罫：5mm 格、横线下方 1mm 断口、隔线外伸 1.2mm、每 10 格在页缘画标记点；5mm 格距、1mm 断口、1.2mm 外伸、0.7pt 线宽与标记点位置全部固定，只开放线色。整块格线同样以页心中心为对称点，四周预留 2.2mm 给外伸线与标记点。横线、点阵、方格与方眼罫都用 PGF 平铺 pattern 一次填充格线区域，同名 pattern 全文档只声明一次：逐线/逐点输出在极小行距或数百页时会耗尽 TeX 内存。方眼罫只有页缘的外伸线与标记点逐页输出，每页约 44 条短线加数十个点，与页数线性增长。横线与点阵一致，以页心中心为对称点等距铺开，上下余量对称。`linear` 可选 `marginLine`（`xMm`、`color`、`widthPt`）画出美式横线本左侧竖线：距纸张左缘 `xMm`，从纸张上缘贯穿到下缘，不裁剪到页心或页头页脚区域；省略或 `null` 表示不画。纸张宽高 30–1000mm，扣除留白后的页心宽高至少 1mm。全书与单节输入阅读页数均限制为 1–999，不含拼版尾部补白。无效数值、非有限数值和未知 JSON 字段会被拒绝。用户文字作为普通文字转义，不接受 LaTeX 代码；换行和制表符转为空格。

## 骑马订与锁线分帖

纸张尺寸始终指折叠后的成品阅读页。默认 `imposition: {"mode":"none"}`，输出仍为阅读顺序的单页 PDF。旧调用省略此字段即可。

```json
{ "imposition": { "mode": "booklet" } }
```

骑马订将整本视为一帖，尾部补齐到 4 的倍数。8 页左装订的印刷顺序为 `[8,1]`、`[2,7]`、`[6,3]`、`[4,5]`；相邻两个 PDF 页面是一张纸的正、反面，纸张从外到内输出。

```json
{ "imposition": { "mode": "thread", "sheetsPerSignature": 4 } }
```

锁线按帖连续分组，每张纸对折后对应 4 个阅读页。`sheetsPerSignature` 范围为 1–250，省略时默认 4（每帖 16 页）。各帖保持相同纸张数，最后一帖不足时在全书末尾补白。section 边界不分帖，也不插白或重置全书页序。

例如全书 10 页、每帖 2 张纸：第一帖阅读页 1–8，第二帖为 9、10 加 6 页补白；输出 4 张纸、8 个印刷面。补白是完全空白，不绘制页心、页头页脚、水印或页码，也不消耗显示页码。

左右装订都支持：`page.binding: "right"` 时交换每个印刷面的左右两半，阅读页本身的布局已在前一步按右装订解析。输出不缩放、不旋转，纸面宽度为成品宽度的两倍，高度不变。A5 成品输出 296×210mm，不强制拉伸到 A4。

打印时使用原尺寸、每张 1 个 PDF 页面、双面打印；保留空白面，不再启用打印驱动的小册子配页。常见的横向输出使用短边翻转；自定义尺寸若使输出变为纵向，则使用长边翻转。纸张翻转由打印驱动完成，引擎输出的两面内容均保持正向。本次不包含纸厚补偿或多折拼版。

`plan_output` 提供：

- `width_mm`、`height_mm`：实际 PDF 纸面尺寸。
- `padded_blank_pages`、`sheet_count`、`signature_count`：补白页、纸张数、帖数；未拼版时后二者为 0。
- `pages()`：印刷面序列，每面有左右 `placements`。`physical_page: None` 表示补白；`x_mm` 为阅读页在纸面上的水平偏移。
- `sheet`：帖索引、帖内纸张索引和 `Front`／`Back`，索引从 0 开始；阅读页输出时为 `None`。

新配置继续通过原 `generate_document_pdf({document})` 使用，二进制响应协议保持不变。

## 添加页心模板

1. 定义模板参数及默认值，在 `BodyTemplate` 中注册 serde 变体。
2. 在 `validate` 中校验一次模板参数。
3. 在 `draw` 中使用传入的页心区域和 `PageContext` 绘制。模板不重算全书页序或装订侧；需要左右差异时，读取传入布局中的 `binding_side`。
4. 增加模板行为测试和真实 PDF 编译样例。
5. 成百上千条同色同线宽的短线用 `Canvas::line_batch` 合并成一条 TikZ 路径，不要逐条 `line`；月相等圆弧轮廓用 `Canvas::filled_outline`，角度按画布坐标（y 向下）给，输出时会转成 PGF 的页面角度。

当前所有 section 共享纸张与装订方向；四周边距、页头、页脚与水印可按节覆盖，未覆盖的项继承全书。覆盖在编排层统一解析：`plan_document` 为每个 section 计算有效的 `PageSettings`，`render_page` 用有效的 `Decorations`，各组件不各自继承配置。

## 输出体积与颜色作用域

生成器会压缩重复的 TeX 输出，视觉结果不变：

- 同一 `begin_region`／`end_region` 内，相邻图元同色时只发一次 `\definecolor{ink}`。`\definecolor` 默认是 TeX 组内定义，所以退出 scope 时会恢复进入前的颜色状态，换 scope 后必须重新定义。
- `TableGrid` 的格线、方眼罫外伸线等大量同色同线宽实线合并成一条 `\draw` 的多个子路径，选项和颜色只解析一次。
- 月相亮面用两段 `arc`（半圆 + 椭圆明暗界线）表示，不再逐点采样多边形；半径与起点坐标保留 3 位小数（1 微米）即可。
- PGF 的 `arc` 角度按页面坐标（y 向上）解释，不受 TikZ `y=-1mm` 影响；画布角度 y 向下，输出时取负，否则弧会翻到圆心另一侧。

## 验证

```sh
cargo test --manifest-path src-tauri/Cargo.toml --lib --test document_framework --test imposition
cargo test --manifest-path src-tauri/Cargo.toml --test e2e_document --test e2e_lined --test e2e_imposition
python scripts/check-framework-sample.py # 可选，需要 Ghostscript，核对实际 PDF 页序与文字位置
python scripts/check-imposition-samples.py # 核对三种拼版的实际左右配页、补白、纸面尺寸和水印方向
```

端到端测试依赖已预热的 `build/prewarm-work/tectonic-cache`，生成 `build/framework-sample.pdf` 和 `.tex`，以及原横线本、骑马订、锁线、右装订样例。实施记录见 `latex-framework-worklog.md`。
