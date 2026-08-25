#!/bin/sh
# 纯点阵：只画点不画线
set -e
cd "$(dirname "$0")/.."
uv run base6-techo lines --reset --dots --dot-spacing 5
uv run base6-techo render --preset A5 --pages 32 --pdf examples/dot-grid.tex
