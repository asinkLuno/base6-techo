import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const DEFAULT_DOC = String.raw`\documentclass{article}
\usepackage{amsmath,amssymb}
\begin{document}

\section{Hello}
Hello, \textbf{Tectonic} on \emph{Android}!

\[
  \int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}
\]

\begin{itemize}
  \item Xe\TeX{} engine, Unicode input
  \item offline TeXLive bundle
\end{itemize}

\end{document}
`;

/** Raw IPC payload from compile_tex: [u32 log_len LE][log utf8][pdf bytes] */
function unpackCompileResult(buf: ArrayBuffer): { log: string; pdf: ArrayBuffer } {
  const dv = new DataView(buf);
  const logLen = dv.getUint32(0, true);
  const log = new TextDecoder().decode(new Uint8Array(buf, 4, logLen));
  return { log, pdf: buf.slice(4 + logLen) };
}

function PdfViewer({ pdfBytes }: { pdfBytes: ArrayBuffer | null }) {
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

function App() {
  const [source, setSource] = useState(DEFAULT_DOC);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const [error, setError] = useState("");
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [showLog, setShowLog] = useState(false);

  const compile = useCallback(async () => {
    setBusy(true);
    setError("");
    setShowLog(false);
    try {
      const buf = await invoke<ArrayBuffer>("compile_tex", { source });
      const { log: compileLog, pdf } = unpackCompileResult(buf);
      setLog(compileLog);
      setPdfBytes(pdf);
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
      setPdfBytes(null);
    } finally {
      setBusy(false);
    }
  }, [source]);

  return (
    <main className="container">
      <header className="toolbar">
        <h1>base6-techo</h1>
        <button className="compile-btn" onClick={compile} disabled={busy}>
          {busy ? "编译中…" : "编译"}
        </button>
        {log && (
          <button className="ghost" onClick={() => setShowLog((v) => !v)}>
            {showLog ? "隐藏日志" : "日志"}
          </button>
        )}
      </header>

      {error && <pre className="error-box">{error}</pre>}
      {showLog && <pre className="log-box">{log}</pre>}

      <div className="editor-row">
        <textarea
          className="tex-input"
          spellCheck={false}
          value={source}
          onChange={(e) => setSource(e.currentTarget.value)}
          placeholder="在此输入 LaTeX 源码…"
        />
        <PdfViewer pdfBytes={pdfBytes} />
      </div>
    </main>
  );
}

export default App;
