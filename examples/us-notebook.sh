#!/bin/sh
# 美式笔记本：college ruled 横线（7.1mm）+ 左侧红色竖边线
set -e
cd "$(dirname "$0")/.."
uv run base6-techo lines --reset --hlines --vlines --hline-inner --hline-outer --vline-header --vline-footer --spacing 7.1 --line-width 0.2 --line-color '#B0B0B0' --margin-x 17 --margin-color '#CC0000' --vline-edge-width 0.5
uv run base6-techo render --preset A5 --pages 32 --pdf examples/us-notebook.tex
