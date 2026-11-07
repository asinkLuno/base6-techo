import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MAX_ZOOM, MIN_ZOOM, nextZoom, zoomLabel } from "../lib/pdfZoom";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/** 预览占位用的宽高比回落值（A5 ≈ √2），加载后取第 1 页真实比例覆盖。 */
const A5_ASPECT = Math.SQRT2;
/** 滚动容器 p-4 的左右内边距合计，测量 clientWidth 后要扣掉。 */
const SCROLL_PADDING = 32;

/** 放大镜加减号：内联线性 SVG，与全站图标同一笔风（stroke 2 / currentColor）；按钮已带 aria-label，图标装饰性。 */
function ZoomIcon({ direction }: { direction: "in" | "out" }) {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
      {direction === "in" ? <path d="M8 11h6M11 8v6" /> : <path d="M8 11h6" />}
    </svg>
  );
}

/**
 * 连续滚动 PDF 预览（Android WebView 不能直接显示 PDF，pdf.js 是标准方案）。
 * 按 pdf.js viewer 通行做法：宽高比占位防滚动条跳动，IntersectionObserver
 * ±1 屏惰性渲染、离屏取消任务并清空位图控内存；ResizeObserver 让窗口变化
 * 后重排重渲；工具栏（daisyUI join）做缩放，右侧页码随滚动自动更新。
 */
