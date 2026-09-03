#!/usr/bin/env bash
# 生成基础版式的展示样张：
#   - 每个版式 × 3 种尺寸（A5 / A6P / A7）
#   - 首页插空白页，后两页为内容页（构成对页展开）
#   - 装订侧打印 "base6" 字样
#   - 把第 2、3 页转成 PNG，用于展示对页
#
# 依赖：target/debug/techo-pipeline（后端 CLI）、pdftoppm、tectonic
# 用法：
#   ./scripts/gen-examples.sh                     # 全部基础版式 × 3 尺寸
#   ./scripts/gen-examples.sh ruled dots          # 只生成指定版式
#   ./scripts/gen-examples.sh ruled "a5,a7"       # 指定版式 + 指定尺寸
#
# 输出到 examples/<pattern>-<size>.pdf 与 examples/<pattern>-<size>-p{2,3}.png

set -euo pipefail

# ---- 可配置 ----
OUT_DIR="examples"
BIN="target/debug/techo-pipeline"
FONT="Sarasa UI SC"          # 装订侧文字字体（系统已装更纱黑体）
BINDING_TEXT="base6"
RES_DPI=150                  # 对页图片分辨率

# 尺寸表：名称 -> "宽x高"（mm）
declare -A SIZES=(
  [a5]="148 210"
  [a6p]="95 171"
  [a7]="80 120"
)

# 基础版式默认参数（与前端 schema.ts defaults 一致）
pattern_params() {
  local kind="$1"
  case "$kind" in
    ruled)  echo '"kind":"ruled","pages":2,"spacing":8,"color":"#7a7a7a","width":0.2' ;;
    dots)   echo '"kind":"dots","pages":2,"spacing":5,"column_spacing":5,"radius":0.3,"color":"#7a7a7a","center_color":"#000000"' ;;
    grid)   echo '"kind":"grid","pages":2,"spacing":5,"color":"#7a7a7a","width":0.2' ;;
    seyes)  echo '"kind":"seyes","pages":2,"spacing":8,"margin_line":7,"main_color":"#9db0cf","main_width":0.2,"fine_color":"#c5d0e4","fine_width":0.1,"vline_color":"#c5d0e4","vline_width":0.1,"margin_color":"#d96a6a","margin_width":0.4' ;;
    us-ruled) echo '"kind":"us-ruled","pages":2,"spacing":8.7,"rule_color":"#8fb0d8","rule_width":0.2,"margin_x":25,"margin_color":"#d96a6a","margin_width":0.4' ;;
    vertical) echo '"kind":"vertical","pages":2,"spacing":10,"color":"#000000","frame_outer_width":0.5,"frame_inner_width":0.18,"frame_gap":1.2' ;;
    *) echo "" >&2; return 1 ;;
  esac
}

# 根据纸张尺寸计算和谐的页边距（mm）——书卷式比例：
# 根据纸张尺寸计算和谐的页边距（mm）——base6 设计准则：
#   Inner(装订) < Outer(非装订)，Head(页头) < Foot(页脚)，
#   视觉重心向书脊 + 页面上方移动（经典书式），但减少留白以加大手写区。
#   比例：装订边=宽×9%（8mm 物理下限），非装订边=宽×12%，
#         页头=高×7%，页脚=高×9%；各设最小值下限，保证小尺寸(A7)不过薄。
margins() {
  local w="$1" h="$2"
  local binding non_binding header footer
  # 装订边：宽×9%，最小 8mm（物理下限）
  binding=$(python3 -c "print(int(max(8, $w*0.09+0.5)))")
  # 非装订边：宽×12%（≈装订边的 4/3，外翻比书脊宽），最小 7mm
  non_binding=$(python3 -c "print(int(max(7, $w*0.12+0.5)))")
  # 页头：高×7%，最小 6mm
  header=$(python3 -c "print(int(max(6, $h*0.07+0.5)))")
  # 页脚：高×9%（比页头宽，压住版面），最小 8mm
  footer=$(python3 -c "print(int(max(8, $h*0.09+0.5)))")
  echo "$binding $non_binding $header $footer"
}


# 生成单个版式的一页 JSON section（含空白首页 + 2 内容页）
build_json() {
  local kind="$1" w="$2" h="$3" size="$4"
  read -r binding non_binding header footer <<< "$(margins "$w" "$h")"
  cat <<EOF
{
  "output": "$OUT_DIR/$kind-$size.pdf",
  "bind": { "mode": null, "sheets_per_group": 4 },
  "sections": [
    { "title": "空白页",
      "page": {"width":$w,"height":$h,"header":$header,"footer":$footer,"binding":$binding,"non_binding":$non_binding},
      "document": {"binding_text":"$BINDING_TEXT","binding_text_font":"$FONT"},
      "pattern": {"kind":"blank","pages":1} },
    { "title": "$kind",
      "page": {"width":$w,"height":$h,"header":$header,"footer":$footer,"binding":$binding,"non_binding":$non_binding},
      "document": {"binding_text":"$BINDING_TEXT","binding_text_font":"$FONT"},
      "pattern": {$(pattern_params "$kind")} }
  ]
}
EOF
}

gen_one() {
  local kind="$1" size="$2" w="$3" h="$4"
  echo ">>> $kind · $size (${w}x${h}mm)"
  build_json "$kind" "$w" "$h" "$size" > "/tmp/ex-$kind-$size.json"
  "$BIN" < "/tmp/ex-$kind-$size.json" >/dev/null
  # 第 2、3 页 → PNG（对页）
  pdftoppm -f 2 -l 3 -png -r "$RES_DPI" "$OUT_DIR/$kind-$size.pdf" "$OUT_DIR/$kind-$size-p"
  echo "    -> $OUT_DIR/$kind-$size.pdf + p2/p3.png"
}

main() {
  mkdir -p "$OUT_DIR"
  [[ -x "$BIN" ]] || { echo "缺少 $BIN，请先 cargo build --bin techo-pipeline"; exit 1; }

  # 参数：未给版式时用全部基础版式；SIZE_ARG 支持 "a5,a7"
  local -a patterns=()
  if (( $# > 0 )); then patterns=("$@"); else patterns=(ruled dots grid seyes us-ruled vertical); fi
  local size_arg="${SIZE_ARG:-a5,a6p,a7}"
  IFS=',' read -r -a sizes <<< "$size_arg"

  for kind in "${patterns[@]}"; do
    pattern_params "$kind" >/dev/null || { echo "未知版式: $kind"; exit 1; }
    for size in "${sizes[@]}"; do
      read -r w h <<< "${SIZES[$size]:-}"
      [[ -n "$w" ]] || { echo "未知尺寸: $size"; exit 1; }
      gen_one "$kind" "$size" "$w" "$h"
    done
  done
  echo "完成。"
}

main "$@"
