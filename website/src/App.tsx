import type { ReactNode } from "react";
import { motion, MotionConfig } from "motion/react";

type Pattern = { code: string; name: string; en: string; desc: string; preview: string; img?: string; pos?: string; pdf: string; pages: string; params: [string, string][] };

const BASIC_PATTERNS: Pattern[] = [
  {
    code: "B-01",
    name: "点阵",
    en: "Dots",
    desc: "5 mm 标准点阵，间距与半径皆可调",
    preview: "pv-dots",
    img: "/img/patterns/pattern-dots.png",
    pdf: "examples/patterns/pattern-dots.pdf",
    pages: "A5 · 2 页",
    params: [
      ["点距 / 列距", "竖向 / 横向点距，mm，默认各 5 mm，可分开调"],
      ["点径", "点半径，mm，默认 0.3"],
      ["颜色", "点的颜色，默认灰 #7a7a7a"],
      ["中心点颜色", "点心单独套色，可做双色针点；默认与点同色"],
      ["页数", "生成页数"],
    ],
  },
  {
    code: "B-02",
    name: "网格",
    en: "Grid",
    desc: "方格纸，行距步进到 0.5 mm",
    preview: "pv-grid",
    img: "/img/patterns/pattern-grid.png",
    pdf: "examples/patterns/pattern-grid.pdf",
    pages: "A5 · 2 页",
    params: [
      ["间距", "方格边长，mm，默认 5"],
      ["线宽", "mm，默认 0.2"],
      ["颜色", "默认灰 #7a7a7a"],
      ["页数", "生成页数"],
    ],
  },
  {
    code: "B-03",
    name: "横线",
    en: "Ruled",
    desc: "8 mm 行距起步，行距自定义",
    preview: "pv-ruled",
    img: "/img/patterns/pattern-ruled.png",
    pdf: "examples/patterns/pattern-ruled.pdf",
    pages: "A5 · 2 页",
    params: [
      ["行距", "mm，默认 8"],
      ["线宽", "mm，默认 0.2"],
      ["颜色", "默认灰 #7a7a7a"],
      ["页数", "生成页数"],
    ],
  },
  {
    code: "B-04",
    name: "法文格",
    en: "Seyès",
    desc: "法国 Séyès 制图格，五线双层",
    preview: "pv-seyes",
    img: "/img/patterns/pattern-seyes.png",
    pdf: "examples/patterns/pattern-seyes.pdf",
    pages: "A5 · 2 页",
    params: [
      ["格距", "一组五线的高度，mm，默认 8"],
      ["红线位置", "第几根竖线画红色边线，0 为不画，默认第 7 根"],
      ["主线 / 细线", "横线的主线与三条细线，各配颜色与线宽（样张 0.2 / 0.1 mm）"],
      ["竖线 / 边线", "竖线与红色边线，各配颜色与线宽（样张 0.1 / 0.4 mm）"],
      ["页数", "生成页数"],
    ],
  },
  {
    code: "B-05",
    name: "古文竖排",
    en: "Vertical",
    desc: "双线边框竖列，抄古文用",
    preview: "pv-vertical",
    img: "/img/patterns/pattern-vertical.png",
    pdf: "examples/patterns/pattern-vertical.pdf",
    pages: "A5 · 2 页",
    params: [
      ["列距", "竖列宽度，mm，默认 10"],
      ["外框 / 内框宽", "双线边框两根线的线宽，mm，默认 0.5 / 0.18"],
      ["框间距", "双线边框的间距，mm，默认 1.2"],
      ["颜色", "列线颜色，默认黑"],
      ["页数", "生成页数"],
    ],
  },
  {
    code: "B-06",
    name: "美式横线",
    en: "College Ruled",
    desc: "8.7 mm 行距加红色装订边线",
    preview: "pv-usruled",
    img: "/img/patterns/pattern-us-ruled.png",
    pdf: "examples/patterns/pattern-us-ruled.pdf",
    pages: "A5 · 2 页",
    params: [
      ["行距", "mm，默认 8.7（College Ruled）"],
      ["线色 / 线宽", "横线，默认蓝 #8fb0d8、0.2 mm"],
      ["红线位置", "距左缘 mm，默认 25"],
      ["红线色 / 红线宽", "默认 #d96a6a、0.4 mm"],
      ["页数", "生成页数"],
    ],
  },
];

