import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  memo,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  activeTocIndex,
  hasNextSpread,
  type PdfViewMode,
  pagedStep,
  resolveOutline,
  spreadPages,
  type TocEntry,
} from "../lib/pdfView";
import { MAX_ZOOM, MIN_ZOOM, nextZoom, zoomLabel } from "../lib/pdfZoom";
import { useSettingsStore } from "../stores/settings";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/** 预览占位用的宽高比回落值（A5 ≈ √2），加载后取第 1 页真实比例覆盖。 */
const A5_ASPECT = Math.SQRT2;
/** 滚动容器 p-4 的左右内边距合计，测量 clientWidth 后要扣掉。 */
const SCROLL_PADDING = 32;
/** 双页对开时两页之间的间距，与页面容器 gap-4 一致。 */
const SPREAD_GAP = 16;

/** 视图模式切换按钮的三档配置。 */
const VIEW_MODES: readonly {
  value: PdfViewMode;
  labelKey: "editor.viewContinuous" | "editor.viewSingle" | "editor.viewDouble";
}[] = [
  { value: "continuous", labelKey: "editor.viewContinuous" },
  { value: "single", labelKey: "editor.viewSingle" },
  { value: "double", labelKey: "editor.viewDouble" },
];

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

/** 翻页箭头（单/双页模式的上一页/下一页按钮用）。 */
function ChevronIcon({ direction }: { direction: "left" | "right" }) {
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
      {direction === "left" ? (
        <path d="m15 18-6-6 6-6" />
      ) : (
        <path d="m9 18 6-6-6-6" />
      )}
    </svg>
  );
}

