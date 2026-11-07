import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/** Canvas 版 PDF 预览（Android WebView 不能直接显示 PDF，pdf.js 是标准方案）。 */
export function PdfViewer({ pdfBytes }: { pdfBytes: ArrayBuffer | null }) {
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

  if (error) return <div className="pdf-error">PDF 渲染失败：{error}</div>;
  if (!pdfBytes) return null;
  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <button disabled={pageNum <= 1} onClick={() => setPageNum((n) => n - 1)}>◀</button>
        <span>{pageCount ? `${pageNum} / ${pageCount}` : "…"}</span>
        <button disabled={pageNum >= pageCount} onClick={() => setPageNum((n) => n + 1)}>▶</button>
      </div>
      <canvas ref={canvasRef} className="pdf-canvas" />
    </div>
  );
}
