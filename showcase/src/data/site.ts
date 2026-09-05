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
  frames?: "spread" | "single" | "calendar"; // 样张页面形态（默认 spread 对页）
  variants?: string[]; // 可选变体 id（如 sleep/weight、plain/holiday）
  variantLabels?: Record<string, string>;
}

export interface Period {
  id: string;
  label: string; // 年/月/周/日
  mono: string;
  intro: string;
  patterns: Pattern[];
}

export interface Group {
  id: string;
  cls: string;
  over: string;
  head: string;
  mono: string;
  note?: string;
  archProv?: string;
  patterns?: Pattern[];
  periods?: Period[];
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
      { id: "grid", name: "网格", desc: "等距方格纸，四周锁边收口，格区在内容区内居中。", spec: "间距 5 mm · 线宽 0.2 pt", ink: "#7A7A7A", handwriting: true },
      { id: "seyes", name: "法文格", latin: "Séyès", desc: "法国小学生格纸：四细一主，8 mm 主格，红色竖线立边。", spec: "主格 8 mm · 主线 0.2 pt · 红边线 0.4 pt", ink: "#9DB0CF" },
      { id: "us-ruled", name: "美式横线", desc: "美式拍纸簿制式：蓝色宽横线加左侧红色边线。", spec: "行距 8.7 mm · 蓝线 0.2 pt · 红边线 0.4 pt", ink: "#8FB0D8" },
      { id: "vertical", name: "古文竖排", desc: "文武线双框加界栏，供自右向左的竖排书写。", spec: "栏距 10 mm · 外框 0.5 pt · 内框 0.18 pt", ink: "#26231E", handwriting: true },
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
  {
    id: "sched",
    cls: "group--sched",
    over: "日程 · 手帐",
    head: "日程",
    mono: "年 · 月 · 周 · 日",
    note: "以四个时间刻度纵览一年：年历与年度追踪、月历与月度打卡、周视图，直至一日的时间轴。日期随页推进，节假日与旧历可开可关。",
    periods: [
      {
        id: "year",
        label: "年",
        mono: "2 款 · 全年一页或一月一页",
        intro: "把一整年摊在一处——年历逐月成格，年度追踪则把 12 个月按列竖排，供全年概览。",
        patterns: [
          { id: "year-calendar", name: "年历", desc: "整年 12 个月排作一张年历网格，可选标注节假日与旧历。", spec: "rows×cols 月格 · date_size 6 · 节假日/旧历可关", ink: "#7A7A7A", frames: "calendar", variants: ["plain", "holiday"], variantLabels: { plain: "素历", holiday: "节日" } },
          { id: "year-tracker", name: "年度追踪", desc: "12 个月按列竖排的年度网格，每日一格，宜作全年习惯追踪底纸。", spec: "12 列 × 31 行 · 线宽 0.4 pt", ink: "#7A7A7A", frames: "calendar" },
        ],
      },
      {
        id: "month",
        label: "月",
        mono: "3 款 · 月历 / 月打卡 / 月制图",
        intro: "以月为粒度的三种面：月历看日子，月打卡数格子，月制图画趋势。",
        patterns: [
          { id: "month-calendar", name: "月历", desc: "单张月历，可选标注节假日与旧历，做月内安排。", spec: "月历星期表头 · 日期 8 pt · 节假日/旧历可关", ink: "#7A7A7A", frames: "calendar", variants: ["plain", "holiday"], variantLabels: { plain: "素历", holiday: "节日" } },
          { id: "month-tracker", name: "月打卡", desc: "当月每日一格的打卡表，可设多项目标随列推进。", spec: "items 4 · date_size 8 · 线宽 0.4 pt", ink: "#7A7A7A", frames: "single" },
          { id: "month_graph", name: "月追踪制图", desc: "按月纵轴折线制图，预置睡眠、体重两档量程，随手记逐日数据。", spec: "纵轴右置 · y_min/y_max 可调", ink: "#7A7A7A", frames: "single", variants: ["sleep", "weight"], variantLabels: { sleep: "睡眠", weight: "体重" } },
        ],
      },
      {
        id: "week",
        label: "周",
        mono: "1 款 · 八分周视图",
        intro: "一周摊成八分：七天各占一栏，末栏留作备忘。",
        patterns: [
          { id: "octan-week", name: "八分周视图", desc: "一周七天加一栏备忘，共八分；每栏起讫日期随周推进。", spec: "八分栏 · 线宽 0.4 pt · date_size 10", ink: "#7A7A7A", frames: "spread" },
        ],
      },
      {
        id: "day",
        label: "日",
        mono: "1 款 · 时间轴",
        intro: "把一天的时钟画直：昼夜着色区分，横贯当页的时间轴。",
        patterns: [
          { id: "daily_timeline", name: "时间轴", desc: "一页一天的水平时间轴，0–24 点为主刻度，昼夜分别着色。", spec: "start 0 – end 24 · 昼夜双色 · 线宽 1.138 pt", ink: "#E5B93F", frames: "spread" },
        ],
      },
    ],
  },
];

