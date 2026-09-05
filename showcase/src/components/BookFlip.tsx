import { useEffect, useRef, useState } from "react";
// page-flip 2.x 的 ESM/UMD 构建都只有 named 导出（PageFlip），没有 default：
// 必须按 namespace 导入再取 named——浏览器（Vite 预打包 ESM）与 SSR（Node 把
// CJS 的 module.exports 放进 default）两种互操作下都能拿到构造器；
// 写成 `import PageFlip from "page-flip"` 会在客户端模块链接时失败、island 水合崩溃。
import * as PageFlipNS from "page-flip";
import type { PageFlip as PageFlipType, SizeType } from "page-flip";

const PageFlip =
  (PageFlipNS as unknown as { default?: { PageFlip?: typeof PageFlipType } }).default?.PageFlip ??
  PageFlipNS.PageFlip;

const BASE_W = 640;
const BASE_H = 905;

interface Props {
  /** 图片前缀，如 "/examples/weekly/weekly-2026" */
  base: string;
  /** 页数（全书内容页数） */
  pages: number;
  /** 第一张 PNG 的页号（-p-00N.png） */
  startPad: number;
}

export default function BookFlip({ base, pages, startPad }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<PageFlipType | null>(null);
  // flip 事件的页码 = 当前对页左页的序号（0 起算）
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!hostRef.current) return;
    const book = new PageFlip(hostRef.current, {
      width: BASE_W,
      height: BASE_H,
      size: "stretch" as SizeType,
      // 首页不再单独当封面展示；对页从第一组 [衬页|第1页] 开始
      showCover: false,
      usePortrait: false,
      // 翻页时叠上书页阴影（装订侧渐变 + 纸面投影），配 maxShadowOpacity 压淡
      drawShadow: true,
      maxShadowOpacity: 0.6,
      flippingTime: 650,
      mobileScrollSupport: true,
    });
    book.loadFromHTML(
      Array.from(hostRef.current.querySelectorAll<HTMLElement>(".bf-page")),
    );
    book.on("flip", (e) => setCurrent((e.data as number) ?? 0));
    bookRef.current = book;
    return () => {
      book.destroy();
      bookRef.current = null;
    };
  }, []);

  // 首尾各补一页空白衬页（环衬）：首页与末页都落到对页上，装订边（base6 水印侧）才在书脊
  const total = pages + 2;
  const count =
    current <= 0
      ? `1 / ${pages}`
      : current >= pages
        ? `${pages} / ${pages}`
        : `${current}–${current + 1} / ${pages}`;

  return (
    <div className="bookflip">
      <div ref={hostRef} className="bf-host">
        {Array.from({ length: total }, (_, i) => {
          const page = i - 1; // 内容页序号；0 与 total-1 为空白衬页
          return (
            <div key={i} className="bf-page">
              {page >= 0 && page < pages ? (
                <img
                  src={`${base}-p-${String(startPad + page).padStart(3, "0")}.png`}
                  alt={`样张第 ${page + 1} 页`}
                  width={BASE_W}
                  height={BASE_H}
                  draggable={false}
                />
              ) : null}
            </div>
          );
        })}
        {/* 静态中缝阴影：与下方样张的 .gutter 同一渐变，盖在书脊上（不拦截点击/拖拽） */}
        <i className="bf-gutter" aria-hidden="true" />
      </div>
      <div className="bf-controls">
        <button type="button" onClick={() => bookRef.current?.flipPrev()}>
          ‹ 上页
        </button>
        <span className="bf-count mono">{count}</span>
        <button type="button" onClick={() => bookRef.current?.flipNext()}>
          下页 ›
        </button>
      </div>
    </div>
  );
}
