import { useEffect, useRef, useState } from "react";
// page-flip 是 CommonJS（运行时仅 default 导出），SSR 需走 default 导入避免 named-export 报错
import PageFlipPkg from "page-flip";
import type { PageFlip as PageFlipType, SizeType } from "page-flip";

const { PageFlip } = PageFlipPkg as unknown as { PageFlip: typeof PageFlipType };

const BASE_W = 640;
const BASE_H = 905;

interface Props {
  /** 图片前缀，如 "/examples/weekly/weekly-2026" */
  base: string;
  /** 页数（全书页数） */
  pages: number;
  /** 第一张 PNG 的页号（-p-00N.png） */
  startPad: number;
}

export default function BookFlip({ base, pages, startPad }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<PageFlipType | null>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!hostRef.current) return;
    const book = new PageFlip(hostRef.current, {
      width: BASE_W,
      height: BASE_H,
      size: "stretch" as SizeType,
      maxShadowOpacity: 0.4,
      showCover: true,
      flippingTime: 600,
      drawShadow: true,
      mobileScrollSupport: true,
      usePortrait: false,
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

  return (
    <div className="bookflip">
      <div ref={hostRef} className="bf-host">
        {Array.from({ length: pages }, (_, i) => (
          <div
            key={i}
            className="bf-page"
            data-density={i === 0 || i === pages - 1 ? "hard" : "soft"}
          >
            <img
              src={`${base}-p-${String(startPad + i).padStart(3, "0")}.png`}
              alt={`样张第 ${i + 1} 页`}
              width={BASE_W}
              height={BASE_H}
              draggable={false}
            />
          </div>
        ))}
      </div>
      <div className="bf-controls">
        <button type="button" onClick={() => bookRef.current?.flipPrev()}>
          ‹ 上页
        </button>
        <span className="bf-count mono">{current} / {pages}</span>
        <button type="button" onClick={() => bookRef.current?.flipNext()}>
          下页 ›
        </button>
      </div>
    </div>
  );
}