/** 目录侧栏开关图标：内联线性 SVG，与 ZoomIcon 同一笔风；按钮已带 aria-label，图标装饰性。 */
function TocIcon() {
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
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

/** 单页占位：页码/宽高/ref 回调都稳定时跳过重渲，滚动更新 activePage 不波及页面栈。 */
const PageFrame = memo(function PageFrame({
  pageNumber,
  width,
  height,
  canvasRef,
}: {
  pageNumber: number;
  width: number;
  height: number;
  canvasRef: (el: HTMLCanvasElement | null) => void;
}) {
  return (
    <div
      data-page={pageNumber}
      className="bg-base-100 relative shadow-md"
      style={{ width, height }}
    >
      <span className="badge badge-sm absolute top-2 left-2 opacity-80">
        {pageNumber}
      </span>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
});

/**
 * 页面栈：连续滚动时是全书占位，分页模式是当前对开。
 * 页码数组按页序 memo，滚动引起的父级重渲（页码指示器变化）整体跳过。
 */
const PageStack = memo(function PageStack({
  pageNumbers,
  width,
  height,
  canvasRefFor,
}: {
  pageNumbers: number[];
  width: number;
  height: number;
  canvasRefFor: (pageNumber: number) => (el: HTMLCanvasElement | null) => void;
}) {
  return (
    <>
      {pageNumbers.map((pageNumber) => (
        <PageFrame
          key={pageNumber}
          pageNumber={pageNumber}
          width={width}
          height={height}
          canvasRef={canvasRefFor(pageNumber)}
        />
      ))}
    </>
  );
});

/** 单条目录：仅高亮状态变化时重渲，长目录随滚动翻页不会整列重建。 */
const TocItem = memo(function TocItem({
  entry,
  active,
  onSelect,
}: {
  entry: TocEntry;
  active: boolean;
  onSelect: (page: number) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={active ? "menu-active" : undefined}
        style={{
          paddingInlineStart: `${0.75 + entry.depth * 0.9}rem`,
        }}
        disabled={entry.page === null}
        onClick={() => entry.page !== null && onSelect(entry.page)}
      >
        {entry.title}
      </button>
    </li>
  );
});

/** 目录侧栏列表：列表本身不变时跳过重渲，高亮切换只触及相邻两条。 */
const TocList = memo(function TocList({
  entries,
  activeIndex,
  onSelect,
}: {
  entries: TocEntry[];
  activeIndex: number;
  onSelect: (page: number) => void;
}) {
  return (
    <ul className="menu menu-sm">
      {entries.map((entry, index) => (
        <TocItem
          key={entry.id}
          entry={entry}
          active={index === activeIndex}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
});

/**
 * 把第 index 页（0 起）渲染到 canvas：按 cssWidth × dpr 设定像素尺寸。
 * stillWanted 在 getPage 之后复查一次，避免离屏/换页后的白渲染；
 * 返回的 RenderTask 由调用方持有以便取消。
 */
async function startPageRender(
  doc: pdfjsLib.PDFDocumentProxy,
  index: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
  stillWanted: () => boolean,
): Promise<pdfjsLib.RenderTask | null> {
  const page = await doc.getPage(index + 1);
  if (!stillWanted()) return null;
  const dpr = window.devicePixelRatio || 1;
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({
    scale: (cssWidth / base.width) * dpr,
  });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  return page.render({ canvas, canvasContext: ctx, viewport });
}

/**
 * PDF 预览（Android WebView 不能直接显示 PDF，pdf.js 是标准方案）。
 * 按 pdf.js viewer 通行做法：宽高比占位防滚动条跳动，IntersectionObserver
 * ±1 屏惰性渲染、离屏取消任务并清空位图控内存；ResizeObserver 让窗口变化
 * 后重排重渲；工具栏（daisyUI join）做缩放，右侧页码随滚动自动更新。
 * 视图模式三档：连续滚动 / 单页翻页 / 双页对开（封面独占 + 偶左奇右），
 * 偏好持久化在 settings store；分页模式下用左右方向键或按钮翻页，
 * 另有 PDF 书签（outline）目录侧栏可跳转。
 */
/** memo：父组件（编译日志推流、section 编辑）重渲时，pdfBytes 不变就跳过整个预览树。 */
export const PdfViewer = memo(function PdfViewer({
  pdfBytes,
}: {
  pdfBytes: ArrayBuffer | null;
}) {
  const { t } = useTranslation();
  const mode = useSettingsStore((s) => s.pdfViewMode);
  const setMode = useSettingsStore((s) => s.setPdfViewMode);
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [activePage, setActivePage] = useState(1);
  const [aspect, setAspect] = useState(A5_ASPECT);
  const [containerWidth, setContainerWidth] = useState(0);
  // 目录：文档大纲拍平后的条目（无书签时为空数组，工具栏按钮随之隐藏）
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  // 按页码缓存的 canvas 挂载回调：稳定引用避免每次渲染 React 解绑/重绑 ref
  const canvasRefCache = useRef<((el: HTMLCanvasElement | null) => void)[]>([]);
  // 变焦前滚动位置，布局提交后按比例恢复（详见 useLayoutEffect）
  const prevScroll = useRef<{ span: number; top: number } | null>(null);
  // 待跳转页码：布局提交后消费——分页模式回到页首，连续滚动定位到该页
  const pendingScroll = useRef<number | null>(null);

  const canvasRefFor = useCallback((pageNumber: number) => {
    const cache = canvasRefCache.current;
    const existing = cache[pageNumber];
    if (existing) return existing;
    const setter = (el: HTMLCanvasElement | null) => {
      canvasRefs.current[pageNumber - 1] = el;
    };
    cache[pageNumber] = setter;
    return setter;
  }, []);

  // pageCount 是 doc 的派生值：单独存 state 会在重新生成同页数文档时漏触发重渲染
  const pageCount = doc?.numPages ?? 0;
  const paged = mode !== "continuous";
  // 分页模式下当前屏要显示的页序（单页 1 页 / 双页对开 1-2 页）；
  // 连续滚动为 null（全量列表交给观察器）。useMemo 稳定引用供 effect 依赖。
  const spread = useMemo(() => {
    if (!doc || mode === "continuous") return null;
    if (mode === "single") return [activePage];
    return spreadPages(activePage, pageCount);
  }, [doc, mode, activePage, pageCount]);
  // 双页时每个页面只有一半可用宽度（再扣掉页间距）；floor 保证对开总宽不溢出
  const pageWidth =
    containerWidth > 0
      ? Math.max(
          48,
          Math.floor(
            ((containerWidth -
              SCROLL_PADDING -
              (mode === "double" ? SPREAD_GAP : 0)) /
              (mode === "double" ? 2 : 1)) *
              zoom,
          ),
        )
      : 0;
  // 连续滚动为全书页序，分页模式为当前对开；稳定引用让 PageStack 在滚动时跳过重渲
  const pageNumbers = useMemo(
    () => spread ?? Array.from({ length: pageCount }, (_, i) => i + 1),
    [spread, pageCount],
  );
  const pageHeight = Math.round(pageWidth * aspect);
  const tocActive = useMemo(
    () => activeTocIndex(toc, activePage),
    [toc, activePage],
  );

  // 加载文档：pdfBytes 变化即作废旧任务（cleanup 里 destroy），成功后取第 1 页
  // 宽高比（全书同一纸张尺寸）并回到顶部；书签目录随后异步解析
  useEffect(() => {
    setDoc(null);
    setError("");
    setToc([]);
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
        // 书签是可选元数据：解析失败按无目录处理，不影响预览本身
        try {
          const entries = await resolveOutline(next);
          if (!cancelled) setToc(entries);
        } catch {}
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

  // 跳转页码的滚动落地：分页模式等新页序挂载后回页首，连续滚动定位到目标页元素
  // （pendingScroll 只在换页/切模式时置值，随滚动更新的 activePage 不会触发本 effect）
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !doc || pendingScroll.current === null) return;
    const target = pendingScroll.current;
    pendingScroll.current = null;
    if (spread) {
      el.scrollTop = 0;
    } else {
      el.querySelector(`[data-page="${target}"]`)?.scrollIntoView({
        block: "start",
      });
    }
  }, [doc, spread]);

  // 惰性渲染：±1 屏缓冲进屏渲染，离屏取消任务并清空位图；另用中线观察器更新页码
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (mode !== "continuous" || !doc || !scrollEl || pageWidth <= 0) return;
    let alive = true;
    const tasks = new Map<number, pdfjsLib.RenderTask>();
    const rendered = new Set<number>();
    // startPageRender 是异步的：用同步 Set 占位，防止同一页在 await 期间被观察器重复触发
    const inFlight = new Set<number>();

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
      if (
        !alive ||
        rendered.has(index) ||
        tasks.has(index) ||
        inFlight.has(index)
      )
        return;
      const canvas = canvasRefs.current[index];
      if (!canvas) return;
      inFlight.add(index);
      (async () => {
        try {
          const task = await startPageRender(
            doc,
            index,
            canvas,
            pageWidth,
            () => alive && !rendered.has(index),
          );
          if (!task) return;
          tasks.set(index, task);
          await task.promise;
          tasks.delete(index);
          rendered.add(index);
        } catch {
          // 离屏取消不算错误：预览失败只源于文档加载（error state）
        } finally {
          inFlight.delete(index);
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
  }, [doc, pageWidth, mode]);

  // 分页模式（单页/双页）：只渲染当前屏的 1-2 页，换页/变宽由依赖触发重渲
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!spread || !doc || !scrollEl || pageWidth <= 0) return;
    let alive = true;
    const tasks: pdfjsLib.RenderTask[] = [];
    for (const page of spread) {
      const canvas = canvasRefs.current[page - 1];
      if (!canvas) continue;
      (async () => {
        try {
          const task = await startPageRender(
            doc,
            page - 1,
            canvas,
            pageWidth,
            () => alive,
          );
          if (!task) return;
          tasks.push(task);
          await task.promise;
        } catch {
          // 换页取消不算错误：预览失败只源于文档加载（error state）
        }
      })();
    }
    return () => {
      alive = false;
      tasks.forEach((task) => {
        task.cancel();
      });
    };
    // spread 经 useMemo 稳定引用，换页/切模式产生新数组即触发重渲
  }, [doc, pageWidth, spread]);

  const applyZoom = (next: number) => {
    if (next === zoom || !doc) return;
    const el = scrollRef.current;
    if (el) {
      const span = el.scrollHeight - el.clientHeight;
      if (span > 0) prevScroll.current = { span, top: el.scrollTop };
    }
    setZoom(next);
  };

  /** 跳到指定页：分页模式先记下待跳页码等布局落地，连续滚动直接定位。 */
  const goToPage = (page: number) => {
    if (!doc) return;
    const target = Math.min(Math.max(1, page), pageCount);
    if (target === activePage) return;
    if (paged) {
      pendingScroll.current = target;
      setActivePage(target);
    } else {
      scrollRef.current
        ?.querySelector(`[data-page="${target}"]`)
        ?.scrollIntoView({ block: "start" });
    }
  };

  // 目录点击走稳定回调：滚动更新 activePage 时 TocList 只重算高亮条目，不重建整列按钮
  const goToPageRef = useRef(goToPage);
  useEffect(() => {
    goToPageRef.current = goToPage;
  });
  const selectTocPage = useCallback(
    (page: number) => goToPageRef.current(page),
    [],
  );

  /** 分页模式的上一页/下一页（双页按对开组合步进）。 */
  const step = (dir: 1 | -1) => {
    if (!doc) return;
    goToPage(
      pagedStep(
        mode === "single" ? "single" : "double",
        activePage,
        pageCount,
        dir,
      ),
    );
  };

  /** 切换视图模式：记住当前页，布局落地后连续滚动跳页 / 分页模式回页首。 */
  const changeMode = (next: PdfViewMode) => {
    if (next === mode || !doc) return;
    pendingScroll.current = activePage;
    setMode(next);
  };

  // 分页模式下左右方向键翻页；上下键与 PageUp/Down 保留原生滚动（放大后页内滚动）
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!paged || !doc) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  };

  if (error) {
    return (
      <div role="alert" className="alert alert-error">
        <span>{t("editor.pdfErrorDetail", { message: error })}</span>
      </div>
    );
  }
  if (!pdfBytes) return null;

  const showToc = tocOpen && toc.length > 0;

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {toc.length > 0 && (
            <button
              type="button"
              className={`btn btn-sm ${tocOpen ? "btn-primary" : "btn-ghost"}`}
              aria-label={t("editor.toc")}
              aria-pressed={tocOpen}
              title={t("editor.toc")}
              onClick={() => setTocOpen((open) => !open)}
            >
              <TocIcon />
            </button>
          )}
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
        </div>
        <div className="flex items-center gap-2">
          <div className="join">
            {VIEW_MODES.map(({ value, labelKey }) => (
              <button
                key={value}
                type="button"
                className={`btn btn-sm join-item ${
                  mode === value ? "btn-primary" : "btn-ghost"
                }`}
                aria-pressed={mode === value}
                disabled={!doc}
                onClick={() => changeMode(value)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
          {paged && (
            <div className="join">
              <button
                type="button"
                className="btn btn-ghost btn-sm join-item"
                disabled={!doc || activePage <= 1}
                aria-label={t("editor.prevPage")}
                onClick={() => step(-1)}
              >
                <ChevronIcon direction="left" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm join-item"
                disabled={
                  !doc ||
                  (mode === "single"
                    ? activePage >= pageCount
                    : !hasNextSpread(activePage, pageCount))
                }
                aria-label={t("editor.nextPage")}
                onClick={() => step(1)}
              >
                <ChevronIcon direction="right" />
              </button>
            </div>
          )}
          <span className="text-sm opacity-70">
            {doc ? `${activePage} / ${pageCount}` : "…"}
          </span>
        </div>
      </div>

      {/* 窄屏目录改到画面上方，避免侧栏把预览页挤窄；sm 起恢复左侧竖排 */}
      <div className="flex flex-col items-stretch gap-3 sm:flex-row">
        {showToc && (
          <nav
            aria-label={t("editor.toc")}
            className="bg-base-200 rounded-box h-40 w-full shrink-0 overflow-auto sm:h-[70vh] sm:min-h-96 sm:w-52"
          >
            <TocList
              entries={toc}
              activeIndex={tocActive}
              onSelect={selectTocPage}
            />
          </nav>
        )}
        {/* tabIndex 让滚动区域可聚焦：键盘用户才能滚动，分页模式下方向键翻页
            依赖它（WCAG 滚动区域键盘可达；noNoninteractiveTabindex 在 biome.json
            对本文件豁免正是为此） */}
        <section
          ref={scrollRef}
          tabIndex={0}
          aria-label={t("editor.preview")}
          onKeyDown={onKeyDown}
          className="bg-base-300 focus-visible:outline-primary h-[70vh] min-h-96 flex-1 overflow-auto p-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
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
              className={
                mode === "double"
                  ? "mx-auto flex items-start justify-center gap-4"
                  : "mx-auto flex flex-col items-center gap-4"
              }
              style={{
                width:
                  mode === "double" ? pageWidth * 2 + SPREAD_GAP : pageWidth,
              }}
            >
              <PageStack
                pageNumbers={pageNumbers}
                width={pageWidth}
                height={pageHeight}
                canvasRefFor={canvasRefFor}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
});