const REPLICA_PATTERNS: Pattern[] = [
  {
    code: "R-01",
    name: "博文館・當用日記",
    en: "Tōyō Nikki",
    desc: "一日一页：旧历、六耀、天气与气温俱全，连页脚的纪念日都一并复刻",
    preview: "pv-toyo",
    img: "/img/patterns/pattern-toyo.png",
    pos: "top",
    pdf: "examples/patterns/pattern-toyo.pdf",
    pages: "A5 · 2 页（2 天）",
    params: [
      ["开始 / 结束日期", "一日一页，按日期逐天生成（样张 2027-01-01 起 2 天）"],
      ["日期格式", "strftime 写法，默认 %-m月%-d日"],
      ["线色 / 线宽", "版面格线，默认淡翡翠 #a9d1ae、0.4 pt（复刻原版豆绿格）"],
      ["样张字体", "旧历、六耀等汉字注记需 CJK 字体，样张以京華老宋体渲染；其余演示用 0xProto"],
    ],
  },
  {
    code: "R-02",
    name: "博文館・懷中日記",
    en: "Kaichū Nikki",
    desc: "两日一页的口袋本复刻，对页各容两天，留白足以写一天的心事",
    preview: "pv-kaichu",
    img: "/img/patterns/pattern-kaichu.png",
    pos: "top",
    pdf: "examples/patterns/pattern-kaichu.pdf",
    pages: "A5 · 1 页（2 天）",
    params: [
      ["开始 / 结束日期", "两日一页，按日期逐天生成（样张 2027-01-01 起 2 天）"],
      ["日期格式", "默认「%-m 月  %-d 日」"],
      ["语言 / 星期表头", "日期与星期所用语言；表头默认 月,火,水,木,金,土,日（复刻日文原版）"],
      ["农历格式", "numeric 旧历 + 阿拉伯数字 / traditional 传统农历表述"],
      ["线色 / 线宽 / 日期字号", "默认淡翡翠 #a9d1ae、0.4 pt、10 pt"],
      ["样张字体", "旧历、六耀等汉字注记需 CJK 字体，样张以京華老宋体渲染；其余演示用 0xProto"],
    ],
  },
  {
    code: "R-03",
    name: "Midori",
    en: "Midori",
    desc: "Midori 风格周视图，自由分区随你划分",
    preview: "pv-midori",
    img: "/img/patterns/pattern-midori.png",
    pdf: "examples/patterns/pattern-midori.pdf",
    pages: "A5 · 1 页",
    params: [["线色", "周框架线，默认淡翡翠 #a9d1ae；版面不带日期，留白自填"]],
  },
];

