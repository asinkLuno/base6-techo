#!/bin/sh
# 法文格（Seyes）：2mm 密横线 + 8mm 竖格，最左竖线为红色
set -e
cd "$(dirname "$0")/.."
uv run base6-techo lines --reset --hlines --vlines --hline-inner --hline-outer --vline-header --vline-footer --spacing 2 --vline-spacing 8 --line-width 0.15 --line-color '#7BAFD4' --margin-color '#7BAFD4' --vline-edge-color '#CC0000' --vline-edge-width 0.5
uv run base6-techo render --preset A5 --pages 32 --pdf examples/french-ruled.tex
