// 类型、常量与默认值 — 与后端 src-tauri/src/backend 的 serde 结构一一对应。
// 序列化前由 utils.stripNulls 剥掉 null 字段（后端 serde default 落回默认值）。

export type Value = string | number | boolean | null;

export type Values = Record<string, Value>;

export type PatternKind =
  | "dots" | "grid" | "ruled" | "seyes" | "vertical" | "us-ruled"
  | "hakubunkan-toyo-nikki" | "方眼罫" | "八分周视图" | "hakubunkan-kaichu-nikki"
  | "year-calendar" | "month-calendar" | "month-tracker" | "year-tracker" | "graph" | "timeline" | "blank";

export type Section = {
  id: string;
  expanded: boolean;
  headerEnabled: boolean;
  headerMode: "text" | "number";
  footerEnabled: boolean;
  footerMode: "text" | "number";
  pageNumber: boolean;
  watermarkEnabled: boolean;
  page: Values;
  document: Values;
  pattern: Values & { kind: PatternKind };
  nonBindingEnabled: boolean;
};

export const patternNames: Record<PatternKind, string> = {
  dots: "点阵",
  grid: "网格",
  ruled: "横线",
  seyes: "法文格",
  vertical: "古文竖排",
  "us-ruled": "美式横线",
  "hakubunkan-toyo-nikki": "博文館・當用日記",
  "八分周视图": "八分周视图",
  graph: "月追踪制图",
  "hakubunkan-kaichu-nikki": "博文館・懐中日記",
  "方眼罫": "方眼罫",
  "month-calendar": "月历",
  "year-tracker": "年度追踪",
  timeline: "时间轴",
  "month-tracker": "月打卡",
  "year-calendar": "年历",
  blank: "空白页",
};

export type PatternGroup =
  | { label: string; kinds: PatternKind[] }
  | { label: string; subgroups: { label: string; kinds: PatternKind[] }[] };

export const PATTERN_GROUPS: PatternGroup[] = [
  { label: "基础", kinds: ["dots", "grid", "ruled", "seyes", "us-ruled", "vertical", "blank"] },
  { label: "复刻", kinds: ["方眼罫", "hakubunkan-toyo-nikki", "hakubunkan-kaichu-nikki"] },
  {
    label: "日程",
    subgroups: [
      { label: "年", kinds: ["year-calendar", "year-tracker"] },
      { label: "月", kinds: ["month-calendar", "month-tracker", "graph"] },
      { label: "周", kinds: ["八分周视图"] },
      { label: "日", kinds: ["timeline"] },
    ],
  },
];

// 默认颜色，须与后端 src-tauri/src/backend/colors.rs 一一对应。
export const COLORS = {
  gray: "#7a7a7a",
  phaseGold: "#e5b93f",
  timelineNight: "#496a9f",
  holidayRed: "#8b0000",
  paleJade: "#a9d1ae",
  black: "#000000",
};

export const PAGE_SIZES: Record<string, [number, number]> = {
  A4: [210, 297],
  "A5S/TN 标准": [110, 210],
  "TN护照": [88, 125],
  A5: [148, 210],
  A6: [105, 148],
  A6FC: [108, 171],
  A6Personal: [95, 171],
  A6PW: [120, 170],
  A6Slim: [80, 171],
  A7: [80, 120],
  "127A7": [80, 127],
  B5: [176, 250],
  B6: [125, 176],
  B6Slim: [98, 176],
  "74m5": [74, 105],
  "67m5": [67, 105],
  "62m5": [62, 105],
};

export const PAGE_SIZE_OPTIONS: [string, string][] = [
  ...Object.entries(PAGE_SIZES).map(([k, [w, h]]) => [k, `${k}（${w} × ${h} mm）`] as [string, string]),
  ["custom", "自定义"],
];

export const FONT_OPTIONS: [string, string][] = [
  [String.raw`\sffamily`, "无衬线（sans）"],
  [String.raw`\rmfamily`, "衬线（serif）"],
  [String.raw`\ttfamily`, "等宽（mono）"],
];