const SCHEDULE_PATTERNS: Pattern[] = [
  {
    code: "S-01",
    name: "月历",
    en: "Month",
    desc: "整月一览，节假日自动标红",
    preview: "pv-month",
    img: "/img/patterns/pattern-month.png",
    pdf: "examples/patterns/pattern-month.pdf",
    pages: "A5 · 1 页",
    params: [
      ["年 / 月", "样张 2027 年 1 月，导入节假日后元旦与周末自动标红"],
      ["星期表头", "七天一行，逗号分隔；样张 日,一,二,三,四,五,六"],
      ["标题格式", "月标题 strftime 写法，默认 %Y年%-m月"],
      ["双页", "开启后周一~三 / 周四~日 分摊对页"],
      ["月相颜色", "每日格左上角的月相标记，默认金 #e5b93f"],
      ["显示节假日 / 显示农历", "节假日染红开关；农历随节假日数据与开关显示，可调字号与间隔"],
      ["线色 / 线宽 / 日期字号", "默认灰 #7a7a7a、0.4 pt、8 pt"],
    ],
  },
  {
    code: "S-02",
    name: "年历",
    en: "Year",
    desc: "十二个月排成一页",
    preview: "pv-year",
    img: "/img/patterns/pattern-year.png",
    pdf: "examples/patterns/pattern-year.pdf",
    pages: "A5 · 1 页",
    params: [
      ["开始 / 结束月份", "YYYY-MM，样张 2027-01 至 2027-12"],
      ["行数 / 列数", "月格排布，样张 3 × 4；日期字号可调"],
      ["星期表头语言", "中 / 英 / 日，或自定义表头"],
      ["月标题格式", "每格月标题 strftime 写法，默认 %Y.%m"],
      ["显示节假日 / 显示农历", "配合导入的节假日数据标红"],
    ],
  },
  {
    code: "S-03",
    name: "八分周视图",
    en: "Eight",
    desc: "一周八栏，分栏排布",
    preview: "pv-eight",
    img: "/img/patterns/pattern-eight.png",
    pdf: "examples/patterns/pattern-eight.pdf",
    pages: "A5 · 1 页（一周）",
    params: [
      ["开始 / 结束日期", "按周生成，样张 2027-01-04（周一）起一周"],
      ["日期格式 / 表头语言", "日期 strftime 写法；星期表头中 / 英 / 日或自定义"],
      ["迷你月历", "页首自带当月迷你月历，标题格式与表头同月历可调"],
      ["线样式", "实线 / 虚线 / 点线 / 点划线 / 双实线"],
      ["中心圆点间隙", "八分中心圆点周围格线的断开宽度，mm，默认 2"],
      ["显示农历", "日期下可带农历"],
    ],
  },
  {
    code: "S-04",
    name: "时间轴",
    en: "Timeline",
    desc: "横向时间带，按刻度记事",
    preview: "pv-timeline",
    img: "/img/patterns/pattern-timeline.png",
    pdf: "examples/patterns/pattern-timeline.pdf",
    pages: "A5 · 1 页（一天）",
    params: [
      ["开始 / 结束时间", "小时数，可跨零点（如 0–26）；每格一条时间带"],
      ["起始 / 结束日期", "页首日期标题与日照计算所用日期（样张 2027-01-01）"],
      ["纬度 / 经度 / 时区", "填入后按日照画昼夜底色，留空则不绘（样张上海）"],
      ["昼 / 夜颜色", "默认金 #e5b93f / 夜蓝 #496a9f"],
      ["标题格式 / 标签字号", "页首日期 strftime 写法与小时标签字号"],
    ],
  },
  {
    code: "S-05",
    name: "月打卡",
    en: "Tracker",
    desc: "整月打卡格，习惯养成",
    preview: "pv-tracker",
    img: "/img/patterns/pattern-tracker.png",
    pdf: "examples/patterns/pattern-tracker.pdf",
    pages: "A5 · 1 页",
    params: [
      ["年 / 月", "样张 2027 年 1 月"],
      ["打卡项数", "1–30 项，每项一行打卡格"],
      ["线色 / 线宽 / 日期字号", "默认灰 #7a7a7a、0.4 pt、8 pt"],
    ],
  },
  {
    code: "S-06",
    name: "月追踪制图",
    en: "Graph",
    desc: "横轴三十一日的极细方格纸，画曲线、记数值；沿长边横放设计",
    preview: "pv-graph",
    img: "/img/patterns/pattern-graph.png",
    pdf: "examples/patterns/pattern-graph.pdf",
    pages: "A5 · 1 页",
    params: [
      ["纵轴下界 / 上界", "设置后沿纵轴均分刻度并标注数字，留空只画网格"],
      ["纵轴刻度段数", "默认 5 段"],
      ["数字位置", "日期数字带压页面右缘（默认）或左缘"],
      ["线色 / 细线宽", "极细方格纸；粗线为细线两倍，每 5 日一道"],
      ["轴标签字号", "默认 8 pt"],
    ],
  },
  {
    code: "S-07",
    name: "年度追踪",
    en: "Month Tracker",
    desc: "一年十二行，长线计划",
    preview: "pv-monthtracker",
    img: "/img/patterns/pattern-monthtracker.png",
    pdf: "examples/patterns/pattern-monthtracker.pdf",
    pages: "A5 · 1 页（12 月）",
    params: [
      ["开始 / 结束月份", "YYYY-MM，样张 2027-01 至 2027-12，一行一个月"],
      ["双页", "开启后 1–14 日 / 15–31 日分摊对页，格子同大"],
      ["线色 / 线宽 / 日期字号", "默认灰 #7a7a7a、0.4 pt、8 pt"],
    ],
  },
];

