# LaTeX 框架

Rust 入口为 `templates::document::generate_document_latex(&Document)`；`plan_document` 返回只读的页面计划，便于预览和测试。生成器是纯函数，Tectonic 编译由 `compile` 模块负责。`imposition::plan_output(&book)` 在阅读页计划之后生成印刷输出计划。

## 模块与职责

| 模块            | 职责                                                                             |
| --------------- | -------------------------------------------------------------------------------- |
| `document.rs`   | 校验整个文档，遍历 section，生成实际页序、显示页码及节内索引                     |
| `layout.rs`     | 纸张、装订方向、四周留白；统一计算页心、页头、页脚、两侧区域                     |
| `components.rs` | 页头、页脚、装订侧水印、外侧水印                                                 |
| `patterns.rs`   | 页心模板注册与分发，当前为 `blank`、`linear`（兼容别名 `lined`）、`dots`、`grid` |
| `imposition.rs` | 不拼版／骑马订／锁线分帖，补白与纸张正反面配页                                   |
| `latex.rs`      | 按输出计划平移阅读页到印刷面，TikZ 输出、普通文字转义、数字格式化                |
| `lined.rs`      | 原 `LinedDocParams` 和 `generate_lined_latex` 的兼容适配器                       |

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
    ],
  },
});
```

`sections[].margins` 可省略或为 `null`，表示继承顶层 `page.margins`；给出对象时整块覆盖本节四周边距，纸张与装订方向仍全书共用。`sections[].decorations` 可省略或为 `null`，表示继承顶层 `decorations`；给出对象时整块覆盖（页头、页脚、两侧水印一起替换），字段形状与顶层相同。前端编辑器只保存与全书不同的项，生成前再合并成完整对象，因此未修改的项会实时跟随全书设置。`decorations.header/footer.pageNumber` 只控制是否绘制页码，页码是否消耗由 `section.numbered` 决定。

响应维持原二进制协议：`[u32 log_len LE][log UTF-8][u32 tex_len LE][tex UTF-8][PDF bytes]`。

默认纸张 A5、左装订、页头页脚各 16mm、两侧各 18mm。默认装饰为空。section 默认 1 页、参与编号、空白页心。页头页脚 `content.kind` 支持 `empty`、`text`、`date`（年/月填写线）；`pageNumber` 可与文字组合，分两行居中排布。对齐支持 `center`、`inner`、`outer`。

颜色使用 `#RRGGBB`；字号 1–72pt；横线间距与方格间距 0.1–1000mm、线宽 0.01–10pt；点阵行距与列距 0.1–1000mm、点半径 0.01–10mm，点色与中心点色均为 `#RRGGBB`。点阵相对页心居中排布，`centerColor` 与 `color` 相同时中心点并入点阵图案。方格与横线、点阵一致，从页心中心向四周等距扩展，最外侧格线自然收口成边框。横线、点阵与方格都用 PGF 平铺 pattern 一次填充，同名 pattern 全文档只声明一次：逐线/逐点输出在极小行距或数百页时会耗尽 TeX 内存。横线与点阵一致，以页心中心为对称点等距铺开，上下余量对称。纸张宽高 30–1000mm，扣除留白后的页心宽高至少 1mm。全书与单节输入阅读页数均限制为 1–999，不含拼版尾部补白。无效数值、非有限数值和未知 JSON 字段会被拒绝。用户文字作为普通文字转义，不接受 LaTeX 代码；换行和制表符转为空格。

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

当前所有 section 共享纸张与装订方向；四周边距、页头、页脚与水印可按节覆盖，未覆盖的项继承全书。覆盖在编排层统一解析：`plan_document` 为每个 section 计算有效的 `PageSettings`，`render_page` 用有效的 `Decorations`，各组件不各自继承配置。

## 验证

```sh
cargo test --manifest-path src-tauri/Cargo.toml --lib --test document_framework --test imposition
cargo test --manifest-path src-tauri/Cargo.toml --test e2e_document --test e2e_lined --test e2e_imposition
python scripts/check-framework-sample.py # 可选，需要 Ghostscript，核对实际 PDF 页序与文字位置
python scripts/check-imposition-samples.py # 核对三种拼版的实际左右配页、补白、纸面尺寸和水印方向
```

端到端测试依赖已预热的 `build/prewarm-work/tectonic-cache`，生成 `build/framework-sample.pdf` 和 `.tex`，以及原横线本、骑马订、锁线、右装订样例。实施记录见 `latex-framework-worklog.md`。
