import { isTauri } from "@tauri-apps/api/core";
import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type ConfigParseError,
  parseConfigFile,
  serializeConfig,
} from "../lib/configFile";
import { exportConfigFile, openConfigFile } from "../lib/configTransfer";
import { describeTarget } from "../lib/savePdf";
import { useDocumentStore } from "../stores/document";
import type { DocumentSnapshot } from "../stores/documentState";

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  );
}

const PARSE_ERROR_KEY = {
  invalidJson: "editor.transfer.invalidJson",
  notConfig: "editor.transfer.notConfig",
  unsupportedVersion: "editor.transfer.unsupportedVersion",
} as const satisfies Record<ConfigParseError, string>;

type Notice = { kind: "success" | "error"; text: string };
type Busy = "export" | "import" | null;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

interface ConfigTransferPanelProps {
  /** 生成期间禁用，避免导入后预览与配置对不上。 */
  disabled?: boolean;
  /** 导入成功后通知主界面丢弃旧配置生成的预览与日志。 */
  onImported?: () => void;
}

/** 右栏的配置导入导出：整份文档（section、页面设置、装饰、装订）存成一个 JSON 文件。
 *  memo：编译日志每帧推流会让父组件重渲，props 稳定时跳过本面板。 */
export const ConfigTransferPanel = memo(function ConfigTransferPanel({
  disabled = false,
  onImported,
}: ConfigTransferPanelProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  /** 待确认的导入快照；null = 没有待处理导入 */
  const [pending, setPending] = useState<DocumentSnapshot | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // 成功提示约四秒后自动消失；错误提示保留到下一次操作。
  useEffect(() => {
    if (notice?.kind !== "success") return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // 待确认时打开原生 modal；StrictMode 会重复执行 effect，已打开就跳过。
  useEffect(() => {
    if (pending && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [pending]);

  const applyImport = (snapshot: DocumentSnapshot) => {
    useDocumentStore.getState().replaceDocument(snapshot);
    const pages = snapshot.sections.reduce(
      (sum, section) => sum + section.pages,
      0,
    );
    setNotice({
      kind: "success",
      text: t("editor.transfer.imported", {
        sections: snapshot.sections.length,
        pages,
      }),
    });
    setPending(null);
    onImported?.();
  };

  const handleExport = async () => {
    if (!isTauri()) {
      setNotice({ kind: "error", text: t("editor.transfer.needDesktop") });
      return;
    }
    setBusy("export");
    setNotice(null);
    try {
      const contents = serializeConfig(useDocumentStore.getState());
      const result = await exportConfigFile(contents);
      if (!result.ok) return; // 用户取消，静默
      setNotice({
        kind: "success",
        text: t("editor.transfer.exportedTo", {
          target: describeTarget(result.target),
        }),
      });
    } catch (e) {
      setNotice({
        kind: "error",
        text: t("editor.transfer.exportError", { message: messageOf(e) }),
      });
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async () => {
    if (!isTauri()) {
      setNotice({ kind: "error", text: t("editor.transfer.needDesktop") });
      return;
    }
    setBusy("import");
    setNotice(null);
    try {
      const picked = await openConfigFile();
      if (!picked.ok) return; // 用户取消，静默
      const parsed = parseConfigFile(picked.contents);
      if (!parsed.ok) {
        setNotice({ kind: "error", text: t(PARSE_ERROR_KEY[parsed.error]) });
        return;
      }
      // 有内容才确认；空文档直接还原，保持「一键」体验。
      if (useDocumentStore.getState().sections.length > 0) {
        setPending(parsed.snapshot);
      } else {
        applyImport(parsed.snapshot);
      }
    } catch (e) {
      setNotice({
        kind: "error",
        text: t("editor.transfer.importError", { message: messageOf(e) }),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="border-base-300 space-y-2 border-t pt-4">
      <h2 className="card-title">{t("editor.transfer.title")}</h2>
      <p className="text-sm opacity-70">{t("editor.transfer.hint")}</p>

      <div className="join w-full">
        <button
          type="button"
          className="btn join-item flex-1"
          disabled={disabled || busy !== null}
          onClick={handleExport}
        >
          {busy === "export" ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <DownloadIcon />
          )}
          {busy === "export"
            ? t("editor.transfer.exporting")
            : t("editor.transfer.export")}
        </button>
        <button
          type="button"
          className="btn join-item flex-1"
          disabled={disabled || busy !== null}
          onClick={handleImport}
        >
          {busy === "import" ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <UploadIcon />
          )}
          {busy === "import"
            ? t("editor.transfer.importing")
            : t("editor.transfer.import")}
        </button>
      </div>

      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`alert ${notice.kind === "error" ? "alert-error" : "alert-success"}`}
        >
          <span className="break-all">{notice.text}</span>
        </div>
      )}

      {pending && (
        <dialog
          ref={dialogRef}
          className="modal"
          onClose={() => setPending(null)}
        >
          <div className="modal-box">
            <h3 className="text-lg font-bold">
              {t("editor.transfer.confirmTitle")}
            </h3>
            <p className="py-4">
              {t("editor.transfer.confirmBody", {
                sections: pending.sections.length,
              })}
            </p>
            <div className="modal-action">
              <button
                type="button"
                className="btn"
                onClick={() => setPending(null)}
              >
                {t("editor.transfer.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-warning"
                onClick={() => applyImport(pending)}
              >
                {t("editor.transfer.confirm")}
              </button>
            </div>
          </div>
          {/* 点击遮罩或按 Esc 关闭；form method="dialog" 由原生 dialog 处理 */}
          <form method="dialog" className="modal-backdrop">
            <button type="submit">{t("editor.transfer.cancel")}</button>
          </form>
        </dialog>
      )}
    </section>
  );
});
