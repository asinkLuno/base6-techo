#!/bin/sh
# 横线本：低饱和蓝灰横线，顶底线略加重
set -e
cd "$(dirname "$0")/.."
uv run base6-techo lines --reset --hlines --spacing 9 --line-width 0.15 --line-color '#9DB7C8' --hline-edge-width 0.35
uv run base6-techo render --preset A5 --pages 32 --binding-text '[base-6]' --binding-text-2 'since 2026' --binding-text-font '0xProto Nerd Font' --pdf basic examples/ruled.tex
