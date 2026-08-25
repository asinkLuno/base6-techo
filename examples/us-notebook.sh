#!/bin/sh
# 美式笔记本：college ruled 横线（7.1mm）+ 左侧红色竖边线
set -e
cd "$(dirname "$0")/.."
uv run base6-techo lines --reset --hlines --vlines --hline-inner --hline-outer --vline-header --vline-footer --spacing 7.1 --line-width 0.15 --line-color '#9DB7C8' --margin-x 17 --margin-color '#C98F8F' --vline-edge-width 0.35
uv run base6-techo render --width 148 --height 210 --pages 32 --binding-text '[base-6]' --binding-text-2 'since 2026' --binding-text-font '0xProto Nerd Font' --pdf basic examples/us-notebook.tex
