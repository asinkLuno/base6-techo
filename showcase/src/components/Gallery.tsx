import { useEffect, useRef, useState } from "react";
import {
  GROUPS,
  SIZES,
  PAGE_W,
  PAGE_H,
  HANDWRITING_SIMPLIFIED,
  type Pattern,
  type Group,
} from "../data/site";

// ---- 手写布局参数（A5 页面坐标，viewBox 875×1241）----
const SCALE = PAGE_W / 148; // px/mm（A5）
const FONT_PX = 60; // 比 8mm 行距略大 —— 笔画跨行，更有“写字”气场
const ADV = 52; // 每字前进量（px）
const X0 = 108;
// 基线落在第 n 条横线上（ruled: y = 15 + 8n mm）
const lineY = (n: number) => (15 + 8 * n) * SCALE;
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

function layoutHand(lines: string[], lineNs: number[], adv: number, x0: number): HandChar[] {
  const chars: HandChar[] = [];
  let gi = 0;
  for (let li = 0; li < lines.length; li++) {
    const baseY = lineY(lineNs[li] ?? 0);
    for (let ci = 0; ci < lines[li].length; ci++) {
      const x = x0 + adv * ci;
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

function SpecimenSheet({ p }: { p: Pattern }) {
  const [size, setSize] = useState(SIZES[0].id);
  const [chars, setChars] = useState<HandChar[]>([]);
  const sel = SIZES.find((s) => s.id === size)!;

  // 手写版式：运行时经 opencc 转繁体后按横线坐标排布
  useEffect(() => {
    if (!p.handwriting) return;
    let alive = true;
    toTraditional(HANDWRITING_SIMPLIFIED).then((t) => {
      if (!alive) return;
      setChars(layoutHand(t, [2, 3, 4], ADV, X0));
    });
    return () => { alive = false; };
  }, [p]);

  return (
    <article
      className="specimen reveal"
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
          <a
            className="pdf-link mono"
            href={`/examples/${p.id}/${sel.id}/${p.id}-${sel.id}.json`}
            download={`base6-${p.id}.json`}
          >
            导入 JSON ↓
          </a>
        </div>
      </div>

      <figure className="spec-fig" style={{ "--spread": sel.spread + "%" } as React.CSSProperties}>
        <div className="spread">
          <div className="pages">
            {SIZES.map((s) => {
              const w = s.id === "a5" ? 875 : s.id === "a6p" ? 562 : 473;
              const h = s.id === "a5" ? 1241 : s.id === "a6p" ? 1010 : 709;
              return (
                <span key={`${p.id}-${s.id}`} style={{ display: "contents" }}>
                  <img
                    src={`/examples/${p.id}/${s.id}/${p.id}-${s.id}-p-2.png`}
                    width={w} height={h}
                    alt={`${p.name} ${s.label}样张第 2 页`}
                    className="page left"
                    data-size={s.id}
                    hidden={s.id !== size}
                  />
                  <img
                    src={`/examples/${p.id}/${s.id}/${p.id}-${s.id}-p-3.png`}
                    width={w} height={h}
                    alt={`${p.name} ${s.label}样张第 3 页`}
                    className="page right"
                    data-size={s.id}
                    hidden={s.id !== size}
                  />
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
            <i className="gutter" aria-hidden="true"></i>
          </div>
        </div>
        <figcaption className="spec-cap mono">{sel.label} · {sel.mm} mm</figcaption>
      </figure>
    </article>
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
      {g.patterns.map((p) => (
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
        <span className="mono">9 KINDS · 3 SIZES</span>
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