export const LINE_STYLE_OPTIONS: [string, string][] = [
  ["solid", "实线"], ["dashed", "虚线"], ["dotted", "点线"], ["dash-dot", "点虚线"], ["double-solid", "双实线"],
];

export const WEEKDAY_LANG_OPTIONS: [string, string][] = [["zh", "中文"], ["en", "English"], ["ja", "日本語"]];
export const WEEKDAY_PRESETS: string[] = ["一,二,三,四,五,六,日", "Mo,Tu,We,Th,Fr,Sa,Su", "月,火,水,木,金,土,日"];
export const WEEKDAY_HEADER_OPTIONS: [string, string][] = [
  ...WEEKDAY_PRESETS.map((h) => [h, h] as [string, string]),
  ["自定义", "自定义"],
];
export const DATE_LOCALE_OPTIONS: [string, string][] = [["zh-CN", "中文"], ["en-US", "English"]];

export const TZ_OPTIONS: [string, string][] = [
  ...Array.from({ length: 12 }, (_, i) => [`Etc/GMT-${12 - i}`, `东${12 - i}区（UTC+${12 - i}）`] as [string, string]),
  ["Etc/GMT", "零时区（UTC）"],
  ...Array.from({ length: 12 }, (_, i) => [`Etc/GMT+${i + 1}`, `西${i + 1}区（UTC-${i + 1}）`] as [string, string]),
];

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const currentMonday = new Date();
currentMonday.setDate(currentMonday.getDate() - ((currentMonday.getDay() + 6) % 7));
const currentSunday = new Date(currentMonday);
currentSunday.setDate(currentMonday.getDate() + 6);

