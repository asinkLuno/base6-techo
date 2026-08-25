#!/bin/sh
# 横线本：最上面和最下面的线加粗（顶底线宽 0.5pt，其余 0.2pt）
set -e
cd "$(dirname "$0")/.."
uv run base6-techo lines --reset --hlines --spacing 8 --hline-edge-width 0.5
uv run base6-techo render --preset A5 --pages 32 --pdf examples/ruled.tex
