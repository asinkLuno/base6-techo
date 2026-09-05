import { useEffect, useRef, useState } from "react";
import rough from "roughjs";
import {
  GROUPS,
  SIZES,
  PAGE_W,
  PAGE_H,
  HANDWRITING_SIMPLIFIED,
  HANDWRITING_LOTUS,
  type Pattern,
  type Group,
  type Period,
} from "../data/site";

// ---- 手写布局参数（A5 页面坐标，viewBox 875×1241）----
// 手写布局基准（A5 页面坐标，viewBox 875×1241；A6P/A7 相对它等比缩放）
// 手写布局（仅 A5 样张覆盖；A6P/A7 不叠加手写）
const SCALE = PAGE_W / 148; // px/mm（A5）
const FONT_PX = 60; // 竖排字距 14mm，大字更有“写字”气场
const ADV = 46; // 横线散文每字前进量（px，≈7.8mm，一行 15 字）
const LINE0 = 15; // A5 横线第 0 条的毫米 y（由 margins()+centered() 推导）
const START_LINE = 1; // 首行落在第 1 条横线上（版芯 23–191mm 共 22 行全部可用）
const ROT = [-2.4, 2.6, 1.9, -2.0, -2.8, 3.0, 1.6, -2.2, 2.4, -2.6, 2.0, -2.2];
const DY = [0.7, -0.5, 0.5, -0.6, 1.0, -0.7, 0.4, -0.4, 0.8, -0.6, 0.3, -0.5];

interface HandChar {
  ch: string;
  x: number;
  y: number;
  rot: number;
  d: string;
  /** x 的语义：start=左缘（横排逐字右移），middle=居中（竖排列中心）。默认 start。 */
  anchor?: "start" | "middle";
  /** 字号 px；缺省用全局 FONT_PX。 */
  size?: number;
  /** 所属样张页（对页跨页书写时区分左右页）；默认第 2 页。 */
  page?: 2 | 3;
}

// 手绘标记：线段 l（下划线、划线完成）、圆圈 c（打卡框；fill=子弹笔记的实心任务点）、rough.js 预生成的手绘路径 p（立方体棱线）。
type Mark =
  | { t: "l"; x1: number; y1: number; x2: number; y2: number; d: string }
  | { t: "c"; cx: number; cy: number; r: number; d: string; fill?: boolean }
  | { t: "p"; dPath: string; d: string };

const INK_MM = 0.15; // 手绘端点抖动幅度（mm），让尺规线看起来是手描的
function jit(i: number): number {
  return (((i * 7) % 5) - 2) * INK_MM;
}
function mkLine(x1: number, y1: number, x2: number, y2: number, i: number, d: string): Mark {
  return {
    t: "l",
    x1: Math.round((x1 + jit(i)) * SCALE * 10) / 10,
    y1: Math.round((y1 + jit(i + 1)) * SCALE * 10) / 10,
    x2: Math.round((x2 + jit(i + 2)) * SCALE * 10) / 10,
    y2: Math.round((y2 + jit(i + 3)) * SCALE * 10) / 10,
    d,
  };
}
function mkRing(cx: number, cy: number, r: number, i: number, d: string): Mark {
  return {
    t: "c",
    cx: Math.round((cx + jit(i) * 0.6) * SCALE * 10) / 10,
    cy: Math.round(cy * SCALE * 10) / 10,
    r: Math.round(r * SCALE * 10) / 10,
    d,
  };
}

// 简体 → 繁体（辰宇落雁为繁体字型；缺失的简体由 opencc 转换）
async function toTraditional(lines: string[]): Promise<string[]> {
  const { Converter } = await import("../../vendor/opencc-cn2t.js");
  const conv = Converter({ from: "cn", to: "tw" });
  return lines.map((l) => conv(l));
}

