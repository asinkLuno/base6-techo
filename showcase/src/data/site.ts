// 展示页数据：版本、尺寸与全部版式的元数据。
// 与 src-tauri (PAGE_SIZES / patterns) 及 scripts/gen-examples.py 保持一致。
// 样张图片/JSON 以绝对路径 /examples/… 提供（nginx root 下与 showcase/ 平级的 examples/）。

export const TITLE = "base6 techo · 版式样张集";
export const ENDPOINT = "https://github.com/asinkLuno/base6-techo";

export interface Size {
  id: string; // 目录名（a5 / a6p / a7）
  label: string; // 显示名
  mm: string; // “宽 × 高”
  w: number;
  h: number; // 页尺寸毫米
  spread: string; // spec-fig 宽度百分比（A5 为满幅基准）
}

export const SIZES: Size[] = [
  { id: "a5", label: "A5", mm: "148 × 210", w: 148, h: 210, spread: "100.0" },
  { id: "a6p", label: "A6 Personal", mm: "95 × 171", w: 95, h: 171, spread: "64.2" },
  { id: "a7", label: "A7", mm: "80 × 120", w: 80, h: 120, spread: "54.1" },
];

export interface Pattern {
  id: string;
  name: string;
  latin?: string;
  desc: string;
  spec: string;
  ink: string; // --pat-ink 线色
  handwriting?: true; // 是否需要仿手写覆盖（仅 ruled）
}

export interface Group {
  id: "base" | "arch";
  cls: "group--base" | "group--arch";
  over: string;
  head: string;
  mono: string;
  note?: string;
  archProv?: string;
  patterns: Pattern[];
}

export const GROUPS: Group[] = [
  {
    id: "base",
    cls: "group--base",
    over: "工作室标准 · 常备格线",
    head: "基础",
    mono: "6 种经典书写面",
    note: "工作台自有的基础线面——横线、点阵、网格与各类书写格。间距、线色、线宽皆可调，是拼本的建材。",
    patterns: [
      { id: "ruled", name: "横线", desc: "等距横线左右贯通内容区，最朴素也最常用的书写面。", spec: "行距 8 mm · 线宽 0.2 pt", ink: "#7A7A7A", handwriting: true },
      { id: "dots", name: "点阵", desc: "自内容区中心向四周扩散的等距点阵，几何中心一点单独着墨。", spec: "间距 5 mm · 点径 0.3 mm · 中心点着墨", ink: "#7A7A7A" },
      { id: "grid", name: "网格", desc: "等距方格纸，四周锁边收口，格区在内容区内居中。", spec: "间距 5 mm · 线宽 0.2 pt", ink: "#7A7A7A" },
      { id: "seyes", name: "法文格", latin: "Séyès", desc: "法国小学生格纸：四细一主，8 mm 主格，红色竖线立边。", spec: "主格 8 mm · 主线 0.2 pt · 红边线 0.4 pt", ink: "#9DB0CF" },
      { id: "us-ruled", name: "美式横线", desc: "美式拍纸簿制式：蓝色宽横线加左侧红色边线。", spec: "行距 8.7 mm · 蓝线 0.2 pt · 红边线 0.4 pt", ink: "#8FB0D8" },
      { id: "vertical", name: "古文竖排", desc: "文武线双框加界栏，供自右向左的竖排书写。", spec: "栏距 10 mm · 外框 0.5 pt · 内框 0.18 pt", ink: "#26231E" },
    ],
  },
  {
    id: "arch",
    cls: "group--arch",
    over: "档案 · 实物还原",
    head: "复刻",
    mono: "3 件纸品原物",
    archProv:
      "据实还原的<strong>3 本真实纸品</strong>——格线、间距与版心逐一比对实物复刻：<span class=\"mono\">MD 方眼罫 · 博文館・當用日記 · 博文館・懐中日記</span>",
    patterns: [
      { id: "hogen", name: "方眼罫", desc: "复刻 Midori(MD) 笔记内页的方眼罫：5 mm 格，偶数格线向外伸出，每十格以点相连。", spec: "间距 5 mm · 格隙 1 mm · 线宽 0.7", ink: "#A9D1AE" },
      { id: "hakubunkan-toyo-nikki", name: "博文館・當用日記", desc: "复刻博文館旧式日记，一页一天：受信、发信、摘记栏与天気・気温列。", spec: "一页一天 · 日期逐页推进 · 线色 #A9D1AE", ink: "#A9D1AE" },
      { id: "hakubunkan-kaichu-nikki", name: "博文館・懐中日記", desc: "复刻博文館袖珍日记，一页两天，注旧暦与星期，侧栏记天気・気温。", spec: "一页两天 · 旧暦数字 · 线宽 0.4 pt", ink: "#7A7A7A" },
    ],
  },
];

// 样张对页 PNG 的固有像素尺寸（A5 全尺寸基准）。
export const PAGE_W = 875;
export const PAGE_H = 1241;

// 手写样张的简体原文：运行时经 opencc (cn→tw) 转为繁体以匹配辰宇落雁字型。
export const HANDWRITING_SIMPLIFIED = ["横格里，一行一行，", "把日子一行行排好，", "墨迹淡了，也不改。"];
