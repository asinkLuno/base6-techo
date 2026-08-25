#!/bin/sh
# Timeline：装订侧 00–26 点轴，页头日期覆盖 2026-09 至 2027-12
set -e
cd "$(dirname "$0")/.."

uv run base6-techo timeline \
  --size A5 \
  --start 0 \
  --end 26 \
  --pages 2 \
  --header-date-range 2026-09 2026-12 \
  --header-pages even \
  --color '#7A7A7A' \
  --pdf \
  examples/timeline.tex

# 首页补一页空白
uv run base6-techo blank examples/timeline.pdf /tmp/timeline.blank.pdf --leading 1
mv /tmp/timeline.blank.pdf examples/timeline.pdf

# 线装本拼版：每 4 张纸一组（自动补白到 16 页倍数）
uv run base6-techo impose examples/timeline.pdf /tmp/timeline.thread.pdf --mode thread --sheets-per-group 4
mv /tmp/timeline.thread.pdf examples/timeline.pdf
