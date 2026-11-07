import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useTranslation } from "react-i18next";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/** Canvas 版 PDF 预览（Android WebView 不能直接显示 PDF，pdf.js 是标准方案）。 */
export function PdfViewer({ pdfBytes }: { pdfBytes: ArrayBuffer | null }) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const taskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!pdfBytes) {
      taskRef.current?.destroy().catch(() => {});
      taskRef.current = null;
      setPageCount(0);
      return;
    }
    // pdf.js transfers the buffer — hand it a copy so retries still work
    (async () => {
      try {
        const task = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
        const doc = await task.promise;
        if (cancelled) {
          task.destroy().catch(() => {});
          return;
        }
        taskRef.current?.destroy().catch(() => {});
        taskRef.current = task;
        setPageCount(doc.numPages);
        setPageNum(1);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfBytes]);

  useEffect(() => {
    const task = taskRef.current;
    const canvas = canvasRef.current;
    if (!task || !canvas || pageNum < 1 || pageNum > pageCount) return;
    let cancelled = false;
    (async () => {
      try {
        const doc = await task.promise;
        if (cancelled) return;
        const page = await doc.getPage(pageNum);
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
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageNum, pageCount]);

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
          ◀
        </button>
        <span className="text-sm opacity-70">{pageCount ? `${pageNum} / ${pageCount}` : "…"}</span>
        <button
          type="button"
          className="btn btn-circle btn-ghost btn-sm"
          disabled={pageNum >= pageCount}
          aria-label={t("editor.nextPage")}
          onClick={() => setPageNum((n) => n + 1)}
        >
          ▶
        </button>
      </div>
      <canvas ref={canvasRef} />
    </div>
  );
}