// 按 A5 横线坐标逐行排布
// 横线：逐行左起书写。第 2 页版芯 x=18mm（非装订侧在左）、第 3 页 x=13mm（装订侧互换）。
// 散文行距 8mm，正文缩到 44px 避免跨行打架；第 3 页动画接在第 2 页写完之后。
function layoutHand(
  lines: { text: string; indent?: number; center?: boolean }[],
  page: 2 | 3,
): HandChar[] {
  const chars: HandChar[] = [];
  let gi = 0;
  const x0mm = page === 2 ? 18 : 13;
  const cxmm = x0mm + 117 / 2; // 版芯水平中心
  const base = page === 2 ? 0.05 : 7.6;
  for (let li = 0; li < lines.length; li++) {
    const baseY = (LINE0 + (START_LINE + li) * 8) * SCALE;
    const { text, indent = 0, center } = lines[li];
    const w = [...text].length * ADV;
    const x0 = center ? cxmm * SCALE - w / 2 : x0mm * SCALE + indent * ADV;
    for (let ci = 0; ci < text.length; ci++) {
      const x = x0 + ADV * ci;
      const y = baseY + (DY[ci % DY.length] ?? 0);
      chars.push({
        ch: text[ci],
        x: Math.round(x),
        y: Math.round(y * 10) / 10,
        rot: ROT[ci % ROT.length] ?? 0,
        d: (base + gi * 0.03).toFixed(2) + "s",
        size: center ? 56 : 44,
        page,
      });
      gi++;
    }
  }
  return chars;
}

const CLOSING_PUNCT = "，。；：？！、）》」…";

// 长文折行：每行 15 字，段首空两格，收尾标点避头（退一字挤进本行末）。
function wrapProse(paragraphs: string[], cap = 15): { text: string; indent?: number }[] {
  const out: { text: string; indent?: number }[] = [];
  for (const para of paragraphs) {
    const tokens = [...para];
    let first = true;
    while (tokens.length) {
      const n = first ? cap - 2 : cap;
      const line: string[] = [];
      while (line.length < n && tokens.length) line.push(tokens.shift()!);
      if (tokens.length && CLOSING_PUNCT.includes(tokens[0]) && line.length) {
        tokens.unshift(line.pop()!);
        line.push(tokens.shift()!);
      }
      out.push({ text: line.join(""), indent: first ? 2 : 0 });
      first = false;
    }
  }
  return out;
}

// 横线样张：《荷塘月色》选段跨左右两页——第 2 页居中标题 + 前两段，第 3 页续写第四段；
// 版芯 22 条横线全部写满（首行第 1 条、末行第 22 条）。
function layoutRuled(): HandChar[] {
  const entries = wrapProse(HANDWRITING_LOTUS, 15);
  const page2: { text: string; indent?: number; center?: boolean }[] = [
    { text: "荷塘月色", center: true },
  ];
  let i = 0;
  while (i < entries.length && page2.length < 22) page2.push(entries[i++]);
  const page3: { text: string; indent?: number; center?: boolean }[] = [];
  while (i < entries.length && page3.length < 22) page3.push(entries[i++]);
  if (i < entries.length) console.warn("横线样张文案超出两页，末尾被舍弃");
  return [...layoutHand(page2, 2), ...layoutHand(page3, 3)];
}

