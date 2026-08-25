# base6-techo

可打印横线笔记本生成器。生成整本可直接打印的 PDF。

所有尺寸统一 mm（线宽/字号 pt），数据层不保存 px。架构：

```
PageSettings + RuledPattern + DocumentSettings(pageCount, showPageNumber)
    → Page Renderer（奇偶镜像 + 横线 + 逻辑页码）→ PageDraw
    → Imposition（normal：1页1PDF页 / booklet：鞍式拼版 2W×H）
    → LaTeX Renderer (PDF) / SVG Renderer (预览)
```

关键语义：

- 页数 = 成品笔记本页数（非纸张数）；小册子自动补齐到 4 的倍数，补页无页码
- 奇偶页自动镜像装订侧；页码属于逻辑页面，在拼版之前生成（footer ≥ 5mm 才允许开页码）
- 横线不铺满拉伸：间距 8mm 打印出来就是 8mm

## 用法

```sh
# 30 页 A5 小册子（双面打印 → 叠放 → 对折）
uv run base6-techo render --preset A5 --pages 30 --mode booklet --pdf out.tex

# 普通顺序 PDF
uv run base6-techo render --preset A5 --pages 30 --mode normal --pdf out.tex
```

生成 `out.tex`；`--pdf` 自动调用 tectonic/xelatex/pdflatex 编译出同名 PDF。
纸张预设只是自动填写宽高；`--no-page-number` 可关页码；非法参数（如 footer\<5mm 开页码、页数超限）会被拒绝。

## 测试

```sh
uv run pytest
```
