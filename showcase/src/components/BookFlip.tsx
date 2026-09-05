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
      // 样张是全平的纸面：翻页时不往静止页上叠任何阴影
      drawShadow: false,
      flippingTime: 600,
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
