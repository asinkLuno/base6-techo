# base6-techo

可打印横线笔记本生成器。生成整本可直接打印的 PDF。

所有尺寸统一 mm（线宽/字号 pt），数据层不保存 px。架构三级，每级一个模块；`basic` 和 `midori` 是并列版式子命令：

```
版式 basic.py / midori.py: Pattern(参数) + draw(坐标) → [Line, Dot]
  ↓
页面 pages.py: render_page → PageDraw（奇偶镜像几何 + 版式 + 逻辑页码）
  ↓
整本PDF imposition.py: 顺序输出 → latex.py: TikZ → .tex (+ PDF)
  ↓
PDF后处理 pdfops.py: merge 合并 / blank 补白页 / impose 拼版（booklet/线装）
```

关键语义：

- 页数 = 成品笔记本页数（非纸张数）；拼版（impose）时 booklet 按 4 页补齐，线装本按每组 `4 × 张数` 页补齐，补页无页码
- 奇偶页自动镜像装订侧；页码属于逻辑页面，在渲染时生成（footer ≥ 5mm 才允许开页码）
- 横线不铺满拉伸：间距 8mm 打印出来就是 8mm
- 补白页和拼版针对已生成的 PDF：先 render 出单页 PDF，再用 `blank` / `impose` 处理

## 用法

```sh
# 图形界面（选版式联动显示参数，页面尺寸带 A5/A6/B5/B6 等预设）
uv run base6-techo-gui

# 配置 basic 版式（`lines` 保留为兼容命令，`basic` 是同级别名称）
uv run base6-techo basic --hlines --spacing 8

# 配置 Midori 版式
uv run base6-techo midori --reset --spacing 5 --gap 1 --edge-extension 1.2

# 普通顺序 PDF
uv run base6-techo render --width 148 --height 210 --pages 30 --pdf midori out.tex

# 给 PDF 补白页（首页/末尾插入空白页）
uv run base6-techo blank out.pdf blanked.pdf --leading 2 --trailing 1

# 合并多个 PDF
uv run base6-techo merge a.pdf b.pdf merged.pdf

# 小册子拼版：双面打印 → 叠放 → 对折（自动补白到 4 页倍数）
uv run base6-techo impose out.pdf booklet.pdf --mode booklet

# 线装本拼版：每 4 张纸一组，双面打印后每组叠放、对折、线装
uv run base6-techo impose out.pdf thread.pdf --mode thread --sheets-per-group 4

# 在装订侧正中心纵向打印一排或两排页面水印（奇偶页自动镜像到实际装订侧）
uv run base6-techo render --width 148 --height 210 --binding-text base-6 --binding-text-2 notebook --binding-text-size 10 --binding-text-2-size 8 --binding-text-spacing 12 --pdf basic out.tex
```

生成 `out.tex`；`--pdf` 自动调用 tectonic/xelatex/pdflatex 编译出同名 PDF。
页眉日期可用 `--header-date-position center|binding|outer` 选择居中/装订侧/非装订侧（奇偶页自动镜像），用 `--header-date-size` 设字号（pt），用 `--header-date-font` 设字体（默认跟随 `--page-number-font`）。
`--no-page-number` 可关页码；`--page-number-font` 设置页码字体，`--binding-text-font` 设置水印字体（传字体名时使用 XeLaTeX，传 `\\rmfamily` / `\\ttfamily` 等 LaTeX 声明时无需指定字体文件）；`--binding-text` / `--binding-text-2` 可设置装订侧一到两排水印，分别用 `--binding-text-size` / `--binding-text-2-size` 设置字号，用 `--binding-text-spacing` 设置两排中心间距（mm）；非法参数（如 footer\<5mm 开页码、页数超限）会被拒绝。
basic 样式由 `basic`（兼容命令 `lines`）管理，Midori 样式由 `midori` 管理；`render --pattern basic|midori` 选择实际版式。两种版式都只在各自的 header/footer/inner/outer 范围绘制，页码和 binding 水印仍可独立绘制到页脚和装订侧。

## 样例版式

每种样例都是独立完整配置（--reset 清掉旧值）；先用 `lines` 配置，再跑 `render`。
也可以直接跑 `examples/*.sh` 一键生成 PDF（A5 · 32 页，均带页码及 `[base-6]` / `since 2026` 水印）：

```sh
sh examples/dot-grid.sh       # 纯点阵
sh examples/ruled.sh          # 横线本（顶底加粗）
sh examples/dot-line.sh       # 国誉点线本
sh examples/us-notebook.sh    # 美式笔记本
sh examples/french-ruled.sh   # 法文格
sh examples/square-grid.sh    # 基础 5mm 方格
sh examples/midori.sh          # Midori 方格
```

```sh
# 纯点阵：只画点不画线
uv run base6-techo lines --reset --dots --dot-spacing 5 --dot-radius 0.22 --line-color '#A8BBC8'

# 横线本：低饱和蓝灰横线，顶底线略加重
uv run base6-techo lines --reset --hlines --spacing 9 --line-width 0.15 --line-color '#9DB7C8' --hline-edge-width 0.35

# 国誉点线本：横线上叠等距的点（点落在每条线上）
uv run base6-techo lines --reset --hlines --dots --spacing 9 --dot-spacing 10 --line-width 0.15 --line-color '#9DB7C8' --dot-radius 0.22

# 美式笔记本（college ruled）：7.1mm 横线 + 左侧红色竖边线
uv run base6-techo lines --reset --hlines --vlines --hline-inner --hline-outer --vline-header --vline-footer --spacing 7.1 --line-width 0.15 --line-color '#9DB7C8' --margin-x 17 --margin-color '#C98F8F' --vline-edge-width 0.35

# 法文格（Seyes）：左侧宽边栏，之后为 2×8mm 等分格
uv run base6-techo lines --reset --hlines --vlines --hline-inner --hline-outer --vline-header --vline-footer --spacing 2 --margin-x 15 --vline-spacing 8 --line-width 0.12 --line-color '#A7C5D8' --margin-color '#88AEC7' --vline-edge-color '#C98F8F' --vline-edge-width 0.35
uv run base6-techo render --width 148 --height 210 --binding 15 --non-binding 15 --pages 32 --binding-text '[base-6]' --binding-text-2 'since 2026' --binding-text-font '0xProto Nerd Font' --pdf basic examples/french-ruled.tex

# 方格：5mm 横纵网格，保留 10mm 页头/页尾；A5 内容区 120×190mm，均为 5 的偶数倍
uv run base6-techo lines --reset --hlines --vlines --spacing 5 --vline-spacing 5 --line-width 0.12 --line-color '#A8BBC8' --margin-color '#A8BBC8'
uv run base6-techo render --width 148 --height 210 --header 10 --footer 10 --binding 15 --non-binding 13 --pages 32 --binding-text '[base-6]' --binding-text-2 'since 2026' --binding-text-font '0xProto Nerd Font' --pdf basic examples/square-grid.tex
```

## 测试

```sh
uv run pytest
```