export function PdfViewer({ pdfBytes }: { pdfBytes: ArrayBuffer | null }) {
  const { t } = useTranslation();
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [activePage, setActivePage] = useState(1);
  const [aspect, setAspect] = useState(A5_ASPECT);
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  // 变焦前滚动位置，布局提交后按比例恢复（详见 useLayoutEffect）
  const prevScroll = useRef<{ span: number; top: number } | null>(null);

  // pageCount 是 doc 的派生值：单独存 state 会在重新生成同页数文档时漏触发重渲染
  const pageCount = doc?.numPages ?? 0;
  const pageWidth =
    containerWidth > 0
      ? Math.max(48, Math.round((containerWidth - SCROLL_PADDING) * zoom))
      : 0;

  // 加载文档：pdfBytes 变化即作废旧任务（cleanup 里 destroy），成功后取第 1 页
  // 宽高比（全书同一纸张尺寸）并回到顶部
  useEffect(() => {
    setDoc(null);
    setError("");
    if (!pdfBytes) return;
    let cancelled = false;
    let task: pdfjsLib.PDFDocumentLoadingTask | null = null;
    (async () => {
      try {
        task = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
        const next = await task.promise;
        if (cancelled) {
          task.destroy().catch(() => {});
          return;
        }
        const page1 = await next.getPage(1);
        if (cancelled) {
          task.destroy().catch(() => {});
          return;
        }
        const base = page1.getViewport({ scale: 1 });
        setAspect(base.height / base.width);
        setActivePage(1);
        setDoc(next);
        scrollRef.current?.scrollTo({ top: 0 });
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
      task?.destroy().catch(() => {});
    };
  }, [pdfBytes]);

  // 容器宽度：ResizeObserver + 120ms 防抖，拖窗口时不至于每帧重渲。
  // 容器只在有 pdfBytes 时挂载，故依赖列表含 pdfBytes
  useEffect(() => {
    if (!pdfBytes) return;
    const el = scrollRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => setContainerWidth(el.clientWidth), 120);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [pdfBytes]);

  // 变焦/容器变化后按比例恢复滚动位置，当前内容不跳走
  useLayoutEffect(() => {
    if (pageWidth <= 0) return;
    const el = scrollRef.current;
    const prev = prevScroll.current;
    if (!el || !prev) return;
    prevScroll.current = null;
    const span = el.scrollHeight - el.clientHeight;
    if (prev.span > 0 && span > 0) {
      el.scrollTop = Math.round((prev.top / prev.span) * span);
    }
  }, [pageWidth]);

  // 惰性渲染：±1 屏缓冲进屏渲染，离屏取消任务并清空位图；另用中线观察器更新页码
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!doc || !scrollEl || pageWidth <= 0) return;
    let alive = true;
    const tasks = new Map<number, pdfjsLib.RenderTask>();
    const rendered = new Set<number>();

    const unrender = (index: number) => {
      tasks.get(index)?.cancel();
      tasks.delete(index);
      if (!rendered.has(index)) return;
      rendered.delete(index);
      const canvas = canvasRefs.current[index];
      if (canvas) {
        // 置零释放位图内存；占位 div 撑住布局，canvas CSS 铺满占位
        canvas.width = 0;
        canvas.height = 0;
      }
    };

    const render = (index: number) => {
      if (!alive || rendered.has(index) || tasks.has(index)) return;
      const canvas = canvasRefs.current[index];
      if (!canvas) return;
      (async () => {
        try {
          const page = await doc.getPage(index + 1);
          if (!alive || rendered.has(index)) return;
          const dpr = window.devicePixelRatio || 1;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({
            scale: (pageWidth / base.width) * dpr,
          });
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          const task = page.render({ canvas, canvasContext: ctx, viewport });
          tasks.set(index, task);
          await task.promise;
          tasks.delete(index);
          rendered.add(index);
        } catch {
          // 离屏取消不算错误：预览失败只源于文档加载（error state）
        }
      })();
    };

    const pages = Array.from(
      scrollEl.querySelectorAll<HTMLElement>("[data-page]"),
    );
    const indexOf = (el: Element) => Number(el.getAttribute("data-page")) - 1;

    const renderIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) render(indexOf(entry.target));
          else unrender(indexOf(entry.target));
        }
      },
      { root: scrollEl, rootMargin: "100% 0px" },
    );
    // 视口中线扫过的页即为「当前页」，指示器随滚动变化
    const centerIo = new IntersectionObserver(
      (entries) => {
        let best: { index: number; ratio: number } | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = indexOf(entry.target);
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { index, ratio: entry.intersectionRatio };
          }
        }
        if (best) setActivePage(best.index + 1);
      },
      { root: scrollEl, rootMargin: "-50% 0px -50% 0px" },
    );
    pages.forEach((el) => {
      renderIo.observe(el);
      centerIo.observe(el);
    });

    return () => {
      alive = false;
      renderIo.disconnect();
      centerIo.disconnect();
      tasks.forEach((task) => {
        task.cancel();
      });
    };
  }, [doc, pageWidth]);

  const applyZoom = (next: number) => {
    if (next === zoom || !doc) return;
    const el = scrollRef.current;
    if (el) {
      const span = el.scrollHeight - el.clientHeight;
      if (span > 0) prevScroll.current = { span, top: el.scrollTop };
    }
    setZoom(next);
  };

  if (error) {
    return (
      <div role="alert" className="alert alert-error">
        <span>
          {t("editor.pdfError")}：{error}
        </span>
      </div>
    );
  }
  if (!pdfBytes) return null;

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="join">
          <button
            type="button"
            className="btn btn-ghost btn-sm join-item"
            disabled={!doc || zoom <= MIN_ZOOM}
            aria-label={t("editor.zoomOut")}
            onClick={() => applyZoom(nextZoom(zoom, "out"))}
          >
            <ZoomIcon direction="out" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm join-item min-w-14"
            disabled={!doc}
            aria-label={t("editor.zoomFit")}
            onClick={() => applyZoom(1)}
          >
            {zoomLabel(zoom)}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm join-item"
            disabled={!doc || zoom >= MAX_ZOOM}
            aria-label={t("editor.zoomIn")}
            onClick={() => applyZoom(nextZoom(zoom, "in"))}
          >
            <ZoomIcon direction="in" />
          </button>
        </div>
        <span className="text-sm opacity-70">
          {doc ? `${activePage} / ${pageCount}` : "…"}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="bg-base-300 h-[70vh] min-h-96 overflow-auto p-4"
      >
        {!doc && (
          <div
            className="mx-auto flex flex-col items-center gap-4"
            style={{ width: Math.max(48, containerWidth - SCROLL_PADDING) }}
          >
            <div
              className="skeleton w-full"
              style={{ aspectRatio: "1 / 1.414" }}
            />
            <div
              className="skeleton w-full"
              style={{ aspectRatio: "1 / 1.414" }}
            />
          </div>
        )}
        {doc && (
          <div
            className="mx-auto flex flex-col items-center gap-4"
            style={{ width: pageWidth }}
          >
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                data-page={n}
                className="bg-base-100 relative shadow-md"
                style={{ height: Math.round(pageWidth * aspect) }}
              >
                <span className="badge badge-sm absolute top-2 left-2 opacity-80">
                  {n}
                </span>
                <canvas
                  ref={(el) => {
                    canvasRefs.current[n - 1] = el;
                  }}
                  className="block h-full w-full"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