export const defaults: Record<PatternKind, Values & { kind: PatternKind }> = {
  ruled: { kind: "ruled", pages: 32, spacing: 8, color: COLORS.gray, width: 0.2 },
  dots: { kind: "dots", pages: 1, spacing: 5, column_spacing: 5, radius: 0.3, color: COLORS.gray, center_color: COLORS.black },
  grid: { kind: "grid", pages: 1, spacing: 5, color: COLORS.gray, width: 0.2 },
  seyes: {
    kind: "seyes", pages: 1, spacing: 8, margin_line: 7,
    main_color: "#9db0cf", main_width: 0.2, fine_color: "#c5d0e4", fine_width: 0.1,
    vline_color: "#c5d0e4", vline_width: 0.1, margin_color: "#d96a6a", margin_width: 0.4,
  },
  vertical: { kind: "vertical", pages: 1, spacing: 10, color: "#000000", frame_outer_width: 0.5, frame_inner_width: 0.18, frame_gap: 1.2 },
  "us-ruled": {
    kind: "us-ruled", pages: 1, spacing: 8.7, rule_color: "#8fb0d8", rule_width: 0.2,
    margin_x: 25, margin_color: "#d96a6a", margin_width: 0.4,
  },
  "hakubunkan-toyo-nikki": {
    kind: "hakubunkan-toyo-nikki", start_date: toISODate(new Date()), end_date: toISODate(new Date()),
    date_format: "%-m月%-d日", line_color: COLORS.paleJade, line_width: 0.4,
  },
  "方眼罫": { kind: "方眼罫", line_color: COLORS.paleJade },
  "八分周视图": {
    kind: "八分周视图", start_date: toISODate(currentMonday), end_date: toISODate(currentSunday),
    date_format: "%-d", date_locale: "zh-CN", weekday_lang: "zh", title_format: "%Y年%-m月",
    weekday_headers: "一,二,三,四,五,六,日", line_color: COLORS.gray, line_width: 0.4,
    line_style: "solid", center_gap: 2, date_size: 10,
  },
  "hakubunkan-kaichu-nikki": {
    kind: "hakubunkan-kaichu-nikki", start_date: toISODate(new Date()),
    end_date: toISODate(new Date(Date.now() + 86400000)),
    date_format: "%-m 月  %-d 日", date_locale: "zh-CN", weekday_headers: "月,火,水,木,金,土,日",
    lunar_style: "numeric", line_color: COLORS.gray, line_width: 0.4, date_size: 10,
  },
  graph: { kind: "graph", axis: "right", line_color: COLORS.gray, line_width: 0.2, date_size: 8, y_min: null, y_max: null, y_steps: 10 },
  "month-calendar": {
    kind: "month-calendar", year: new Date().getFullYear(), month: new Date().getMonth() + 1,
    phase_color: COLORS.phaseGold, line_color: COLORS.gray, line_width: 0.4, date_size: 8,
    weekday_headers: "Mo,Tu,We,Th,Fr,Sa,Su", title_format: "%Y年%-m月", two_page: false,
    show_holidays: true, sub_size: 4.2, sub_gap: 0, lunar: false,
  },
  "month-tracker": {
    kind: "month-tracker", year: new Date().getFullYear(), month: new Date().getMonth() + 1, items: 4,
    line_color: COLORS.gray, line_width: 0.4, date_size: 8,
  },
  "year-tracker": {
    kind: "year-tracker",
    start: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    end: `${new Date().getFullYear() + 1}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    two_page: false, line_color: COLORS.gray, line_width: 0.4, date_size: 8,
  },
  "year-calendar": {
    kind: "year-calendar", start: `${new Date().getFullYear()}-01`, end: `${new Date().getFullYear()}-12`,
    rows: 1, cols: 2, date_size: 6, weekday_lang: "zh", title_format: "%Y年%-m月",
    weekday_headers: "一,二,三,四,五,六,日", show_holidays: true, lunar: false,
  },
  timeline: {
    kind: "timeline", start: 0, end: 26, pages: 1, start_date: toISODate(currentMonday), end_date: toISODate(currentSunday),
    title_format: "%Y年%-m月%-d日", line_color: COLORS.gray, line_width: 1.138, label_size: 10.2,
    latitude: "", longitude: "", timezone: "Etc/GMT-8", daylight_color: COLORS.phaseGold, night_color: COLORS.timelineNight,
  },
  blank: { kind: "blank", pages: 1 },
};


// base6 设计准则：由纸张尺寸自动计算页边距（mm）
//   Inner(装订边)=宽×9%（8mm 物理下限）< Outer(非装订边)=宽×12%
//   Head(页头)=高×7% < Foot(页脚)=高×9%
//   页面尺寸变化时据此自动重算（与 scripts/gen-examples.sh 的 margins 一致）。
export function margins(width: number, height: number) {
  return {
    binding: Math.max(8, Math.round(width * 0.09)),
    non_binding: Math.max(7, Math.round(width * 0.12)),
    header: Math.max(6, Math.round(height * 0.07)),
    footer: Math.max(8, Math.round(height * 0.09)),
  };
}

export function newSection(width = 148, height = 210): Section {
  return {
    id: crypto.randomUUID(),
    expanded: true,
    headerEnabled: false,
    headerMode: "text",
    footerEnabled: false,
    footerMode: "text",
    pageNumber: true,
    page: { width, height, ...margins(width, height) },
    document: {
      binding_text: "", binding_text_2: "", binding_text_size: 8, binding_text_2_size: 8,
      binding_text_spacing: 5, binding_text_edge: null, binding_text_color: COLORS.gray,
      header_text: "", header_text_2: "", header_text_size: 8, header_text_2_size: 8,
      header_text_spacing: 5, header_text_color: COLORS.gray,
      footer_text: "", footer_text_2: "", footer_text_size: 8, footer_text_2_size: 8,
      footer_text_spacing: 5, footer_text_color: COLORS.gray,
      non_binding_text: "", non_binding_text_2: "", non_binding_text_size: 8, non_binding_text_2_size: 8,
      non_binding_text_spacing: 5, non_binding_text_edge: null, non_binding_text_color: COLORS.gray,
    },
    watermarkEnabled: false,
    nonBindingEnabled: false,
    pattern: { ...defaults.ruled },
  };
}