// 古文竖排：每联（去标点）成一竖列，自右向左。
// 坐标按 vertical.rs 新几何重算：界栏自版芯中心向左右生成、放不下新一列即止，
// 文武线双框恰围整列数并整体居中。写字页取跨页右页 p-3（古籍先读右页）：
// A5 重算值 nx=11、外框 15.3–127.7、内框/栏块 16.5–126.5。
function layoutVertical(lines: string[]): HandChar[] {
  // A5 左页(p-3) 版芯：装订=13（左）、非装订=18（右）、页头=15、页脚=19；栏距 10、框隙 1.2
  const CX = 13, CY = 15, CW = 148 - 13 - 18;
  const SP = 10, GAP = 1.2;
  const nx = Math.floor((CW - 2 * GAP) / SP); // 栏数
  const ow = nx * SP + 2 * GAP; // 双框恰围整列数
  const ox = CX + (CW - ow) / 2; // 外框左缘：整块在版芯内水平居中
  const sx = ox + GAP; // 栏块左缘 = 内框左缘
  const iy = CY + GAP; // 内框上缘
  const ADV_V = 14; // 竖向字距 mm
  const JU_LEN = 5; // 五言一句：每联上/下两句
  const couplets = lines.map((l) => l.replace(/[，。、]/g, ""));
  const chars: HandChar[] = [];
  let gi = 0;
  for (let c = 0; c < couplets.length; c++) {
    const col = nx - 1 - c; // 自右向左
    const x = (sx + col * SP + SP / 2) * SCALE;
    const text = couplets[c];
    const top = iy + ADV_V; // 从内框上缘起第二条“线”开始写（空出首行）
    for (let j = 0; j < text.length; j++) {
      // 上句写完空一格再写下句，仿古文句读
      const y = (top + j * ADV_V + (j >= JU_LEN ? ADV_V : 0)) * SCALE;
      chars.push({
        ch: text[j],
        x: Math.round(x),
        y: Math.round(y * 10) / 10,
        rot: 0,
        d: (gi * 0.22 + 0.05).toFixed(2) + "s",
        anchor: "middle", // x 是列中心，须居中锚点，否则整字右偏半栏骑在界栏线上
        page: 3, // 覆盖层落在跨页右页
      });
      gi++;
    }
  }
  return chars;
}

// 网格：在 5mm 方格上“手绘”立方体——顶点全部落在格点，棱线交给 rough.js 手绘化。
function layoutGrid(): { chars: HandChar[]; marks: Mark[] } {
  // A5 右页(p-2) 版芯网格：格点 x=19+5a、y=15.5+5b（23×35 格）
  const chars: HandChar[] = [];
  const marks: Mark[] = [];
  // 半棱宽 6 格、棱高 6 格，顶点 T 落在格点 (74, 55.5)；棱线交给 rough.js 手绘化（复笔 + 抖动）
  const T = [74, 55.5];
  const L = [T[0] - 30, T[1] + 15], R = [T[0] + 30, T[1] + 15], M = [T[0], T[1] + 30];
  const L2 = [L[0], L[1] + 30], M2 = [M[0], M[1] + 30], R2 = [R[0], R[1] + 30];
  const px = (p: number[]) => [p[0] * SCALE, p[1] * SCALE] as [number, number];
  const sketch = (i: number) => ({ roughness: 1.4, bowing: 1.5, stroke: "#3a3630", strokeWidth: 2.2, seed: 11 + i });
  const gen = rough.generator();
  const hex = gen.polygon([T, R, R2, M2, L2, L].map(px), sketch(0));
  const inners = [
    gen.line(...px(L), ...px(M), sketch(1)),
    gen.line(...px(M), ...px(M2), sketch(2)),
    gen.line(...px(M), ...px(R), sketch(3)),
  ];
  gen.toPaths(hex).forEach((p, j) => marks.push({ t: "p", dPath: p.d, d: (0.5 + j * 0.06).toFixed(2) + "s" }));
  inners.forEach((dr, i) =>
    gen.toPaths(dr).forEach((p, j) =>
      marks.push({ t: "p", dPath: p.d, d: (1.7 + i * 0.25 + j * 0.06).toFixed(2) + "s" }),
    ),
  );
  return { chars, marks };
}

// 某尺寸某变体的样张图片基底名列表（PNG 无扩展名、含 -p-N 段）。
function pngFiles(p: Pattern, size: string, variant?: string): string[] {
  const base = `/examples/${p.id}/${size}/${p.id}-${size}${variant ? "-" + variant : ""}`;
  const frame = p.frames ?? "spread";
  if (frame === "single") return [base + "-p-2"];
  if (frame === "calendar") return size === "a7" ? [base + "-p-2", base + "-p-3"] : [base];
  return [base + "-p-2", base + "-p-3"];
}


