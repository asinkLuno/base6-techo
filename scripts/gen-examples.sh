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
    octan-week) echo '"kind":"八分周视图","start_date":"2026-08-31","end_date":"2026-09-06","date_format":"%-d","date_locale":"zh-CN","weekday_lang":"zh","title_format":"%Y年%-m月","weekday_headers":"一,二,三,四,五,六,日","line_color":"#7a7a7a","line_width":0.4,"line_style":"solid","center_gap":2,"date_size":10' ;;
    hogen) echo '"kind":"方眼罫","pages":2,"line_color":"#a9d1ae"' ;;
    hakubunkan-toyo-nikki) echo '"kind":"hakubunkan-toyo-nikki","start_date":"2026-09-01","end_date":"2026-09-02","date_format":"%-m月%-d日","line_color":"#a9d1ae","line_width":0.8' ;;
    hakubunkan-kaichu-nikki) echo '"kind":"hakubunkan-kaichu-nikki","start_date":"2026-09-01","end_date":"2026-09-04","date_format":"%-m 月  %-d 日","date_locale":"zh-CN","weekday_headers":"月,火,水,木,金,土,日","lunar_style":"numeric","line_color":"#7a7a7a","line_width":0.4,"date_size":10' ;;
    *) echo "" >&2; return 1 ;;
  esac
}

