#!/bin/sh
# Timeline：装订侧 00–26 点轴，页头日期覆盖 2026-09 至 2026-10
set -e
cd "$(dirname "$0")/.."

uv run base6-techo render \
  --size A5 \
  --header 20 \
  --footer 10 \
  --binding 20 \
  --non-binding 10 \
  --leading-blank \
  --header-date-range 2026-09 2026-10 \
  --header-pages even \
  --header-locale zh_CN \
  --header-date-format 'yyyy年M月d日（EEEE）' \
  --header-date-position outer \
  --header-date-size 16 \
  --header-date-font '0xProto Nerd Font' \
  --binding-text '[base-6]' \
  --binding-text-2 'since 2026' \
  --binding-text-size 6.5 \
  --binding-text-2-size 5.5 \
  --binding-text-spacing 4.5 \
  --binding-text-font '0xProto Nerd Font' \
  --pdf \
  timeline \
  --start 0 \
  --end 26 \
  --split-pages 2 \
  --color '#879096' \
  examples/timeline.tex

# 线装本拼版：每 4 张纸一组（自动补白到 16 页倍数）
uv run base6-techo impose examples/timeline.pdf /tmp/timeline.thread.pdf --mode thread --sheets-per-group 4
mv /tmp/timeline.thread.pdf examples/timeline.pdf