const SPEC: { k: string; v: string }[] = [
  {
    k: "整本编排",
    v: "把多节内容组成一本真正的书：拖拽排序、自由补白、页码顺延。版式、页序、水印与最后的拼版分开处理，先把内容排对，再决定怎么装订。",
  },
  {
    k: "页面几何",
    v: "每页只描述一次：纸张尺寸、天头、地脚、装订侧（订口）与非装订侧（切口）。LaTeX 按奇偶页自动镜像，不用手动维护正反面的左右边距。",
  },
  {
    k: "对页与补白",
    v: "跨页版式需要从正确的偶数页开始时，在整本任意位置插入白页即可把页序推正；八分周视图、双页月历等不会因为前一节多一页而错位。",
  },
  {
    k: "LaTeX 排版",
    v: "页面由 LaTeX 生成，不是把图片贴到纸上。字体、线宽、页眉页脚、日期、颜色和版心都进入同一套可复现的排版规则。",
  },
  {
    k: "日期与数据",
    v: "月历、周视图与节假日都在排版时生成：可导入 ICS，切换中英日星期、日期格式与农历显示，结果随项目设置复现。",
  },
  {
    k: "本地矢量输出",
    v: "内置 Tectonic 在本地编译，无需另装 TeX 发行版，也不用上传手帐内容。输出矢量 PDF，放大不糊，直接打印或送印刷厂。",
  },
  {
    k: "版式与纸张",
    v: "点阵、方格、日历、周视图、追踪、博文館复刻等版式可以混排；A4–A7、B5 / B6、TN、A6 等纸型可直接选择，也支持毫米级自定义。",
  },
  {
    k: "装订方式",
    v: "不拼版时按页序直出，适合活页打孔；骑马钉按 4 页补齐，锁线按帖分组。内容只排一次，换装订方式不必重做版面。",
  },
 ];

const EXAMPLES: [string, string][] = [
  ["2027 周计划（A5）", "2027-weekly.pdf"],
  ["2027 周计划（A6）", "2027-weekly-a6.pdf"],
  ["2027 周计划（A6 Personal）", "2027-weekly-a6personal.pdf"],
  ["2027 周计划（B6 Slim）", "2027-weekly-b6slim.pdf"],
  ["A5 点阵 · 豆绿", "a5-dotgrid-green.pdf"],
  ["A5 国誉点线", "a5-kokuyo-dotline.pdf"],
  ["A5 横线 8 mm", "a5-ruled-8mm.pdf"],
  ["A5 法文格 Séyès", "a5-seyes.pdf"],
  ["A5 美式横线", "a5-us-ruled.pdf"],
];

// 发新版本时同步更新此处（资产文件名里带版本号；rpm 的连字符命名与 tauri 默认不同）。
const APP_VERSION = "0.1.0";
const REPO_URL = "https://github.com/asinkLuno/base6-techo";
const RELEASES_URL = `${REPO_URL}/releases`;
const RELEASE_ASSET = (name: string) => `https://github.com/asinkLuno/base6-techo/releases/latest/download/${name}`;

const DOWNLOADS: { label: string; sub: string; asset: string }[] = [
  { label: "Windows", sub: "x64 · 安装器（exe）", asset: `base6-techo_${APP_VERSION}_x64-setup.exe` },
  { label: "Windows", sub: "x64 · MSI", asset: `base6-techo_${APP_VERSION}_x64_en-US.msi` },
  { label: "macOS", sub: "Apple Silicon · dmg", asset: `base6-techo_${APP_VERSION}_aarch64.dmg` },
  { label: "macOS", sub: "Intel · dmg", asset: `base6-techo_${APP_VERSION}_x64.dmg` },
  { label: "Linux", sub: "amd64 · deb", asset: `base6-techo_${APP_VERSION}_amd64.deb` },
  { label: "Linux", sub: "x86_64 · rpm", asset: `base6-techo-${APP_VERSION}-1.x86_64.rpm` },
];

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}


function SectionHead({ code, title, lede }: { code: string; title: ReactNode; lede: string }) {
  return (
    <header className="sec-head">
      <p className="sec-code">{code}</p>
      <h2>{title}</h2>
      <p className="sec-lede">{lede}</p>
    </header>
  );
}

