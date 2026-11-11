import { isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { CompileLogPanel } from "../components/CompileLogPanel";
import { ConfigTransferPanel } from "../components/ConfigTransferPanel";
import { PageSettingsPanel } from "../components/PageSettingsPanel";
import { SectionList } from "../components/SectionList";
import {
  appendLiveLine,
  type CompileLogLine,
  parseCompileLogKind,
  splitCompileError,
} from "../lib/compileLog";
import { generatePdf } from "../lib/generatePdf";
import { describeTarget, savePdfFile } from "../lib/savePdf";
import { useDocumentStore } from "../stores/document";
import { PAGES_MAX, toSectionSpecs } from "../types/document";

// pdfjs-dist 体积大且只在生成预览后才需要，懒加载避免进首屏 chunk。
const PdfViewer = lazy(() =>
  import("../components/PdfViewer").then((m) => ({ default: m.PdfViewer })),
);

/** 主界面：左栏版式组合（section 列表：拖拽排序、增删、逐项配置模板），右栏页面设置与生成。 */
export default function HomePage() {
  const { t } = useTranslation();
  // 只订阅派生标量：section 内容变化但总页数不变时，主界面不重渲。
  // 列表本身在 <SectionList> 内订阅 sections。
  const totalPages = useDocumentStore((s) =>
    s.sections.reduce((sum, section) => sum + section.pages, 0),
  );
  const hasSections = useDocumentStore((s) => s.sections.length > 0);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);
  /** 编译中的实时日志行；null = 非实时态 */
  const [stream, setStream] = useState<CompileLogLine[] | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  // 事件守卫：实时流结束后迟到的 compile-log 事件不再入列
  const liveActiveRef = useRef(false);
  // 编译期日志事件攒到下一帧批量提交：后端可能每秒推数百行，逐行 setState 会让整页跟着重渲
  const pendingLines = useRef<CompileLogLine[]>([]);
  const flushFrame = useRef<number | null>(null);

  // 全局注册 compile-log 监听（仅 Tauri 环境）：后端编译期间逐行推送
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: UnlistenFn | null = null;
    let disposed = false;

    const flush = () => {
      flushFrame.current = null;
      const batch = pendingLines.current;
      pendingLines.current = [];
      if (!liveActiveRef.current || batch.length === 0) return;
      setStream((prev) => {
        let next = prev ?? [];
        for (const line of batch) next = appendLiveLine(next, line);
        return next;
      });
    };

    void listen<{ kind: string; line: string }>("compile-log", (e) => {
      if (!liveActiveRef.current) return;
      pendingLines.current.push({
        kind: parseCompileLogKind(e.payload.kind),
        text: e.payload.line,
      });
      if (flushFrame.current === null) {
        flushFrame.current = requestAnimationFrame(flush);
      }
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      liveActiveRef.current = false;
      unlisten?.();
      if (flushFrame.current !== null) cancelAnimationFrame(flushFrame.current);
      flushFrame.current = null;
      pendingLines.current = [];
    };
  }, []);

  const handleGenerate = async () => {
    if (!isTauri()) {
      setPdfBytes(null);
      setError(t("editor.needDesktop"));
      return;
    }
    // 编译期间并行预载预览 chunk（pdfjs 体积大），生成完成后 PdfViewer 无需等下载
    void import("../components/PdfViewer");
    // page/imposition 只在这里用到，回调内按需读取，避免设置变更时重渲整个主界面
    const {
      page,
      decorations,
      imposition,
      sections: current,
    } = useDocumentStore.getState();
    setGenerating(true);
    setError(null);
    setLog(null);
    setStream([]);
    pendingLines.current = [];
    liveActiveRef.current = true;
    setSaveError(null);
    setSavedToast(null);
    try {
      const out = await generatePdf({
        page,
        decorations,
        imposition,
        sections: toSectionSpecs(current, page, decorations),
      });
      setPdfBytes(out.pdf);
      setLog(out.log || null);
      // 预览卡片在 setState 后才挂载，等一帧再滚动
      setTimeout(
        () =>
          previewRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        60,
      );
    } catch (e) {
      setPdfBytes(null);
      const { message, log: errLog } = splitCompileError(
        e instanceof Error ? e.message : String(e),
      );
      setError(message);
      setLog(errLog);
    } finally {
      // 实时流结束：迟到事件不再入列，面板切换为最终全量日志
      liveActiveRef.current = false;
      setStream(null);
      setGenerating(false);
    }
  };

  // 保存成功 toast 约四秒后自动消失
  useEffect(() => {
    if (!savedToast) return;
    const timer = setTimeout(() => setSavedToast(null), 4000);
    return () => clearTimeout(timer);
  }, [savedToast]);

  const handleSave = async () => {
    if (!pdfBytes || saving) return;
    setSaving(true);
    setSaveError(null);
    setSavedToast(null);
    try {
      const result = await savePdfFile(pdfBytes);
      if (!result.ok) return; // 用户取消，静默
      setSavedToast(
        t("editor.savedTo", { target: describeTarget(result.target) }),
      );
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // 导入配置会整体替换文档，旧配置生成的预览、日志与错误随即失效
  const handleImported = useCallback(() => {
    setPdfBytes(null);
    setLog(null);
    setError(null);
    setSaveError(null);
  }, []);

  const overflow = totalPages > PAGES_MAX;

  return (
    <>
      {/* 宽屏 6:4 双栏：左列表留足模板参数的位置，右栏设置不至于被拉成细条 */}
      <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-5">
        <SectionList />

        <aside className="space-y-3 lg:col-span-2">
          <PageSettingsPanel />
          <ConfigTransferPanel
            disabled={generating}
            onImported={handleImported}
          />
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!hasSections || overflow || generating || saving}
              onClick={handleGenerate}
            >
              {generating && (
                <span className="loading loading-spinner loading-xs" />
              )}
              {generating ? t("editor.generating") : t("editor.generate")}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!pdfBytes || generating || saving}
              onClick={handleSave}
            >
              {saving && (
                <span className="loading loading-spinner loading-xs" />
              )}
              {saving ? t("editor.saving") : t("editor.save")}
            </button>
          </div>

          {/* 生成失败提示贴着触发按钮，避免长列表时页面底部不可见 */}
          {error && (
            <div role="alert" className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          {/* 实时/最终日志面板固定在此一处（按钮与错误提示下方），避免位置跳动 */}
          {(generating || log) && (
            <CompileLogPanel
              log={log}
              stream={stream}
              live={generating}
              failed={!!error}
              defaultOpen={!!error}
            />
          )}

          {/* 保存失败提示贴着保存按钮，与生成失败提示同款 */}
          {saveError && (
            <div role="alert" className="alert alert-error">
              <span>{t("editor.saveError", { message: saveError })}</span>
            </div>
          )}
        </aside>
      </div>

      {pdfBytes && (
        <section ref={previewRef} className="card bg-base-100 shadow-md">
          <div className="card-body gap-4 p-4 sm:p-6">
            <h2 className="card-title">{t("editor.preview")}</h2>
            <Suspense
              fallback={
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-md" />
                </div>
              }
            >
              <PdfViewer pdfBytes={pdfBytes} />
            </Suspense>
          </div>
        </section>
      )}

      {savedToast && (
        <div className="toast toast-center toast-bottom z-50">
          <div className="alert alert-success shadow-lg">
            <span>{savedToast}</span>
          </div>
        </div>
      )}
    </>
  );
}