// 样张对页 PNG 的固有像素尺寸（A5 全尺寸基准）。
export const PAGE_W = 875;
export const PAGE_H = 1241;

// 手写样张的简体原文：运行时经 opencc (cn→tw) 转为繁体以匹配辰宇落雁字型。
export const HANDWRITING_SIMPLIFIED = [
  "花间一壶酒，独酌无相亲。",
  "举杯邀明月，对影成三人。",
  "月既不解饮，影徒随我身。",
  "暂伴月将影，行乐须及春。",
  "我歌月徘徊，我舞影零乱。",
  "醒时同交欢，醉后各分散。",
  "永结无情游，相期邈云汉。",
];

// 横线样张：朱自清《荷塘月色》开篇四段全文（原文本就繁体，不再转换）。
// 第 2 页写标题 + 前三段起头，第 3 页续写至第四段末；两页 44 行写 43 行。
export const HANDWRITING_LOTUS = [
  "這幾天心裏頗不寧靜。今晚在院子裏坐着乘涼，忽然想起日日走過的荷塘，在這滿月的光裏，總該另有一番樣子吧。月亮漸漸地升高了，牆外馬路上孩子們的歡笑，已經聽不見了；妻在屋裏拍着閏兒，迷迷糊糊地哼着眠歌。我悄悄地披了大衫，帶上門出去。",
  "沿着荷塘，是一條曲折的小煤屑路。這是一條幽僻的路；白天也少人走，夜晚更加寂寞。荷塘四面，長着許多樹，蓊蓊鬱鬱的。路的一旁，是些楊柳，和一些不知道名字的樹。沒有月光的晚上，這路上陰森森的，有些怕人。今晚卻很好，雖然月光也還是淡淡的。",
  "路上只我一個人，背着手踱着。這一片天地好像是我的；我也像超出了平常的自己，到了另一世界裏。我愛熱鬧，也愛冷靜；愛羣居，也愛獨處。像今晚上，一個人在這蒼茫的月下，什麽都可以想，什麽都可以不想，便覺是個自由的人。白天裏一定要做的事，一定要說的話，現在都可不理。這是獨處的妙處，我且受用這無邊的荷香月色好了。",
  "曲曲折折的荷塘上面，彌望的是田田的葉子。葉子出水很高，像亭亭的舞女的裙。層層的葉子中間，零星地點綴着些白花，有嬝娜地開着的，有羞澀地打着朶兒的；正如一粒粒的明珠，又如碧天裏的星星，又如剛出浴的美人。微風過處，送來縷縷清香，彷彿遠處高樓上渺茫的歌聲似的。這時候葉子與花也有一絲的顫動，像閃電般，霎時傳過荷塘的那邊去了。葉子本是肩並肩密密地挨着，這便宛然有了一道凝碧的波痕。葉子底下是脈脈的流水，遮住了，不能見一些顏色；而葉子卻更見風致了。",
];
