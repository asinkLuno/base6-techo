#!/bin/sh
# 国誉点线本：横线上叠等距的点（点落在每条线上）
set -e
cd "$(dirname "$0")/.."
uv run base6-techo lines --reset --hlines --dots --spacing 9 --dot-spacing 10 --line-width 0.15 --line-color '#9DB7C8' --dot-radius 0.22
uv run base6-techo render --width 148 --height 210 --pages 32 --binding-text '[base-6]' --binding-text-2 'since 2026' --binding-text-font '0xProto Nerd Font' --pdf basic examples/dot-line.tex
