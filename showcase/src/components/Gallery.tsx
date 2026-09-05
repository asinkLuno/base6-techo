import { useEffect, useRef, useState } from "react";
import {
  GROUPS,
  SIZES,
  PAGE_W,
  PAGE_H,
  HANDWRITING_SIMPLIFIED,
  type Pattern,
  type Group,
  type Period,
} from "../data/site";

// ---- 手写布局参数（A5 页面坐标，viewBox 875×1241）----
// 手写布局基准（A5 页面坐标，viewBox 875×1241；A6P/A7 相对它等比缩放）
// 手写布局（仅 A5 样张覆盖；A6P/A7 不叠加手写）
const SCALE = PAGE_W / 148; // px/mm（A5）
const FONT_PX = 60; // 比 8mm 行距略大 —— 笔画跨行，更有“写字”气场
const ADV = 52; // 每字前进量（px）
const X0 = 108; // 首字 x（px）
const LINE0 = 15; // A5 横线第 0 条的毫米 y（由 margins()+centered() 推导）
const START_LINE = 3; // 诗首行落在内容区第 3 条横线（逐行书写，不空行）
const ROT = [-2.4, 2.6, 1.9, -2.0, -2.8, 3.0, 1.6, -2.2, 2.4, -2.6, 2.0, -2.2];
const DY = [0.7, -0.5, 0.5, -0.6, 1.0, -0.7, 0.4, -0.4, 0.8, -0.6, 0.3, -0.5];

interface HandChar {
  ch: string;
  x: number;
  y: number;
  rot: number;
  d: string;
}

// 简体 → 繁体（辰宇落雁为繁体字型；缺失的简体由 opencc 转换）
async function toTraditional(lines: string[]): Promise<string[]> {
  const { Converter } = await import("../../vendor/opencc-cn2t.js");
  const conv = Converter({ from: "cn", to: "tw" });
  return lines.map((l) => conv(l));
}

// 按 A5 横线坐标逐行排布
function layoutHand(lines: string[]): HandChar[] {
  const chars: HandChar[] = [];
  let gi = 0;
  for (let li = 0; li < lines.length; li++) {
    const baseY = (LINE0 + (START_LINE + li) * 8) * SCALE;
    for (let ci = 0; ci < lines[li].length; ci++) {
      const x = X0 + ADV * ci;
      const y = baseY + (DY[ci % DY.length] ?? 0);
      chars.push({
        ch: lines[li][ci],
        x: Math.round(x),
        y: Math.round(y * 10) / 10,
        rot: ROT[ci % ROT.length] ?? 0,
        d: (gi * 0.22 + 0.05).toFixed(2) + "s",
      });
      gi++;
    }
  }
  return chars;
}

// 古文竖排：每联（去标点）成一竖列，自右向左。
// 栏列按 Rust 版芯几何居中计算：栏块 [sx, sx+nx*SP] 居中于内框，故内部栏均距 SP、两侧留到框的余量。
function layoutVertical(lines: string[]): HandChar[] {
  // A5 右页(p-2) 版芯：非装订=18、页头=15、绑定=13、页脚=19；栏距 10、框隙 1.2
  const CX = 18, CY = 15, CW = 148 - 13 - 18;
  const SP = 10, GAP = 1.2;
  const ix = CX + GAP, iw = CW - 2 * GAP; // 内框
  const iy = CY + GAP;
  const nx = Math.floor(iw / SP); // 栏数
  const sx = ix + (iw - nx * SP) / 2; // 栏块左缘（居中）
  const ADV_V = 14; // 竖向字距 mm
  const couplets = lines.map((l) => l.replace(/[，。、]/g, ""));
  const chars: HandChar[] = [];
  let gi = 0;
  for (let c = 0; c < couplets.length; c++) {
    const col = nx - 1 - c; // 自右向左
    const x = (sx + col * SP + SP / 2) * SCALE;
    const text = couplets[c];
    const top = iy + ADV_V; // 从内框上缘起第二条“线”开始写（空出首行）
    for (let j = 0; j < text.length; j++) {
      const y = (top + j * ADV_V) * SCALE;
      chars.push({
        ch: text[j],
        x: Math.round(x),
        y: Math.round(y * 10) / 10,
        rot: 0,
        d: (gi * 0.22 + 0.05).toFixed(2) + "s",
      });
      gi++;
    }
  }
  return chars;
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
  const sel = SIZES.find((s) => s.id === size)!;
  const frames = pngFiles(p, sel.id, variant);

  // 手写版式：运行时经 opencc 转繁体后按 A5 横线坐标排布
  useEffect(() => {
    if (!p.handwriting) return;
    let alive = true;
    toTraditional(HANDWRITING_SIMPLIFIED).then((t) => {
      if (!alive) return;
      setChars(p.id === "vertical" ? layoutVertical(t) : layoutHand(t));
    });
    return () => { alive = false; };
  }, [p]);

  return (
    <article
      className={`specimen reveal${chars.length ? " hs" : ""}`}
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
                    <svg
                      className="page-hand"
                      data-size="a5"
                      viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
                      aria-hidden="true"
                      hidden={s.id !== size}
                    >
                      {chars.map((c, i) => (
                        <text
                          key={i}
                          className="hch"
                          x={c.x}
                          y={c.y}
                          fontSize={FONT_PX}
                          transform={`rotate(${c.rot} ${c.x} ${c.y})`}
                          style={{ "--d": c.d } as React.CSSProperties}
                        >
                          {c.ch}
                        </text>
                      ))}
                    </svg>
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
