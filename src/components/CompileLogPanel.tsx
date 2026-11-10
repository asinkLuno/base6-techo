import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type CompileLogLine, parseCompileLog } from "../lib/compileLog";

interface CompileLogPanelProps {
  /** 最终编译日志（payload 全量），实时流结束后的展示内容。 */
  log?: string | null;
  /** 实时流行（编译中非 null），live 时优先展示。 */
  stream?: CompileLogLine[] | null;
  /** 编译进行中：强制展开、显示 spinner、自动滚动。 */
  live?: boolean;
  /** 失败场景传 true，初始即展开。 */
  defaultOpen?: boolean;
}

/** 实时/最终统一按行渲染，kind 决定行颜色；空行渲染空格撑住行高。
 *  memo：展开/复制等面板自身状态变化时不重复渲染几百行日志。 */
const LogLines = memo(function LogLines({
  lines,
}: {
  lines: CompileLogLine[];
}) {
  return (
    <>
      {lines.map((line, i) => (
        <span
          key={line.id ?? `f${i}`}
          className={
            line.kind === "error"
              ? "text-error block"
              : line.kind === "warning"
                ? "text-warning block"
                : "block"
          }
        >
          {line.text || " "}
        </span>
      ))}
    </>
  );
});

/**
 * Tectonic 编译日志面板：daisyUI collapse。编译中为实时流（spinner、逐行追加、
 * 自动滚动、按级别着色），结束后切换为完整 document.log（徽章摘要 + 复制）。
 */
export function CompileLogPanel({
  log,
  stream,
  live = false,
  defaultOpen = false,
}: CompileLogPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement | null>(null);
  const summary = useMemo(() => parseCompileLog(log ?? ""), [log]);
  // 最终态按行拆开，与实时态共用渲染；日志不变则不重复切分
  const finalLines = useMemo<CompileLogLine[]>(
    () =>
      (log ?? "").split("\n").map((text) => ({ kind: "tex" as const, text })),
    [log],
  );

  const isLive = live && stream !== null;

  // 进入实时态强制展开
  useEffect(() => {
    if (live) setOpen(true);
  }, [live]);

  // 从实时态切回最终态：有错误保持展开供排查，无错误收起只留摘要徽章
  const wasLive = useRef(false);
  useEffect(() => {
    if (isLive) {
      wasLive.current = true;
      return;
    }
    if (wasLive.current) {
      wasLive.current = false;
      setOpen(summary.errors > 0);
    }
  }, [isLive, summary]);

  // 实时流每追加一行滚到底部（依赖行数变化触发；行数组本身不参与渲染判断）
  // biome-ignore lint/correctness/useExhaustiveDependencies: 以 stream 长度作为追加信号
  useEffect(() => {
    if (isLive && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [isLive, stream?.length]);

  // 复制成功提示约两秒后消失
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!isLive && !log) return null;

  const lines = isLive ? (stream ?? []) : finalLines;

  const handleCopy = async () => {
    // 拼接只在点击时做，避免实时流每次追加都重扫整段日志
    const copyText = isLive
      ? (stream ?? []).map((l) => l.text).join("\n")
      : (log ?? "");
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
    } catch {
      // 剪贴板不可用时静默失败，不影响日志查看
    }
  };

  return (
    <details
      className="collapse-arrow bg-base-200 collapse"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="collapse-title min-h-0 py-3 font-medium">
        <span className="flex flex-wrap items-center gap-2">
          {t("editor.log.title")}
          {isLive ? (
            <span className="badge badge-info badge-sm">
              <span className="loading loading-spinner loading-xs" />
              {t("editor.generating")}
            </span>
          ) : (
            <>
              {summary.errors > 0 && (
                <span className="badge badge-error badge-sm">
                  {t("editor.log.errors", { num: summary.errors })}
                </span>
              )}
              {summary.warnings > 0 && (
                <span className="badge badge-warning badge-sm">
                  {t("editor.log.warnings", { num: summary.warnings })}
                </span>
              )}
              {summary.errors === 0 && summary.warnings === 0 && (
                <span className="badge badge-success badge-sm">
                  {t("editor.log.clean")}
                </span>
              )}
            </>
          )}
        </span>
      </summary>
      <div className="collapse-content">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="badge badge-ghost badge-sm">
            {t("editor.log.lines", { num: lines.length })}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={handleCopy}
          >
            {copied ? t("editor.log.copied") : t("editor.log.copy")}
          </button>
        </div>
        {lines.length === 0 ? (
          <p className="font-mono text-xs opacity-60">
            {t("editor.log.waiting")}
          </p>
        ) : (
          <pre
            ref={preRef}
            className="bg-neutral text-neutral-content max-h-[60vh] overflow-auto rounded-lg p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap"
          >
            <LogLines lines={lines} />
          </pre>
        )}
      </div>
    </details>
  );
}
