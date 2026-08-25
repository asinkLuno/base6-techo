# base6-techo

可打印横线笔记本生成器。生成整本可直接打印的 PDF。

所有尺寸统一 mm（线宽/字号 pt），数据层不保存 px。架构三级，每级一个模块：

```
版式 basic.py: BasicPattern(参数) + draw(坐标) → [Line, Dot]
  ↓
页面 pages.py: render_page → PageDraw（奇偶镜像几何 + 版式 + 逻辑页码）
  ↓
整本PDF imposition.py: normal/booklet 拼版 → latex.py: TikZ → .tex (+ PDF)
```

关键语义：

- 页数 = 成品笔记本页数（非纸张数）；小册子自动补齐到 4 的倍数，补页无页码
- 奇偶页自动镜像装订侧；页码属于逻辑页面，在拼版之前生成（footer ≥ 5mm 才允许开页码）
- 横线不铺满拉伸：间距 8mm 打印出来就是 8mm

## 用法

```sh
# 配置版式（横线/竖线/点默认全关，显式开启；保存到用户配置目录，render 自动读取）
uv run base6-techo lines            # 查看当前版式配置

# 30 页 A5 小册子（双面打印 → 叠放 → 对折）
uv run base6-techo render --preset A5 --pages 30 --mode booklet --pdf out.tex

# 普通顺序 PDF
uv run base6-techo render --preset A5 --pages 30 --mode normal --pdf out.tex
```

生成 `out.tex`；`--pdf` 自动调用 tectonic/xelatex/pdflatex 编译出同名 PDF。
纸张预设只是自动填写宽高；`--no-page-number` 可关页码；非法参数（如 footer\<5mm 开页码、页数超限）会被拒绝。
横线/圆点样式统一由 `lines` 子命令管理，`render` 不再接收线宽等参数。

## 样例版式

每种样例都是独立完整配置（--reset 清掉旧值）；先用 `lines` 配置，再跑 `render`。
也可以直接跑 `examples/*.sh` 一键生成 PDF（A5 · 32 页）：

```sh
sh examples/dot-grid.sh       # 纯点阵
sh examples/ruled.sh          # 横线本（顶底加粗）
sh examples/dot-line.sh       # 国誉点线本
sh examples/us-notebook.sh    # 美式笔记本
sh examples/french-ruled.sh   # 法文格
```

```sh
# 纯点阵：只画点不画线
uv run base6-techo lines --reset --dots --dot-spacing 5

# 横线本：最上面和最下面的线加粗（顶底线宽 0.5pt，其余 0.2pt）
uv run base6-techo lines --reset --hlines --spacing 8 --hline-edge-width 0.5

# 国誉点线本：横线上叠等距的点（点落在每条线上）
uv run base6-techo lines --reset --hlines --dots --spacing 8 --dot-spacing 10

# 美式笔记本（college ruled）：7.1mm 横线 + 左侧红色竖边线
uv run base6-techo lines --reset --hlines --vlines --hline-inner --hline-outer --vline-header --vline-footer --spacing 7.1 --line-width 0.2 --line-color '#B0B0B0' --margin-x 17 --margin-color '#CC0000' --vline-edge-width 0.5

# 法文格（Seyes）：2mm 密横线 + 8mm 竖格，最左竖线红色
uv run base6-techo lines --reset --hlines --vlines --hline-inner --hline-outer --vline-header --vline-footer --spacing 2 --vline-spacing 8 --line-width 0.15 --line-color '#7BAFD4' --margin-color '#7BAFD4' --vline-edge-color '#CC0000' --vline-edge-width 0.5
```

## 测试

```sh
uv run pytest
```
