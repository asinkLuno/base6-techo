#!/bin/sh
# 方格：5mm 横纵网格，保留 10mm 页头/页尾；A5 内容区 120×190mm，均为 5 的偶数倍
set -e
cd "$(dirname "$0")/.."
uv run base6-techo lines --reset --hlines --vlines --spacing 5 --vline-spacing 5 --line-width 0.12 --line-color '#A8BBC8' --margin-color '#A8BBC8'
uv run base6-techo render --preset A5 --header 10 --footer 10 --binding 15 --non-binding 13 --pages 32 --binding-text '[base-6]' --binding-text-2 'since 2026' --binding-text-font '0xProto Nerd Font' --pdf examples/square-grid.tex