function StaticSpread() {
  return (
    <div>
      <div className="spread-stage">
        <figure className="sp-page even">
          <span className="sp-zone bind">装订侧</span>
          <span className="sp-zone cut">非装订侧</span>
          <figcaption className="sp-cap">左页 · 偶数 2</figcaption>
        </figure>
        <figure className="sp-page odd">
          <span className="sp-zone bind">装订侧</span>
          <span className="sp-zone cut">非装订侧</span>
          <figcaption className="sp-cap">右页 · 奇数 3</figcaption>
        </figure>
      </div>
      <p className="sp-exp">
        装订侧（<b className="term-b">订口</b>）永远朝着书脊、也就是对页的中缝：摊开的左页是偶数页、右页是奇数页，所以偶数页的装订侧在
        <b className="term-b">右缘</b>，奇数页的装订侧在<b className="term-b">左缘</b>，两页的非装订侧（<b className="term-c">切口</b>）都在外侧。
        单看一张纸也一样——正面（奇数页）装订在左，翻到背面（偶数页）装订就换到右；
        排版引擎按页码奇偶决定装订侧朝向哪一边，水印、编号这类沿边竖排的内容会自动跟着镜像。
      </p>
    </div>
  );
}



function PatternCard({ p }: { p: Pattern }) {
  return (
    <figure className="pcard">
      <a className="pv-link" href={p.pdf} target="_blank" rel="noreferrer" title={`打开样张 PDF（${p.pages}）`}>
        <div className={`pv ${p.preview}`}>{p.img && <img src={p.img} style={{ objectPosition: p.pos ?? "center" }} alt={`${p.name} 版式渲染样张`} loading="lazy" />}</div>
        <span className="pv-badge" aria-hidden="true">样张 PDF ↗</span>
      </a>
      <figcaption>
        <p className="pcard-head">
          <span className="pcard-code">{p.code}</span>
          <span className="pcard-name">{p.name}</span>
          <span lang="en" className="pcard-en">{p.en}</span>
        </p>
        <p className="pcard-desc">{p.desc}</p>
        <p className="pcard-pages">{p.pages}</p>
        <details className="pcard-params">
          <summary>参数说明</summary>
          <dl>
            {p.params.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </details>
      </figcaption>
    </figure>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">

      <header className="nav">
        <a className="brand" href="#top">
          <span className="brand-mark" aria-hidden="true" />
          base6<em>-techo</em>
        </a>
        <nav>
          <a href="#spec">能力</a>
          <a href="#anatomy">整本排版</a>
          <a href="#patterns">版式</a>
          <a href="#examples">样例</a>
          <a className="gh-link" href={REPO_URL} target="_blank" rel="noreferrer">
            <GitHubIcon className="gh-icon" />
            GitHub
          </a>
          <a className="nav-cta" href="#download">下载</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <motion.p className="eyebrow" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: "easeOut" }}>专业 LaTeX 排版 · 本地桌面工具</motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut", delay: 0.06 }}
            >
              整本排版，
              <br />
              一次生成。
            </motion.h1>
            <motion.p
              className="lede"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut", delay: 0.12 }}
            >
              base6-techo 是一套面向整本手帐与纸本出版的<strong>专业排版工具</strong>：用 LaTeX 组织多节内容，版式、水印、页序与拼版分开处理。
              不用手动为正反面倒腾边距——装订侧（订口）与非装订侧（切口）分别设置，排版引擎会按奇偶页自动镜像；最后直接输出适合打印的矢量 PDF。
            </motion.p>
            <motion.div
              className="hero-cta"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut", delay: 0.18 }}
            >
              <a className="btn btn-solid" href="#download">下载桌面版</a>
              <a className="btn btn-ghost" href="#examples">先看成品样例</a>
              <a className="btn btn-ghost btn-gh" href={REPO_URL} target="_blank" rel="noreferrer">
                <GitHubIcon className="btn-gh-icon" />
                GitHub
              </a>
            </motion.div>
            <motion.p className="hero-file" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: "easeOut", delay: 0.24 }}>LaTeX source → Tectonic → vector PDF · local-first</motion.p>
            <div className="hero-proof" aria-label="核心能力">
              <div><strong>LaTeX</strong><span>专业排版引擎</span></div>
              <div><strong>INNER / OUTER</strong><span>装订边自动镜像</span></div>
              <div><strong>PDF</strong><span>矢量输出，直接打印</span></div>
            </div>
          </div>

          <div className="hero-art">
            <span className="crop tl" aria-hidden="true" />
            <span className="crop tr" aria-hidden="true" />
            <span className="crop bl" aria-hidden="true" />
            <span className="crop br" aria-hidden="true" />
            <p className="hero-tag">专业排版工具・整本输出</p>
            <motion.div
              className="sheet s-seyes pv pv-seyes"
              initial={{ opacity: 0, x: 8, y: 18, rotate: 0 }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: -6.5 }}
              transition={{ duration: 0.65, ease: [0.2, 0.7, 0.25, 1], delay: 0.12 }}
            >
              <span>A5 · 法文格</span>
            </motion.div>
            <motion.div
              className="sheet s-kaichu"
              initial={{ opacity: 0, x: 8, y: 18, rotate: 0 }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: 1.6 }}
              transition={{ duration: 0.65, ease: [0.2, 0.7, 0.25, 1], delay: 0.2 }}
            >
              <img src="/img/huaizhong.png" alt="" />
              <span>懷中日記 · 复刻</span>
            </motion.div>
            <motion.div
              className="sheet s-dots pv pv-dots"
              initial={{ opacity: 0, x: 8, y: 18, rotate: 0 }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: 7 }}
              transition={{ duration: 0.65, ease: [0.2, 0.7, 0.25, 1], delay: 0.28 }}
            >
              <span>TN · 5 mm 点阵</span>
            </motion.div>
            <motion.div
              className="sheet s-month pv pv-month"
              initial={{ opacity: 0, x: 8, y: 18, rotate: 0 }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: -2.5 }}
              transition={{ duration: 0.65, ease: [0.2, 0.7, 0.25, 1], delay: 0.36 }}
            >
              <span>月历</span>
            </motion.div>
          </div>
        </section>

        <section id="spec" className="section">
          <SectionHead
            code="WORKFLOW"
            title="先排一本书，再决定怎么装订"
            lede="LaTeX 负责页面，整本编排负责页序，装订方式负责最后的拼版。三件事分开，复杂的正反面边距就不再落到手工计算上。"
          />
          <div className="workflow-strip" aria-label="排版工作流">
            <div><span className="workflow-no">01</span><strong>组织整本</strong><small>多节内容 · 页序 · 白页</small></div>
            <div><span className="workflow-no">02</span><strong>定义版心</strong><small>装订侧 ↔ 非装订侧</small></div>
            <div><span className="workflow-no">03</span><strong>输出成品</strong><small>Tectonic · 矢量 PDF</small></div>
          </div>
          <dl className="spec">
            {SPEC.map((s) => (
              <div className="spec-row" key={s.k}>
                <dt>{s.k}</dt>
                <dd>{s.v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="anatomy" className="section">
          <SectionHead
            code="BIND SIDE"
            title="装订侧与非装订侧"
            lede="翻开的一本书里，中缝两侧都是装订侧，所以左右两页互为镜像。下面是对页示意：左页偶数、右页奇数，各自的装订侧与非装订侧。"
          />
          <StaticSpread />

          <div className="blank-fill">
            <h3 className="group-title">
              <span>整本自由补白</span>
              <i>BLANK FILL</i>
            </h3>
            <div className="bf-row">
              <div className="bx odd">
                <span className="n">1</span>
                <span className="cap">2027 年历</span>
              </div>
              <div className="bx even blank">
                <span className="n">2</span>
                <span className="cap">白页</span>
              </div>
              <div className="bx odd blank">
                <span className="n">3</span>
                <span className="cap">白页</span>
              </div>
              <div className="bx even">
                <span className="n">4</span>
                <span className="cap">1 月 · 月历</span>
              </div>
              <div className="bx odd">
                <span className="n">5</span>
                <span className="cap">月度打卡</span>
              </div>
              <div className="bf-pair">
                <span className="bf-cap">八分周视图 · 一对对页</span>
                <span className="bf-cards">
                  <span className="bx even"><span className="n">6</span><span className="cap">周 · 左</span></span>
                  <span className="bx odd"><span className="n">7</span><span className="cap">周 · 右</span></span>
                </span>
              </div>
            </div>
            <p className="bf-note">
              整本页序不锁死：节与节之间可以自由插入白页（或换成任意版式的页），页码自动后移。
              <a href="examples/2027-weekly.pdf" target="_blank" rel="noreferrer">2027 周计划样张</a>就是这样排的——年历之后、逐月内容之前，
              补了两页空白横线页（样张第 2–3 页）。
              原因是八分周视图在整本里每周横跨一对页：跨页版式必须按「偶数页在左、奇数页在右」起排，
              若前面各节恰好凑成单数页，下一页就会落到奇数位，左右两半连同装订侧一起颠倒；
              补一张白页把下一页推回偶数位，对页就永远端正。白页之后随时能换成月历、打卡，或直接删掉。
            </p>
          </div>
        </section>
        <section id="patterns" className="section">
          <SectionHead
            code="PATTERNS"
            title="版式样张"
            lede="样张是排版结果，不是产品本身。每一张 PDF 都由同一套 LaTeX 规则生成：版心、字体、线宽、装订侧与页序都可复现。"
          />

          <h3 className="group-title"><span>基础纸面</span><i>BASIC</i></h3>
          <div className="pat-grid">
            {BASIC_PATTERNS.map((p) => (
              <PatternCard key={p.code} p={p} />
            ))}
          </div>

          <h3 className="group-title"><span>复刻系列</span><i>REPLICA</i></h3>
          <div className="pat-grid pat-grid-wide">
            {REPLICA_PATTERNS.map((p) => (
              <PatternCard key={p.code} p={p} />
            ))}
          </div>

          <h3 className="group-title"><span>日程页面</span><i>SCHEDULE</i></h3>
          <div className="pat-grid">
            {SCHEDULE_PATTERNS.map((p) => (
              <PatternCard key={p.code} p={p} />
            ))}
          </div>
        </section>

        <section id="examples" className="section">
          <SectionHead
            code="SAMPLES"
            title="成品样例"
            lede="这里放的是实际生成的 PDF：整本、多节、跨页与装订边都经过排版引擎处理，打开即可查看最终纸面。"
          />
          <ul className="ex-list">
            {EXAMPLES.map(([label, file]) => (
              <li key={file}>
                <a href={`examples/${file}`} target="_blank" rel="noreferrer">
                  <span className="ex-name">{label}</span>
                  <span className="ex-file">{file}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section id="github" className="section section-oss">
          <div className="oss-banner">
            <GitHubIcon className="oss-icon" />
            <div className="oss-copy">
              <h2>在 GitHub 上开源</h2>
              <p>
                排版引擎、全部版式和整个前端都在仓库里，源码完全公开。
                发现 bug、想要新纸型或新版式，欢迎提{" "}
                <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">Issue</a> 和{" "}
                <a href={`${REPO_URL}/pulls`} target="_blank" rel="noreferrer">PR</a>
                ；觉得好用的话，给个 Star 是最大的鼓励。
              </p>
            </div>
            <div className="oss-actions">
              <a className="btn btn-paper" href={REPO_URL} target="_blank" rel="noreferrer">
                <GitHubIcon className="btn-gh-icon" />
                Star / 看源码
              </a>
              <a className="btn btn-dark-ghost" href={RELEASES_URL} target="_blank" rel="noreferrer">
                Releases
              </a>
            </div>
          </div>
        </section>

        <section id="download" className="section section-download">
          <SectionHead
            code="DOWNLOAD"
            title="下载"
            lede={`安装包由 GitHub Actions 按 tag 自动构建并发布到 GitHub Releases，当前版本 v${APP_VERSION}；也可以直接从源码跑起来。`}
          />
          <div className="dl-grid">
            {DOWNLOADS.map((d) => (
              <a className="dl-card" key={d.asset} href={RELEASE_ASSET(d.asset)}>
                <strong>{d.label}</strong>
                <span>{d.sub}</span>
                <span className="dl-file">{d.asset}</span>
              </a>
            ))}
          </div>
          <p className="dl-more">
            需要 .app 更新包、历史版本或校验和？见{" "}
            <a href={RELEASES_URL} target="_blank" rel="noreferrer">GitHub Releases</a>。
          </p>
          <pre className="code">{`git clone https://github.com/asinkLuno/base6-techo.git
yarn install
yarn tauri dev`}</pre>
        </section>
      </main>

      <footer className="footer">
        <p>
          <span className="seal" aria-hidden="true">自印</span>
        </p>
        <p>
          <strong>base6-techo</strong> —— 为自印手帐而生 ｜{" "}
          <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub 开源</a> ｜ Tauri · React · LaTeX
        </p>
      </footer>
    </MotionConfig>
  );
}
