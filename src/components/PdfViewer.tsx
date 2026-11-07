import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/** 翻页箭头：内联线性 SVG，与全站图标同一笔风（stroke 2 / currentColor）；按钮已带 aria-label，图标装饰性。 */
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

/** Canvas 版 PDF 预览（Android WebView 不能直接显示 PDF，pdf.js 是标准方案）。 */
export function PdfViewer({ pdfBytes }: { pdfBytes: ArrayBuffer | null }) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [error, setError] = useState("");

  // pageCount 是 doc 的派生值：单独存 state 会在重新生成同页数文档时漏触发重渲染
  const pageCount = doc?.numPages ?? 0;

  // 加载文档：pdfBytes 变化即作废旧任务（cleanup 里 destroy），成功后重置到第 1 页
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
        setDoc(next);
        setPageNum(1);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
      task?.destroy().catch(() => {});
    };
  }, [pdfBytes]);

  // 渲染当前页：cleanup 里取消在途渲染任务，快速翻页不叠任务、不互相覆盖
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!doc || !canvas || pageNum < 1 || pageNum > pageCount) return;
    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;
    (async () => {
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;
        // render at device resolution, display at CSS width (fit width)
        const cssWidth = canvas.clientWidth || 600;
        const dpr = window.devicePixelRatio || 1;
        const base = page.getViewport({ scale: 1 });
        const scale = cssWidth / base.width;
        const viewport = page.getViewport({ scale: scale * dpr });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${Math.floor(base.height * scale)}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        renderTask = page.render({ canvas, canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch (e) {
        // 渲染被取消（快速翻页）不算错误：cleanup 先置位 cancelled 再 cancel()
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, pageNum, pageCount]);

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
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-circle btn-ghost btn-sm"
          disabled={pageNum <= 1}
          aria-label={t("editor.prevPage")}
          onClick={() => setPageNum((n) => n - 1)}
        >
          <ChevronIcon direction="left" />
        </button>
        <span className="text-sm opacity-70">
          {pageCount ? `${pageNum} / ${pageCount}` : "…"}
        </span>
        <button
          type="button"
          className="btn btn-circle btn-ghost btn-sm"
          disabled={pageNum >= pageCount}
          aria-label={t("editor.nextPage")}
          onClick={() => setPageNum((n) => n + 1)}
        >
          <ChevronIcon direction="right" />
        </button>
      </div>
      <canvas ref={canvasRef} />
    </div>
  );
}
