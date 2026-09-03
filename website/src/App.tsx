import type { ReactNode } from "react";

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
    k: "整本拼版",
    v: "一本多节，拖拽即排序。版式、水印、拼版三层独立，拼版放在最后一步：不拼版按页序直出，方便活页打孔；骑马钉整本按 4 页补齐拼版；锁线分册按每帖纸张数分组拼版——同一套版面，活页、定页本两相宜。",
  },
  {
    k: "版式",
    v: "16 种内置：点阵、方格、横线、法文格、古文竖排、美式横线；博文館・當用日記 / 懷中日記、Midori 复刻；月历、年历、八分周视图、时间轴、打卡与追踪。",
  },
  {
    k: "水印",
    v: "沿装订侧 / 非装订侧页缘的两行小字，字号、两行间距、距边距离、颜色字体全部可调，按节独立开关并自动留出边距。",
  },
  { k: "节假日", v: "导入 ICS 日历自动提取节假日，所有日历视图红色标注；中国法定假期可直接使用 holiday-cn 数据。" },
  {
    k: "输出",
    v: "整本以 LaTeX 排版，应用内置 Tectonic 引擎直接编译，无需另装 TeX 发行版；输出矢量 PDF，任意放大不糊，可直接送印刷厂。",
  },
  { k: "参数", v: "线色线宽线型、页眉页脚模式、中英日星期、时区、水印、衬线 / 无衬线字体……每个参数都摊开给你改。" },
  { k: "纸张", v: "A4–A7、B5 / B6、TN 标准 / 护照、A6 各系等 17 种开本预置，也支持毫米级自定义。" },
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

/* 左侧毫米标尺：1 mm = 4 px，每 10 mm 一个刻度数字，0 位红线。 */
function MmRail() {
  const ticks = Array.from({ length: 520 }, (_, i) => i);
  return (
    <div className="mm-rail" aria-hidden="true">
      {ticks.map((i) => (
        <span key={i} className={`tick${i % 10 === 0 ? " t10" : i % 5 === 0 ? " t5" : ""}${i === 0 ? " t0" : ""}`}>
          {i % 10 === 0 && i > 0 && <em>{i}</em>}
        </span>
      ))}
    </div>
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
    <>
      <MmRail />

      <header className="nav">
        <a className="brand" href="#top">
          <span className="brand-mark" aria-hidden="true" />
          base6<em>-techo</em>
        </a>
        <nav>
          <a href="#spec">规格</a>
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
            <p className="eyebrow">自印手帐 · 本地桌面应用</p>
            <h1>
              整本手帐，
              <br />
              一次排成。
            </h1>
            <p className="lede">
              base6-techo 排的是<strong>整本手帐</strong>：一本多节，每节各配版式——月历、周视图、点阵、博文館日记复刻
              ；四周水印独立叠印；最后一步才做整本拼版——不拼版直出方便活页打孔，骑马钉、锁线分册自动拼版，打印装订即是成品。
              整本以 LaTeX 排版，内置 Tectonic 引擎本地编译出矢量 PDF，手帐内容不出本机。整个项目在 GitHub 上开源。
            </p>
            <div className="hero-cta">
              <a className="btn btn-solid" href="#download">下载桌面版</a>
              <a className="btn btn-ghost" href="#examples">先看成品样例</a>
              <a className="btn btn-ghost btn-gh" href={REPO_URL} target="_blank" rel="noreferrer">
                <GitHubIcon className="btn-gh-icon" />
                GitHub
              </a>
            </div>
            <p className="hero-file">base6-techo.pdf · v{APP_VERSION} · multi-section · LaTeX · vector</p>
          </div>

          <div className="hero-art">
            <span className="crop tl" aria-hidden="true" />
            <span className="crop tr" aria-hidden="true" />
            <span className="crop bl" aria-hidden="true" />
            <span className="crop br" aria-hidden="true" />
            <p className="hero-tag">自印手帐・版面生成器</p>
            <div className="sheet s-seyes pv pv-seyes"><span>A5 · 法文格</span></div>
            <div className="sheet s-kaichu">
              <img src="/img/huaizhong.png" alt="" />
              <span>懷中日記 · 复刻</span>
            </div>
            <div className="sheet s-dots pv pv-dots"><span>TN · 5 mm 点阵</span></div>
            <div className="sheet s-month pv pv-month"><span>月历</span></div>
          </div>
        </section>

        <section id="spec" className="section">
          <SectionHead
            code="SPEC"
            title="整本手帐，从版式到装订边"
            lede="版式、水印、拼版三层分开，各管各的；节假日、字体这些琐碎但也躲不掉的细节，一样都摊在明面上。"
          />
          <dl className="spec">
            {SPEC.map((s) => (
              <div className="spec-row" key={s.k}>
                <dt>{s.k}</dt>
                <dd>{s.v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="patterns" className="section">
          <SectionHead
            code="PATTERNS"
            title="版式样张"
            lede="卡片配图即样张 PDF 的首页：统一 0xProto 字体、装订侧 base6 水印，由应用实际生成；点开看整份矢量 PDF，每个版式附参数说明。"
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
            lede="以下 PDF 全部由 base6-techo 直接输出，点开即是成品效果。"
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
    </>
  );
}