# 装订水印颜色：当用日记 / 方眼罫用主线玉色，其余版式保持默认灰（后端缺省）。
watermark_color_for() {
  local kind="$1"
  case "$kind" in
    hakubunkan-toyo-nikki|hogen) echo "#a9d1ae" ;;
    *) echo "" ;;
  esac
}

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
  # 装订水印颜色：为空则不输出字段（走后端默认灰）。
  local wc
  wc=$(watermark_color_for "$kind")
  local wc_json=""
  [[ -n "$wc" ]] && wc_json=",\"binding_text_color\":\"$wc\""
  cat <<EOF
{
  "output": "$OUT_DIR/$kind-$size.pdf",
  "bind": { "mode": null, "sheets_per_group": 4 },
  "sections": [
    { "title": "空白页",
      "page": {"width":$w,"height":$h,"header":$header,"footer":$footer,"binding":$binding,"non_binding":$non_binding},
      "document": {"binding_text":"$BINDING_TEXT"$wc_json,"binding_text_font":"$FONT"},
      "pattern": {"kind":"blank","pages":1} },
    { "title": "$kind",
      "page": {"width":$w,"height":$h,"header":$header,"footer":$footer,"binding":$binding,"non_binding":$non_binding},
      "document": {"binding_text":"$BINDING_TEXT"$wc_json,"binding_text_font":"$FONT"},
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

# ---- 月历（month）：按尺寸选择单/双页，按版本开关农历与节假日 ----
MONTH_HOLIDAYS="examples/ics/holidays-2026.json"

# 月历 section JSON：空白首叶 + 2 内容页对页。
# two_page: A7 双页（周一~三 / 周四~日），A5/A6P 单页（连续两月）。
# variant: plain=不开农历/节假日；holiday=开农历+节假日并注入 holidays。
# 月历 section 面JSON。单页版输出单个月历（1 页），双页版输出空白首叶 + 双页月历（3 页）。
build_month_json() {
  local w="$1" h="$2" size="$3" variant="$4"
  read -r binding non_binding header footer <<< "$(margins "$w" "$h")"
  local lunar show_holidays holidays_json=""
  if [[ "$variant" == "holiday" ]]; then
    lunar="true"; show_holidays="true"
    holidays_json=",\"holidays\":$(cat "$MONTH_HOLIDAYS")"
  else
    lunar="false"; show_holidays="false"
  fi
  local mpat='"kind":"month-calendar","phase_color":"#e5b93f","line_color":"#7a7a7a","line_width":0.4,"date_size":8,"weekday_headers":"Mo,Tu,We,Th,Fr,Sa,Su","title_format":"%Y年%-m月","show_holidays":'$show_holidays',"sub_size":4.2,"sub_gap":0,"lunar":'$lunar
  local page='"page":{"width":'$w',"height":'$h',"header":'$header',"footer":'$footer',"binding":'$binding',"non_binding":'$non_binding'}'
  local doc='"document":{"binding_text":"'$BINDING_TEXT'","binding_text_font":"'$FONT'"}'
  mkdir -p "$OUT_DIR"
  {
    echo '{'
    echo '  "output": "'$OUT_DIR'/month-'$size'-'$variant'.pdf",'
    echo '  "bind": { "mode": null, "sheets_per_group": 4 },'
    echo '  "sections": ['
    if [[ "$size" == "a7" ]]; then
      # 双页：空白首叶 + 同一月拆两页（周一~三 / 周四~日）
      echo '    { "title": "空白页", '$page', '$doc', "pattern": {"kind":"blank","pages":1} },'
      echo '    { "title": "月历", '$page', '$doc', "pattern": {'$mpat',"two_page":true,"year":2026,"month":1}'$holidays_json' }'
    else
      # 单页：单个月历（1 页）
      echo '    { "title": "月历", '$page', '$doc', "pattern": {'$mpat',"two_page":false,"year":2026,"month":1}'$holidays_json' }'
    fi
    echo '  ]'
    echo '}'
  } > "/tmp/ex-month-$size-$variant.json"
}

gen_month_all() {
  for size in "${MONTH_SIZES[@]:-a5 a6p a7}"; do
    read -r w h <<< "${SIZES[$size]:-}"
    [[ -n "$w" ]] || { echo "未知尺寸: $size"; continue; }
    for variant in plain holiday; do
      echo ">>> month · $size · $variant"
      build_month_json "$w" "$h" "$size" "$variant" > "/tmp/ex-month-$size-$variant.json"
      "$BIN" < "/tmp/ex-month-$size-$variant.json" >/dev/null
      if [[ "$size" == "a7" ]]; then
        pdftoppm -f 2 -l 3 -png -r "$RES_DPI" "$OUT_DIR/month-$size-$variant.pdf" "$OUT_DIR/month-$size-$variant-p"
        echo "    -> $OUT_DIR/month-$size-$variant.pdf + p2/p3.png"
      else
        pdftoppm -f 1 -l 1 -png -r "$RES_DPI" "$OUT_DIR/month-$size-$variant.pdf" "$OUT_DIR/month-$size-$variant"
        mv -f "$OUT_DIR/month-$size-$variant-1.png" "$OUT_DIR/month-$size-$variant.png"
        echo "    -> $OUT_DIR/month-$size-$variant.pdf + single.png"
      fi
    done
  done
}

# ---- 年历（year）：全 2026，按尺寸选单/双页，按版本开关农历与节假日 ----
YEAR_HOLIDAYS="examples/ics/holidays-2026.json"

# 年历 section JSON。
# rows×cols：a5/a6p 单页整年（3×4=12 月一页）；a7 双页视图（3×2=6 月/页，左页 1-6 月 / 右页 7-12 月拼全年）。
# variant: plain=不开农历/节假日；holiday=开农历+节假日并注入 holidays。
build_year_json() {
  local w="$1" h="$2" size="$3" variant="$4"
  read -r binding non_binding header footer <<< "$(margins "$w" "$h")"
  local lunar show_holidays holidays_json=""
  if [[ "$variant" == "holiday" ]]; then
    lunar="true"; show_holidays="true"
    holidays_json=",\"holidays\":$(cat "$YEAR_HOLIDAYS")"
  else
    lunar="false"; show_holidays="false"
  fi
  local rows cols
  if [[ "$size" == "a7" ]]; then
    rows=3; cols=2   # 6 个月/页，双页拼全年
  else
    rows=3; cols=4   # 12 个月单页整年
  fi
  local ypat='"kind":"year-calendar","start":"2026-01","end":"2026-12","rows":'$rows',"cols":'$cols',"date_size":6,"weekday_lang":"zh","title_format":"%Y年%-m月","weekday_headers":"一,二,三,四,五,六,日","show_holidays":'$show_holidays',"lunar":'$lunar
  local page='"page":{"width":'$w',"height":'$h',"header":'$header',"footer":'$footer',"binding":'$binding',"non_binding":'$non_binding'}'
  local doc='"document":{"binding_text":"'$BINDING_TEXT'","binding_text_font":"'$FONT'"}'
  mkdir -p "$OUT_DIR"
  {
    echo '{'
    echo '  "output": "'$OUT_DIR'/year-'$size'-'$variant'.pdf",'
    echo '  "bind": { "mode": null, "sheets_per_group": 4 },'
    echo '  "sections": ['
    if [[ "$size" == "a7" ]]; then
      # 双页：空白首叶 + 相邻两页（左 1-6 月 / 右 7-12 月）拼全年
      echo '    { "title": "空白页", '$page', '$doc', "pattern": {"kind":"blank","pages":1} },'
      echo '    { "title": "年历", '$page', '$doc', "pattern": {'$ypat'}'$holidays_json' }'
    else
      # 单页：整年一页
      echo '    { "title": "年历", '$page', '$doc', "pattern": {'$ypat'}'$holidays_json' }'
    fi
    echo '  ]'
    echo '}'
  } > "/tmp/ex-year-$size-$variant.json"
}

gen_year_all() {
  for size in "${YEAR_SIZES[@]:-a5 a6p a7}"; do
    read -r w h <<< "${SIZES[$size]:-}"
    [[ -n "$w" ]] || { echo "未知尺寸: $size"; continue; }
    for variant in plain holiday; do
      echo ">>> year · $size · $variant"
      build_year_json "$w" "$h" "$size" "$variant" > "/tmp/ex-year-$size-$variant.json"
      "$BIN" < "/tmp/ex-year-$size-$variant.json" >/dev/null
      if [[ "$size" == "a7" ]]; then
        pdftoppm -f 2 -l 3 -png -r "$RES_DPI" "$OUT_DIR/year-$size-$variant.pdf" "$OUT_DIR/year-$size-$variant-p"
        echo "    -> $OUT_DIR/year-$size-$variant.pdf + p2/p3.png"
      else
        pdftoppm -singlefile -f 1 -l 1 -png -r "$RES_DPI" "$OUT_DIR/year-$size-$variant.pdf" "$OUT_DIR/year-$size-$variant"
        echo "    -> $OUT_DIR/year-$size-$variant.pdf + single.png"
      fi
    done
  done
}


# ---- 年度追踪（month-tracker）：A5/A6P 单页（整年平铺），A7 双页（1-15/16-31）----
build_monthtracker_json() {
  local w="$1" h="$2" size="$3"
  read -r binding non_binding header footer <<< "$(margins "$w" "$h")"
  local two_page="false"
  [[ "$size" == "a7" ]] && two_page="true"
  local mpat='"kind":"year-tracker","start":"2026-01","end":"2026-12","two_page":'$two_page',"line_color":"#7a7a7a","line_width":0.4,"date_size":8'
  local page='"page":{"width":'$w',"height":'$h',"header":'$header',"footer":'$footer',"binding":'$binding',"non_binding":'$non_binding'}'
  local doc='"document":{"binding_text":"'$BINDING_TEXT'","binding_text_font":"'$FONT'"}'
  mkdir -p "$OUT_DIR"
  {
    echo '{'
    echo '  "output": "'$OUT_DIR'/monthtracker-'$size'.pdf",'
    echo '  "bind": { "mode": null, "sheets_per_group": 4 },'
    echo '  "sections": ['
    if [[ "$size" == "a7" ]]; then
      echo '    { "title": "空白页", '$page', '$doc', "pattern": {"kind":"blank","pages":1} },'
      echo '    { "title": "年度追踪", '$page', '$doc', "pattern": {'$mpat'} }'
    else
      echo '    { "title": "年度追踪", '$page', '$doc', "pattern": {'$mpat'} }'
    fi
    echo '  ]'
    echo '}'
  } > "/tmp/ex-monthtracker-$size.json"
}

gen_monthtracker_all() {
  for size in "${MTRACKER_SIZES[@]:-a5 a6p a7}"; do
    read -r w h <<< "${SIZES[$size]:-}"
    [[ -n "$w" ]] || { echo "未知尺寸: $size"; continue; }
    echo ">>> monthtracker · $size"
    build_monthtracker_json "$w" "$h" "$size" > "/tmp/ex-monthtracker-$size.json"
    "$BIN" < "/tmp/ex-monthtracker-$size.json" >/dev/null
    if [[ "$size" == "a7" ]]; then
      pdftoppm -f 2 -l 3 -png -r "$RES_DPI" "$OUT_DIR/monthtracker-$size.pdf" "$OUT_DIR/monthtracker-$size-p"
      echo "    -> $OUT_DIR/monthtracker-$size.pdf + p2/p3.png"
    else
      pdftoppm -singlefile -f 1 -l 1 -png -r "$RES_DPI" "$OUT_DIR/monthtracker-$size.pdf" "$OUT_DIR/monthtracker-$size"
      echo "    -> $OUT_DIR/monthtracker-$size.pdf + single.png"
    fi
  done
}


main() {
  mkdir -p "$OUT_DIR"
  [[ -x "$BIN" ]] || { echo "缺少 $BIN，请先 cargo build --bin techo-pipeline"; exit 1; }

  # 参数：未给版式时用全部基础版式；SIZE_ARG 支持 "a5,a7"
  local -a patterns=()
  if (( $# > 0 )); then patterns=("$@"); else patterns=(ruled dots grid seyes us-ruled vertical octan-week); fi
  local size_arg="${SIZE_ARG:-a5,a6p,a7}"
  IFS=',' read -r -a sizes <<< "$size_arg"

  for kind in "${patterns[@]}"; do
    if [[ "$kind" == "month-calendar" ]]; then
      MONTH_SIZES=("${sizes[@]}")
      gen_month_all
      continue
    fi
    if [[ "$kind" == "year-calendar" ]]; then
      YEAR_SIZES=("${sizes[@]}")
      gen_year_all
      continue
    fi
    if [[ "$kind" == "monthtracker" ]]; then
      MTRACKER_SIZES=("${sizes[@]}")
      gen_monthtracker_all
      continue
    fi
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
