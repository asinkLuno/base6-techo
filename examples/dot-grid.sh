#!/bin/sh
# 纯点阵：只画点不画线
set -e
cd "$(dirname "$0")/.."
uv run base6-techo lines --reset --dots --dot-spacing 5 --dot-radius 0.22 --line-color '#A8BBC8'
uv run base6-techo render --width 148 --height 210 --pages 32 --binding-text '[base-6]' --binding-text-2 'since 2026' --binding-text-font '0xProto Nerd Font' --pdf basic examples/dot-grid.tex
