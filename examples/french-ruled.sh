#!/bin/sh
# 法文格（Seyes）：左侧宽边栏，之后为 2×8mm 等分格
set -e
cd "$(dirname "$0")/.."
uv run base6-techo lines --reset --hlines --vlines --hline-inner --hline-outer --vline-header --vline-footer --spacing 2 --margin-x 15 --vline-spacing 8 --line-width 0.12 --line-color '#A7C5D8' --margin-color '#88AEC7' --vline-edge-color '#C98F8F' --vline-edge-width 0.35
uv run base6-techo render --width 148 --height 210 --binding 15 --non-binding 15 --pages 32 --binding-text '[base-6]' --binding-text-2 'since 2026' --binding-text-font '0xProto Nerd Font' --pdf basic examples/french-ruled.tex
