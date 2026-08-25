#!/bin/sh
# 国誉点线本：横线上叠等距的点（点落在每条线上）
set -e
cd "$(dirname "$0")/.."
uv run base6-techo lines --reset --hlines --dots --spacing 8 --dot-spacing 10
uv run base6-techo render --preset A5 --pages 32 --pdf examples/dot-line.tex
