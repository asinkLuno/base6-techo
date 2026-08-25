#!/bin/sh
# Timeline：装订侧 00–26 点轴，页头日期覆盖 2026-09 至 2027-12
set -e
cd "$(dirname "$0")/.."

uv run base6-techo render \
  --size A5 \
  --leading-blank \
  --header-date-range 2026-09 2026-10 \
  --header-pages even \
  --binding-text '[base-6]' --binding-text-2 'since 2026' \
  --header-date-position binding \
  --header-date-size 14 \
  --pdf \
  timeline \
  --start 0 \
  --end 26 \
  --split-pages 2 \
  --color '#7A7A7A' \
  examples/timeline.tex

# 线装本拼版：每 4 张纸一组（自动补白到 16 页倍数）
uv run base6-techo impose examples/timeline.pdf /tmp/timeline.thread.pdf --mode thread --sheets-per-group 4
mv /tmp/timeline.thread.pdf examples/timeline.pdf
