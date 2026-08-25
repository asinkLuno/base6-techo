#!/bin/sh
# Midori：5mm 方格、交点留空；网格在内容区，页码/水印在页脚和装订侧
set -e
cd "$(dirname "$0")/.."

uv run base6-techo midori --reset \
  --spacing 5 \
  --gap 1 \
  --edge-extension 1.2 \
  --dot-frequency 10 \
  --dot-radius 0.4 \
  --line-width 0.7 \
  --line-color '#7FA6A6' \
  --dot-color '#7FA6A6'

uv run base6-techo render \
  --pattern midori \
  --preset A5 \
  --pages 32 \
  --binding-text '[base-6]' \
  --binding-text-2 'since 2026' \
  --binding-text-spacing 12 \
  --pdf examples/midori.tex
