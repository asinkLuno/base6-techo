#!/usr/bin/env node
// 生成版式样张展示页（介绍 + 画廊 + 下载，单文件零依赖）：
//   - 扫描 examples/ 下的 PDF 与对页 PNG（由 scripts/gen-examples.sh 生成）
//   - 产出 showcase/index.html，资源以相对路径 ../examples/ 引用，不复制文件
//   - 展示层字体 showcase/fonts/kinghwa-subset.woff2 由仓库根目录的京華老宋体
//     子集化而来（33 MB → ~291 KB）。重新子集化的方法：
//       1. node scripts/gen-showcase.mjs                       # 生成页面
//       2. 提取页面用字（ASCII + 全部非 ASCII 字符）写入临时文件
//       3. 在任意临时目录 `yarn add subset-font` 后调用：
//          subsetFont(readFileSync('京華老宋体v3.0.ttf'), 字符集, { targetFormat: 'woff2' })
//          写入 showcase/fonts/kinghwa-subset.woff2
//
// 用法：node scripts/gen-showcase.mjs

import { readdir, stat, readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXAMPLES = path.join(ROOT, "examples");
const OUT_DIR = path.join(ROOT, "showcase");
const REPO = "https://github.com/asinkLuno/base6-techo";

// ---- 尺寸表（与 gen-examples.sh 一致；w/h 为毫米，用于真实比例展示）----
const SIZES = [
  { id: "a5", label: "A5", mm: "148 × 210", w: 148, h: 210 },
  { id: "a6p", label: "A6 口袋", mm: "95 × 171", w: 95, h: 171 },
  { id: "a7", label: "A7", mm: "80 × 120", w: 80, h: 120 },
];

// ---- 版式元数据（中文名与分组同前端 schema.ts；参数说明同 gen-examples.sh 默认值）----
const GROUPS = [
  {
    id: "basic",
    name: "基础",
    note: "六种经典书写格线，间距、线色、线宽皆可调。",
    patterns: [
      {
        id: "ruled",
        name: "横线",
        desc: "等距横线左右贯通内容区，最朴素也最常用的书写面。",
        spec: "行距 8 mm · 线宽 0.2 pt",
        ink: "#7A7A7A",
      },
      {
        id: "dots",
        name: "点阵",
        desc: "自内容区中心向四周扩散的等距点阵，几何中心一点单独着墨。",
        spec: "间距 5 mm · 点径 0.3 mm · 中心点着墨",
        ink: "#7A7A7A",
      },
      {
        id: "grid",
        name: "网格",
        desc: "等距方格纸，四周锁边收口，格区在内容区内居中。",
        spec: "间距 5 mm · 线宽 0.2 pt",
        ink: "#7A7A7A",
      },
      {
        id: "seyes",
        name: "法文格",
        latin: "Séyès",
        desc: "法国小学生格纸：四细一主，8 mm 主格，红色竖线立边。",
        spec: "主格 8 mm · 主线 0.2 pt · 红边线 0.4 pt",
        ink: "#9DB0CF",
      },
      {
        id: "us-ruled",
        name: "美式横线",
        desc: "美式拍纸簿制式：蓝色宽横线加左侧红色边线。",
        spec: "行距 8.7 mm · 蓝线 0.2 pt · 红边线 0.4 pt",
        ink: "#8FB0D8",
      },
      {
        id: "vertical",
        name: "古文竖排",
        desc: "文武线双框加界栏，供自右向左的竖排书写。",
        spec: "栏距 10 mm · 外框 0.5 pt · 内框 0.18 pt",
        ink: "#26231E",
      },
    ],
  },
  {
    id: "replica",
    name: "复刻",
    note: "对照实物复刻的笔记本内页与旧式日记 layouts。",
    patterns: [
      {
        id: "hogen",
        name: "方眼罫",
        desc: "复刻 Midori(MD) 笔记内页的方眼罫：5 mm 格，偶数格线向外伸出，每十格以点相连。",
        spec: "间距 5 mm · 格隙 1 mm · 线宽 0.7",
        ink: "#A9D1AE",
      },
      {
        id: "hakubunkan-toyo-nikki",
        name: "博文館・當用日記",
        desc: "复刻博文館旧式日记，一页一天：受信、发信、摘记栏与天気・気温列。",
        spec: "一页一天 · 日期逐页推进 · 线色 #A9D1AE",
        ink: "#A9D1AE",
      },
      {
        id: "hakubunkan-kaichu-nikki",
        name: "博文館・懐中日記",
        desc: "复刻博文館袖珍日记，一页两天，注旧暦与星期，侧栏记天気・気温。",
        spec: "一页两天 · 旧暦数字 · 线宽 0.4 pt",
        ink: "#7A7A7A",
      },
    ],
  },
];

// ---- 工具 ----
const esc = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const fmtSize = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

/** 读 PNG IHDR，取像素宽高（防止布局跳动） */
async function pngSize(file) {
  const buf = await readFile(file);
  if (buf.readUInt32BE(12) !== 0x49484452) throw new Error(`不是 PNG：${file}`);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function collectAssets() {
  const files = new Set(await readdir(EXAMPLES));
  const assets = new Map(); // "kind|size" -> {pdf, p2, p3}
  const missing = [];
  for (const g of GROUPS)
    for (const p of g.patterns)
      for (const s of SIZES) {
        const pdf = `${p.id}-${s.id}.pdf`;
        const p2 = `${p.id}-${s.id}-p-2.png`;
        const p3 = `${p.id}-${s.id}-p-3.png`;
        for (const f of [pdf, p2, p3]) if (!files.has(f)) missing.push(f);
        const [pdfStat, p2Dim, p3Dim] = await Promise.all([
          stat(path.join(EXAMPLES, pdf)),
          pngSize(path.join(EXAMPLES, p2)),
          pngSize(path.join(EXAMPLES, p3)),
        ]);
        assets.set(`${p.id}|${s.id}`, {
          pdf: { name: pdf, bytes: pdfStat.size },
          p2: { name: p2, ...p2Dim },
          p3: { name: p3, ...p3Dim },
        });
      }
  if (missing.length) throw new Error(`examples/ 缺少以下文件，请先运行 scripts/gen-examples.sh：\n  ${missing.join("\n  ")}`);
  return assets;
}

// ---- HTML 片段 ----
function heroSpread(assets) {
  // 首屏对页选用懐中日記：一天两栏 + 天気・気温列最具复刻气质
  const kind = "hakubunkan-kaichu-nikki";
  const size = "a5";
  const a = assets.get(`${kind}|${size}`);
  const p = GROUPS.flatMap((g) => g.patterns).find((x) => x.id === kind);
  return `
    <figure class="hero-spread">
      <div class="spread">
        <img src="../examples/${a.p2.name}" width="${a.p2.w}" height="${a.p2.h}" alt="${esc(p.name)} A5 样张第 2 页" class="page left">
        <img src="../examples/${a.p3.name}" width="${a.p3.w}" height="${a.p3.h}" alt="${esc(p.name)} A5 样张第 3 页" class="page right">
        <i class="gutter" aria-hidden="true"></i>
      </div>
      <figcaption>
        <span class="mono cap-label">${esc(p.id)} · A5 对页</span>
        <span class="cap-text">装订侧的 <span class="mono">base6</span> 水印随页码奇偶镜像，居于中缝两侧——摊开即是一本装订好的手帐。</span>
      </figcaption>
    </figure>`;
}

/** 装订内外边距图解：左页（偶）装订在右，右页（奇）装订在左 */
function bindingDemo() {
  const page = (dir) => `
    <div class="demo-page">
      <i class="strip ${dir === "left" ? "outer" : "binding"}"></i>
      <span class="demo-fill"></span>
      <i class="strip ${dir === "left" ? "binding" : "outer"}"></i>
    </div>`;
  const labels = (dir) => `
    <div class="demo-labels mono" aria-hidden="true">
      <span class="${dir === "left" ? "l-outer" : "l-binding"}">${dir === "left" ? "外" : "内"}</span>
      <span></span>
      <span class="${dir === "left" ? "l-binding" : "l-outer"}">${dir === "left" ? "内" : "外"}</span>
    </div>`;
  return `
    <div class="binding-demo">
      <div class="demo-pages">${page("left")}${page("right")}</div>
      <div class="demo-labels-row" aria-hidden="true">${labels("left")}${labels("right")}</div>
      <div class="demo-legend mono">
        <span><i class="swatch binding"></i>装订边（内）· 窄</span>
        <span><i class="swatch outer"></i>外翻边（外）· 宽</span>
      </div>
      <p class="demo-note">
        装订边向内让位、外翻边向外放宽；页码、页眉与装订侧水印随页码奇偶自动镜像。
      </p>
    </div>`;
}

function specimenArticle(p, group, assets) {
  // 对页宽度按纸面毫米等比缩放（样张 PNG 同为 150 DPI，比例天然真实）：
  // 以 A5 对页为满幅基准，A6P/A7 的 .pages 宽度 = 页宽毫米比。
  const base = SIZES[0];
  const toggles = SIZES.map((s, i) =>
    `<button type="button" data-size="${s.id}" data-spread="${((s.w / base.w) * 100).toFixed(1)}"
      data-mm="${s.mm}" aria-pressed="${i === 0}"
      title="${s.label} · ${s.mm} mm">${s.label}</button>`).join("");

  const pages = SIZES.map((s, i) => {
    const a = assets.get(`${p.id}|${s.id}`);
    return `
      <img src="../examples/${a.p2.name}" width="${a.p2.w}" height="${a.p2.h}" data-size="${s.id}"
        alt="${esc(p.name)} ${s.label}样张第 2 页" class="page left" ${i ? "hidden" : ""}>
      <img src="../examples/${a.p3.name}" width="${a.p3.w}" height="${a.p3.h}" data-size="${s.id}"
        alt="${esc(p.name)} ${s.label}样张第 3 页" class="page right" ${i ? "hidden" : ""}>`;
  }).join("");

  const pdf0 = assets.get(`${p.id}|a5`).pdf;
  return `
  <article class="specimen reveal" id="p-${esc(p.id)}" data-kind="${esc(p.id)}" style="--pat-ink: ${esc(p.ink)}">
    <div class="meta">
      <p class="id mono">${esc(p.id)}</p>
      <h3 class="name">${esc(p.name)}${p.latin ? `<small class="latin">${esc(p.latin)}</small>` : ""}</h3>
      <p class="desc">${esc(p.desc)}</p>
      <p class="spec mono">${esc(p.spec)}</p>
      <p class="ink-line mono"><i class="ink-chip" aria-hidden="true"></i>线色 <span class="ink-code">${esc(p.ink)}</span></p>
      <div class="controls">
        <div class="sizes" role="group" aria-label="选择尺寸">${toggles}</div>
        <a class="pdf-link mono" href="../examples/${esc(pdf0.name)}" download>下载 PDF ↓</a>
      </div>
    </div>
    <figure class="spec-fig">
      <div class="spread">
        <div class="pages">
          ${pages}
          <i class="gutter" aria-hidden="true"></i>
        </div>
      </div>
      <figcaption class="spec-cap mono">${base.label} · ${base.mm} mm</figcaption>
    </figure>
  </article>`;
}

function downloadTable(assets) {
  const rows = GROUPS.map((g) => {
    const head = `<tr class="group-row"><th colspan="4">${esc(g.name)}<span class="mono">${g.patterns.length} 种</span></th></tr>`;
    const body = g.patterns
      .map((p) => {
        const cells = SIZES.map((s) => {
          const a = assets.get(`${p.id}|${s.id}`);
          return `<td><a class="mono" href="../examples/${esc(a.pdf.name)}" download>PDF <em>${fmtSize(a.pdf.bytes)}</em></a></td>`;
        }).join("");
        return `<tr><th scope="row"><span class="dl-name">${esc(p.name)}</span><span class="mono dl-id">${esc(p.id)}</span></th>${cells}</tr>`;
      })
      .join("\n");
    return head + "\n" + body;
  }).join("\n");

  const sizeHeads = SIZES.map((s) => `<th scope="col" class="mono">${s.label}<em>${s.mm} mm</em></th>`).join("");
  return `<table class="dl-table">
    <thead><tr><th scope="col">版式</th>${sizeHeads}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ---- 样式与脚本 ----
const CSS = `
@font-face {
  font-family: "KingHwa OldSong";
  src: url("fonts/kinghwa-subset.woff2") format("woff2");
  font-display: swap;
}
:root {
  --desk: #E8E5DD;
  --paper: #FEFEFB;
  --ink: #26231E;
  --ink2: #6E6960;
  --line: #D7D2C6;
  --zhu: #9E3B2B;
  --serif: "KingHwa OldSong", "Songti SC", "Noto Serif CJK SC", "SimSun", serif;
  --sans: "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Mono", Menlo, Consolas, monospace;
  --paper-pad: clamp(12px, 1.8vw, 22px);
}
* { box-sizing: border-box; margin: 0; }
[hidden] { display: none !important; }
html { scroll-behavior: smooth; overflow-x: clip; }
body { overflow-x: clip; }
section, article { scroll-margin-top: 70px; }
body {
  background: var(--desk);
  color: var(--ink);
  font: 15.5px/1.85 var(--sans);
  -webkit-font-smoothing: antialiased;
}
.mono { font-family: var(--mono); }
img { display: block; }
a { color: inherit; }
:focus-visible { outline: 2px solid var(--zhu); outline-offset: 2px; }
::selection { background: #E5D5C5; }

/* ---- 书脊 ---- */
.spine {
  position: fixed; left: 0; top: 0; bottom: 0; width: 52px; z-index: 20;
  display: flex; align-items: center; justify-content: center;
  border-right: 1px solid var(--line);
  writing-mode: vertical-rl; letter-spacing: .42em;
  font-family: var(--mono); font-size: 11px; color: var(--ink2);
  user-select: none;
}
@media (max-width: 960px) { .spine { display: none; } }

.wrap { max-width: 1160px; margin: 0 auto; padding: 0 clamp(20px, 4.5vw, 56px); }
@media (min-width: 961px) { body { padding-left: 52px; } }

/* ---- 顶栏 ---- */
nav {
  position: sticky; top: 0; z-index: 10;
  background: var(--desk);
  border-bottom: 1px solid var(--line);
}
nav .nav-in {
  max-width: 1160px; margin: 0 auto; padding: 0 clamp(20px, 4.5vw, 56px);
  min-height: 54px; display: flex; align-items: center; gap: clamp(12px, 2.4vw, 26px);
}
.wordmark { font-family: var(--serif); font-size: 19px; text-decoration: none; letter-spacing: .06em; white-space: nowrap; }
.wordmark b { font-weight: normal; }
.wordmark span { color: var(--zhu); }
nav a.link { font-size: 13px; color: var(--ink2); text-decoration: none; letter-spacing: .12em; white-space: nowrap; }
nav a.link:hover { color: var(--ink); }
nav .gh { margin-left: auto; font-size: 12.5px; }

/* ---- 介绍 ---- */
#intro { padding-top: clamp(56px, 9vh, 104px); padding-bottom: 24px; }
.eyebrow {
  font-family: var(--mono); font-size: 12px; letter-spacing: .3em;
  color: var(--zhu); margin-bottom: 22px;
}
.eyebrow::before { content: "◆ "; font-size: 9px; vertical-align: 2px; }
h1 {
  font-family: var(--serif); font-weight: 400;
  font-size: clamp(42px, 6.4vw, 80px); line-height: 1.16; letter-spacing: .015em;
}
.intro-grid { display: grid; grid-template-columns: minmax(340px, 5fr) 6fr; gap: clamp(32px, 5vw, 72px); align-items: start; }
@media (max-width: 900px) { .intro-grid { grid-template-columns: 1fr; } }
.lead { margin-top: 26px; max-width: 46ch; color: var(--ink); }
.lead em { font-style: normal; border-bottom: 1px solid var(--zhu); }
.facts { margin-top: 30px; display: flex; flex-wrap: wrap; row-gap: 14px; list-style: none; padding: 0; }
.facts li {
  font-family: var(--mono); font-size: 12.5px; color: var(--ink2); padding: 0 18px;
  border-left: 1px solid var(--line);
}
.facts li:first-child { padding-left: 0; border-left: 0; }
.facts b { display: block; font-size: 20px; font-weight: 500; color: var(--ink); margin-bottom: 2px; }

/* ---- 对页展示（纸面 + 中缝） ---- */
.paper {
  background: var(--paper); border: 1px solid #E2DDD1; border-radius: 2px;
  box-shadow: 0 1px 2px rgba(38,35,30,.07), 0 18px 44px -22px rgba(38,35,30,.28);
  padding: var(--paper-pad);
}
/* 样张对页不垫纸卡，直接落在桌面上：宽度随所选尺寸收缩（A5 时占满整列） */
.spec-fig { width: min(var(--spread, 100%), 100%); margin: 0 auto; }
.pages, .hero-spread .spread {
  box-shadow: 0 1px 2px rgba(38,35,30,.08), 0 20px 44px -26px rgba(38,35,30,.38);
}
.spread { position: relative; display: flex; justify-content: center; align-items: flex-start; }
.pages { position: relative; display: flex; justify-content: center; margin: 0 auto; }
.page { width: calc(50% - 1px); height: auto; }
.gutter {
  position: absolute; top: 0; bottom: 0; left: 50%; width: clamp(22px, 8.5%, 46px);
  transform: translateX(-50%); pointer-events: none;
  background: linear-gradient(90deg,
    rgba(38,35,30,0) 0%, rgba(38,35,30,.045) 26%, rgba(38,35,30,.16) 48%,
    rgba(38,35,30,.21) 50%, rgba(38,35,30,.16) 52%, rgba(38,35,30,.045) 74%,
    rgba(38,35,30,0) 100%);
}
.spec-cap { margin-top: 12px; text-align: center; font-size: 11px; letter-spacing: .1em; color: var(--ink2); }
.hero-spread { margin: 0; }
.hero-spread .spread { max-width: 620px; margin-left: auto; }
.hero-spread figcaption { margin-top: 14px; max-width: 620px; margin-left: auto; }
.hero-spread .cap-label { display: block; font-size: 11.5px; letter-spacing: .12em; color: var(--zhu); margin-bottom: 6px; }
.hero-spread .cap-text { display: block; font-size: 13px; color: var(--ink2); line-height: 1.8; }
.hero-spread .cap-text .mono { font-size: 11.5px; color: var(--ink); }
@media (max-width: 900px) { .hero-spread .spread, .hero-spread figcaption { margin-left: 0; } }

/* ---- 装订图解 ---- */
.binding-demo { margin: clamp(48px, 8vh, 88px) auto 0; max-width: 720px; }
.demo-pages { display: flex; border: 1px solid #CFC9BC; background: var(--paper); box-shadow: 0 10px 26px -18px rgba(38,35,30,.35); }
.demo-page { flex: 1; display: flex; height: 74px; }
.demo-page + .demo-page { border-left: 2px double #B9B2A2; }
.demo-fill { flex: 1; }
.strip { width: 15%; }
.strip.binding { background: repeating-linear-gradient(-45deg, #D8B5A9 0 5px, #E8D3CA 5px 10px); }
.strip.outer { background: repeating-linear-gradient(-45deg, #D9D4C7 0 5px, #EAE6DC 5px 10px); }
.demo-labels-row { display: flex; margin-top: 8px; }
.demo-labels { flex: 1; display: flex; font-size: 11px; color: var(--ink2); }
.demo-labels span { width: 15%; text-align: center; }
.demo-labels span:nth-child(2) { width: 70%; }
.demo-labels .l-binding { color: var(--zhu); font-weight: 600; }
.demo-legend { display: flex; justify-content: center; gap: 30px; margin-top: 12px; font-size: 11.5px; color: var(--ink2); }
.demo-legend .swatch {
  display: inline-block; width: 14px; height: 10px; margin-right: 7px;
  border: 1px solid rgba(38,35,30,.15); border-radius: 1px; vertical-align: -1px;
}
.demo-legend .swatch.binding { background: repeating-linear-gradient(-45deg, #D8B5A9 0 4px, #E8D3CA 4px 8px); }
.demo-legend .swatch.outer { background: repeating-linear-gradient(-45deg, #D9D4C7 0 4px, #EAE6DC 4px 8px); }
.demo-note { margin-top: 10px; text-align: center; font-size: 13.5px; color: var(--ink2); }

/* ---- 版式画廊 ---- */
#gallery { padding-top: clamp(56px, 9vh, 110px); }
.sec-head { display: flex; align-items: baseline; gap: 18px; margin-bottom: 8px; }
.sec-head h2 { font-family: var(--serif); font-weight: 400; font-size: clamp(26px, 3vw, 34px); letter-spacing: .06em; }
.sec-head .mono { font-size: 12px; color: var(--ink2); }
.sec-note { font-size: 13.5px; color: var(--ink2); margin-bottom: 18px; }
.group { margin-bottom: clamp(40px, 6vh, 64px); }

.specimen {
  display: grid; grid-template-columns: minmax(280px, 4fr) 7fr;
  gap: clamp(28px, 4vw, 64px); padding: clamp(32px, 5vh, 52px) 0;
  border-top: 1px solid var(--line);
  align-items: center;
}
@media (max-width: 860px) { .specimen { grid-template-columns: 1fr; } .specimen .paper { order: -1; } }
.specimen .id { font-size: 11.5px; letter-spacing: .18em; color: var(--ink); }
.specimen .id::before { content: "◆ "; color: var(--pat-ink); font-size: 8px; vertical-align: 2px; }
.specimen .name {
  font-family: var(--serif); font-weight: 400; font-size: clamp(24px, 2.6vw, 31px);
  margin: 8px 0 10px; letter-spacing: .04em;
}
.specimen .latin { font-size: 13px; color: var(--ink2); margin-left: 12px; letter-spacing: .08em; }
.specimen .desc { font-size: 14px; color: var(--ink); max-width: 40ch; }
.specimen .spec { margin-top: 10px; font-size: 12px; color: var(--ink2); }
.ink-line { margin-top: 6px; font-size: 12px; color: var(--ink2); }
.ink-chip {
  display: inline-block; width: 18px; height: 10px; margin-right: 6px;
  background: var(--pat-ink); border-radius: 1px; vertical-align: baseline; border: 1px solid rgba(38,35,30,.18);
}
.ink-code { color: var(--ink); }

.controls { margin-top: 18px; display: flex; align-items: center; flex-wrap: wrap; gap: 14px; }
.sizes { display: inline-flex; border: 1px solid var(--line); border-radius: 2px; overflow: hidden; background: var(--paper); }
.sizes button {
  appearance: none; border: 0; background: transparent; cursor: pointer;
  font-family: var(--mono); font-size: 12px; color: var(--ink2);
  padding: 6px 13px; border-left: 1px solid var(--line);
}
.sizes button:first-child { border-left: 0; }
.sizes button[aria-pressed="true"] { color: var(--ink); box-shadow: inset 0 -2px 0 var(--pat-ink); }
.sizes button:hover { color: var(--ink); }
.pdf-link {
  font-size: 12.5px; text-decoration: none; color: var(--zhu);
  border-bottom: 1px solid color-mix(in srgb, var(--zhu) 45%, transparent); padding-bottom: 1px;
}
.pdf-link:hover { border-bottom-color: var(--zhu); }

.specimen .spread img { transition: opacity .25s ease; }
.specimen .pages:hover { box-shadow: 0 1px 2px rgba(38,35,30,.08), 0 26px 54px -26px rgba(38,35,30,.46); }

/* ---- 下载 ---- */
#download { padding-top: clamp(56px, 9vh, 110px); }
.dl-lead { font-size: 14px; color: var(--ink2); max-width: 62ch; margin-bottom: 28px; }
.dl-table { width: 100%; border-collapse: collapse; background: var(--paper); border: 1px solid #E2DDD1; box-shadow: 0 12px 34px -22px rgba(38,35,30,.3); }
.dl-table thead th {
  font-size: 11.5px; text-align: left; padding: 14px 18px; letter-spacing: .14em;
  border-bottom: 1px solid var(--line); color: var(--ink);
}
.dl-table thead th em { display: block; font-style: normal; font-size: 10.5px; color: var(--ink2); letter-spacing: .04em; margin-top: 2px; }
.dl-table td, .dl-table tbody th { padding: 12px 18px; border-bottom: 1px solid #EAE6DC; text-align: left; }
.dl-table tbody tr:hover { background: #FBFAF6; }
.dl-table .group-row th {
  font-family: var(--serif); font-weight: 400; font-size: 17px; letter-spacing: .12em;
  background: #F3F0E8; padding: 9px 18px;
}
.dl-table .group-row .mono { font-family: var(--mono); font-size: 11px; color: var(--ink2); margin-left: 12px; letter-spacing: .1em; }
.dl-name { font-size: 14.5px; }
.dl-id { display: block; font-size: 10.5px; color: var(--ink2); letter-spacing: .12em; margin-top: 1px; }
.dl-table td a { font-size: 12.5px; text-decoration: none; color: var(--ink); border-bottom: 1px solid var(--line); }
.dl-table td a:hover { color: var(--zhu); border-bottom-color: var(--zhu); }
.dl-table td a em { font-style: normal; color: var(--ink2); font-size: 11px; margin-left: 5px; }
@media (max-width: 720px) {
  .dl-table thead { display: none; }
  .dl-table tr { display: block; padding: 10px 14px; }
  .dl-table td, .dl-table tbody th { display: inline-block; border: 0; padding: 4px 10px 4px 0; }
  .dl-table .group-row th { display: block; }
}

/* ---- 收尾 ---- */
.cta-block { margin: clamp(56px, 10vh, 110px) 0 0; }
.cta-sheet { padding: clamp(32px, 5vw, 56px); text-align: center; }
.cta-sheet h2 { font-family: var(--serif); font-weight: 400; font-size: clamp(24px, 3vw, 34px); letter-spacing: .05em; }
.cta-sheet p { margin: 14px auto 26px; max-width: 52ch; color: var(--ink2); font-size: 14.5px; }
.btns { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
.btn {
  text-decoration: none; font-size: 14px; letter-spacing: .06em;
  padding: 11px 26px; border-radius: 2px; border: 1px solid transparent;
}
.btn.primary { background: var(--zhu); color: #FDF9F3; }
.btn.primary:hover { background: #8C3222; }
.btn.ghost { border-color: #C9C3B4; color: var(--ink); }
.btn.ghost:hover { border-color: var(--ink); }

footer.wrap { margin: clamp(56px, 9vh, 96px) auto 0; border-top: 1px solid var(--line); padding-top: 26px; padding-bottom: 40px; }
footer .fin { display: flex; flex-wrap: wrap; gap: 8px 28px; font-size: 12px; color: var(--ink2); }
footer .fin a { color: inherit; }
footer .fin .sig { font-family: var(--serif); font-size: 14px; color: var(--ink); letter-spacing: .2em; }

/* ---- 动效（尊重 reduced-motion） ---- */
@media (prefers-reduced-motion: no-preference) {
  .js .spec-fig { transition: width .4s cubic-bezier(.2,.7,.2,1); }
  /* 仅在 JS 可用时才隐藏待显元素（.js 由脚本加到 <html> 上） */
  .js .reveal { opacity: 0; transform: translateY(14px); transition: opacity .7s ease, transform .7s ease; }
  .js .reveal.in { opacity: 1; transform: none; }
  @keyframes openbook {
    from { opacity: 0; transform: translateX(var(--slide)); }
    to { opacity: 1; transform: none; }
  }
  .hero-spread .page { animation: openbook .9s cubic-bezier(.2,.7,.2,1) backwards; }
  .hero-spread .page.left { --slide: 26px; }
  .hero-spread .page.right { --slide: -26px; animation-delay: .08s; }
  .hero-spread .gutter { animation: fadegut 1.1s ease .15s backwards; }
  @keyframes fadegut { from { opacity: 0; } }
}
`;

const JS = `
(() => {
  document.documentElement.classList.add("js");
  // 尺寸切换：每个样张内，按钮 ↔ 图片 ↔ PDF 链接联动
  for (const art of document.querySelectorAll(".specimen")) {
    const btns = art.querySelectorAll(".sizes button");
    const imgs = art.querySelectorAll("img.page");
    const link = art.querySelector(".pdf-link");
    btns.forEach((btn) => btn.addEventListener("click", () => {
      btns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      imgs.forEach((im) => { im.hidden = im.dataset.size !== btn.dataset.size; });
      art.querySelector(".spec-fig").style.setProperty("--spread", btn.dataset.spread + "%");
      art.querySelector(".spec-cap").textContent =
        btn.textContent.trim() + " · " + btn.dataset.mm + " mm";
      link.href = "../examples/" + art.dataset.kind + "-" + btn.dataset.size + ".pdf";
    }));
  }
  // 滚动淡入
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const targets = document.querySelectorAll(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    targets.forEach((t) => t.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { threshold: 0.1 });
  targets.forEach((t) => io.observe(t));
})();
`;

// ---- 组装 ----
async function main() {
  const assets = await collectAssets();
  const nPatterns = GROUPS.reduce((n, g) => n + g.patterns.length, 0);
  const totalPdf = nPatterns * SIZES.length;

  const gallery = GROUPS.map((g) => `
  <section class="group">
    <div class="sec-head reveal"><h2>${esc(g.name)}</h2><span class="mono">${g.patterns.length} 种版式</span></div>
    <p class="sec-note reveal">${esc(g.note)}</p>
    ${g.patterns.map((p) => specimenArticle(p, g, assets)).join("\n")}
  </section>`).join("\n");

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>base6 techo · 版式样张集</title>
<meta name="description" content="base6-techo 生成的手帐版式样张：${nPatterns} 种版式 × ${SIZES.length} 种尺寸，按真实比例展示，可下载 PDF 自行打印装订。">
<style>${CSS}</style>
</head>
<body>
<div class="spine" aria-hidden="true">base6 · techo — 版式样张集</div>

<nav>
  <div class="nav-in">
    <a class="wordmark" href="#top"><b>base<span>6</span></b>&ensp;techo</a>
    <a class="link" href="#intro">介绍</a>
    <a class="link" href="#gallery">版式</a>
    <a class="link" href="#download">下载</a>
    <a class="link gh mono" href="${REPO}" target="_blank" rel="noopener">GitHub ↗</a>
  </div>
</nav>

<header id="intro" class="wrap">
  <div class="intro-grid">
    <div>
      <p class="eyebrow">手帐版式生成器 · LATEX / TIKZ</p>
      <h1>一版既成，<br>整本装订。</h1>
      <p class="lead">
        base6-techo 用 LaTeX 排出毫米级精度的手帐内页：<em>装订边与外翻边自动区分</em>，
        页码、页眉、水印随奇偶页镜像，多个版式按序拼成一本可直接装订的 PDF。
        本页是它的全部基础与复刻版式样张——按真实比例陈列，可按尺寸取走打印。
      </p>
      <ul class="facts">
        <li><b>${nPatterns}</b>种版式</li>
        <li><b>${SIZES.length}</b>种尺寸</li>
        <li><b>${totalPdf}</b>份样张</li>
        <li><b>mm</b>级版面控制</li>
      </ul>
    </div>
    ${heroSpread(assets)}
  </div>
  ${bindingDemo()}
</header>

<main id="gallery" class="wrap">
  <div class="sec-head reveal"><h2>版式样张</h2><span class="mono">${nPatterns} KINDS · 3 SIZES</span></div>
  <p class="sec-note reveal">每份样张为三页 PDF：首页空白，后两页为内容页。以下对页取自第 2、3 页，中缝即装订线；
  三种尺寸以同一比例尺显示（A5 对页为满幅基准），页面宽窄即纸面的真实关系。</p>
  ${gallery}
</main>

<section id="download" class="wrap">
  <div class="sec-head reveal"><h2>下载样张</h2><span class="mono">SAMPLE PDF</span></div>
  <p class="dl-lead reveal">同一版式的三种尺寸由同一套参数生成，仅版心随纸面缩放；样张由
  <a class="mono" href="${REPO}/blob/master/scripts/gen-examples.sh" target="_blank" rel="noopener">scripts/gen-examples.sh</a>
  输出，参数与前端默认值一致。</p>
  ${downloadTable(assets)}

  <div class="cta-block reveal">
    <div class="cta-sheet paper">
      <h2>想要自己的版式？</h2>
      <p>样张只是默认参数。日期范围、行距、线色、字体、拼版方式——一切皆可调。用 base6-techo 桌面应用排版你自己的那一本。</p>
      <div class="btns">
        <a class="btn primary" href="${REPO}" target="_blank" rel="noopener">获取 base6-techo</a>
        <a class="btn ghost" href="${REPO}/blob/master/scripts/gen-examples.sh" target="_blank" rel="noopener">查看样张脚本</a>
      </div>
    </div>
  </div>
</section>

<footer class="wrap">
  <div class="fin">
    <span class="sig">base6 techo</span>
    <span>Tauri 桌面应用 · LaTeX（tectonic）排版 · TikZ 绘版</span>
    <span>样张与数据由仓库脚本生成</span>
    <span>展示字体：京華老宋体</span>
    <a href="#top">回到顶部 ↑</a>
  </div>
</footer>

<script>${JS}</script>
</body>
</html>
`;

  await mkdir(path.join(OUT_DIR, "fonts"), { recursive: true });
  const out = path.join(OUT_DIR, "index.html");
  await writeFile(out, html);
  console.log(`完成：${out}（${(html.length / 1024).toFixed(0)} KB，${nPatterns} 版式 × ${SIZES.length} 尺寸）`);
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
