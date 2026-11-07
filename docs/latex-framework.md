# LaTeX 框架

Rust 入口为 `templates::document::generate_document_latex(&Document)`；`plan_document` 返回只读的页面计划，便于预览和测试。生成器是纯函数，Tectonic 编译由 `compile` 模块负责。

## 模块与职责

| 模块 | 职责 |
| --- | --- |
| `document.rs` | 校验整个文档，遍历 section，生成实际页序、显示页码及节内索引 |
| `layout.rs` | 纸张、装订方向、四周留白；统一计算页心、页头、页脚、两侧区域 |
| `components.rs` | 页头、页脚、装订侧水印、外侧水印 |
| `patterns.rs` | 页心模板注册与分发，当前为 `blank`、`linear`（兼容别名 `lined`） |
| `latex.rs` | TikZ 输出、普通文字转义、数字格式化 |
| `lined.rs` | 原 `LinedDocParams` 和 `generate_lined_latex` 的兼容适配器 |

## 页序与区域约定

- `physical_page` 从 1 开始，跨 section 连续，包括不显示页码的页。
- `section_index`、`local_index` 从 0 开始。页心模板以后可用它们确定日期等内容。
- `display_number` 独立连续计数；`numbered: false` 的 section 不消耗显示页码。
- 左装订时全书奇数页装订侧在左、偶数页在右；右装订反向。显示页码和模板索引不参与判断。
- 坐标统一使用毫米，原点位于纸张左上角，y 向下。
- `headerMm`、`footerMm` 表示上下区域的完整高度；`innerMm`、`outerMm` 表示两侧区域的宽度。页心扣除四者。页头和页脚与页心同宽，两侧水印区域与页心同高。
- 每个组件裁剪在自己的区域内，超长文字会被裁剪；框架当前不自动换行、缩字或扩展区域。
- 布局在阅读顺序上完成；本次不包含印刷拼版。

## IPC 调用

新增 `generate_document_pdf` 命令，参数名为 `document`。原 `generate_lined_pdf({ params })` 继续可用。

```ts
const payload = await invoke<ArrayBuffer>('generate_document_pdf', {
  document: {
    page: {
      paper: { kind: 'a5' },
      binding: 'left',
      margins: { headerMm: 16, footerMm: 16, innerMm: 20, outerMm: 8 },
    },
    decorations: {
      header: {
        content: { kind: 'text', text: '我的手帐' },
        align: 'center',
        style: { sizePt: 10, color: '#333333' },
      },
      footer: { pageNumber: true, align: 'outer' },
      innerWatermark: { text: '装订侧' },
      outerWatermark: { text: 'base6' },
    },
    sections: [
      { pages: 3, numbered: false, body: { kind: 'blank' } },
      { pages: 20, body: { kind: 'linear', spacingMm: 7.5, color: '#9E9E9E', lineWidthPt: 0.4 } },
    ],
  },
})
```

响应维持原二进制协议：`[u32 log_len LE][log UTF-8][u32 tex_len LE][tex UTF-8][PDF bytes]`。

默认纸张 A5、左装订、页头页脚各 16mm、两侧各 18mm。默认装饰为空。section 默认 1 页、参与编号、空白页心。页头页脚 `content.kind` 支持 `empty`、`text`、`date`（年/月填写线）；`pageNumber` 可与文字组合，分两行居中排布。对齐支持 `center`、`inner`、`outer`。

颜色使用 `#RRGGBB`；字号 1–72pt；横线间距 0.1–1000mm、线宽 0.01–10pt。纸张宽高 30–1000mm，扣除留白后的页心宽高至少 1mm。全书与单节页数均限制为 1–999。无效数值、非有限数值和未知 JSON 字段会被拒绝。用户文字作为普通文字转义，不接受 LaTeX 代码；换行和制表符转为空格。

## 添加页心模板

1. 定义模板参数及默认值，在 `BodyTemplate` 中注册 serde 变体。
2. 在 `validate` 中校验一次模板参数。
3. 在 `draw` 中使用传入的页心区域和 `PageContext` 绘制。模板不重算全书页序或装订侧；需要左右差异时，读取传入布局中的 `binding_side`。
4. 增加模板行为测试和真实 PDF 编译样例。

当前所有 section 共享纸张和装饰。以后若需要每节不同的页头或水印，应增加明确的 section 覆盖配置，再由编排层解析，避免各组件分别继承配置。

## 验证

```sh
cargo test --manifest-path src-tauri/Cargo.toml --lib --test document_framework
cargo test --manifest-path src-tauri/Cargo.toml --test e2e_document --test e2e_lined
python scripts/check-framework-sample.py # 可选，需要 Ghostscript，核对实际 PDF 页序与文字位置
```

端到端测试依赖已预热的 `build/prewarm-work/tectonic-cache`，生成 `build/framework-sample.pdf` 和 `.tex`，以及原横线本样例。实施记录见 `latex-framework-worklog.md`。