function SpecimenSheet({ p }: { p: Pattern }) {
  const [size, setSize] = useState(SIZES[0].id);
  const [variant, setVariant] = useState<string | undefined>(p.variants?.[0]);
  const [chars, setChars] = useState<HandChar[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const sel = SIZES.find((s) => s.id === size)!;
  const frames = pngFiles(p, sel.id, variant);

  // 手写版式：结构化样张（网格）直接按版芯几何排布；诗文样张经 opencc 转繁体后排布
  useEffect(() => {
    if (p.id === "grid") {
      const o = layoutGrid();
      setChars(o.chars);
      setMarks(o.marks);
      return;
    }
    if (!p.handwriting) return;
    if (p.id === "ruled") {
      // 《荷塘月色》原文即繁体，直接排版，跨左右两页
      setChars(layoutRuled());
      setMarks([]);
      return;
    }
    let alive = true;
    toTraditional(HANDWRITING_SIMPLIFIED).then((t) => {
      if (!alive) return;
      setChars(layoutVertical(t));
      setMarks([]);
    });
    return () => { alive = false; };
  }, [p]);

  return (
    <article
      className={`specimen reveal${chars.length || marks.length ? " hs" : ""}`}
      id={`p-${p.id}`}
      data-kind={p.id}
      style={{ "--pat-ink": p.ink } as React.CSSProperties}
    >
      <div className="meta">
        <p className="id mono">{p.id}</p>
        <h3 className="name">
          {p.name}
          {p.latin ? <small className="latin">{p.latin}</small> : null}
        </h3>
        <p className="desc">{p.desc}</p>
        <p className="spec mono">{p.spec}</p>
        <p className="ink-line mono">
          <i className="ink-chip" aria-hidden="true"></i>线色 <span className="ink-code">{p.ink}</span>
        </p>
        <div className="controls">
          <div className="sizes" role="group" aria-label="选择尺寸">
            {SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                data-size={s.id}
                data-spread={s.spread}
                data-mm={s.mm}
                aria-pressed={s.id === size}
                title={`${s.label} · ${s.mm} mm`}
                onClick={() => setSize(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          {p.variants ? (
            <div className="variants" role="group" aria-label="选择变体">
              {p.variants.map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={variant === v}
                  onClick={() => setVariant(v)}
                >
                  {p.variantLabels?.[v] ?? v}
                </button>
              ))}
            </div>
          ) : null}
          <a
            className="pdf-link mono"
            href={`/examples/${p.id}/${sel.id}/${p.id}-${sel.id}${variant ? "-" + variant : ""}.json`}
            download={`base6-${p.id}.json`}
          >
            导入 JSON ↓
          </a>
        </div>
      </div>

      <figure
        className={`spec-fig${frames.length === 1 ? " single" : ""}`}
        style={{ "--spread": (frames.length === 1 ? +sel.spread / 2 : +sel.spread) + "%" } as React.CSSProperties}
      >
        <div className="spread">
          <div className="pages">
            {SIZES.map((s) => {
              const w = s.id === "a5" ? 875 : s.id === "a6p" ? 562 : 473;
              const h = s.id === "a5" ? 1241 : s.id === "a6p" ? 1010 : 709;
              const fs = pngFiles(p, s.id, variant);
              const single = fs.length === 1;
              const vlabel = variant ? (p.variantLabels?.[variant] ?? variant) : "";
              return (
                <span key={`${p.id}-${s.id}${variant ?? ""}`} style={{ display: "contents" }}>
                  {fs.map((base, i) => (
                    <img
                      key={base}
                      src={base + ".png"}
                      width={w} height={h}
                      alt={`${p.name} ${vlabel} ${s.label}样张第 ${i + 2} 页`}
                      className={`page ${single ? "single" : i === 0 ? "left" : "right"}`}
                      data-size={s.id}
                      hidden={s.id !== size}
                    />
                  ))}
                  {p.handwriting && s.id === "a5" && (
                    [2, 3]
                      .filter((pg) => pg === 2 || chars.some((c) => c.page === pg))
                      .map((pg) => (
                        <svg
                          key={pg}
                          className={`page-hand${pg === 3 ? " hand-right" : ""}`}
                          data-size="a5"
                          viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
                          aria-hidden="true"
                          hidden={s.id !== size}
                        >
                          {marks.map((m, i) =>
                            m.t === "l" ? (
                              <line
                                key={"m" + i}
                                className="hln"
                                x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2}
                                style={{ "--d": m.d, "--len": Math.hypot(m.x2 - m.x1, m.y2 - m.y1).toFixed(1) } as React.CSSProperties}
                              />
                            ) : m.t === "p" ? (
                              <path
                                key={"m" + i}
                                className="hln"
                                d={m.dPath}
                                pathLength={100}
                                style={{ "--d": m.d, "--len": 100 } as React.CSSProperties}
                              />
                            ) : (
                              <circle
                                key={"m" + i}
                                className="hrg"
                                cx={m.cx} cy={m.cy} r={m.r}
                                style={{ "--d": m.d, ...(m.fill ? { fill: "#3a3630" } : {}) } as React.CSSProperties}
                              />
                            ),
                          )}
                          {chars
                            .filter((c) => (c.page ?? 2) === pg)
                            .map((c, i) => (
                              <text
                                key={i}
                                className="hch"
                                x={c.x}
                                y={c.y}
                                fontSize={c.size ?? FONT_PX}
                                textAnchor={c.anchor ?? "start"}
                                transform={`rotate(${c.rot} ${c.x} ${c.y})`}
                                style={{ "--d": c.d } as React.CSSProperties}
                              >
                                {c.ch}
                              </text>
                            ))}
                        </svg>
                      ))
                  )}
                </span>
              );
            })}
            {frames.length === 2 ? <i className="gutter" aria-hidden="true"></i> : null}
          </div>
        </div>
        <figcaption className="spec-cap mono">{sel.label} · {sel.mm} mm</figcaption>
      </figure>
    </article>
  );
}

function PeriodBlock({ pd }: { pd: Period }) {
  return (
    <div className={`period period--${pd.id}`}>
      <div className="period-head reveal">
        <span className="period-label mono">{pd.label}</span>
        <span className="period-mono mono">{pd.mono}</span>
        <p className="period-intro">{pd.intro}</p>
      </div>
      {pd.patterns.map((p) => (
        <SpecimenSheet key={p.id} p={p} />
      ))}
    </div>
  );
}

function GroupBlock({ g }: { g: Group }) {
  return (
    <section className={`group ${g.cls}`}>
      <p className="over reveal">{g.over}</p>
      <div className="sec-head reveal">
        <h2>{g.head}</h2>
        <span className="mono">{g.mono}</span>
      </div>
      {g.note ? <p className="sec-note reveal">{g.note}</p> : null}
      {g.archProv ? <p className="arch-prov reveal" dangerouslySetInnerHTML={{ __html: g.archProv }} /> : null}
      {g.periods
        ? g.periods.map((pd) => <PeriodBlock key={pd.id} pd={pd} />)
        : (g.patterns ?? []).map((p) => (
            <SpecimenSheet key={p.id} p={p} />
          ))}
    </section>
  );
}

export default function Gallery() {
  const ref = useRef<HTMLElement>(null);

  // 全页滚动淡入 + 视口观察
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <main id="gallery" className="wrap" ref={ref}>
      <div className="sec-head reveal">
        <h2>版式样张</h2>
        <span className="mono">16 KINDS · 3 SIZES</span>
      </div>
      <p className="sec-note reveal">
        每份样张为三页 PDF：首页空白，后两页为内容页。以下对页取自第 2、3 页，中缝即装订线；
        三种尺寸以同一比例尺显示（A5 对页为满幅基准），页面宽窄即纸面的真实关系。
      </p>
      {GROUPS.map((g) => (
        <GroupBlock key={g.id} g={g} />
      ))}
    </main>
  );
}
