import { isTauri } from "@tauri-apps/api/core";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { openIcsFile } from "../lib/configTransfer";
import { parseIcs } from "../lib/ics";
import { useDocumentStore } from "../stores/document";
import { clampHolidays, HOLIDAYS_MAX } from "../types/document";

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * 全书共享的节假日：从 .ics 日历导入日期 → 名称，年历模板用它着色。
 * 面板只做导入与清空，条目数用一行统计提示。
 */
export const HolidaysPanel = memo(function HolidaysPanel({
  disabled,
}: {
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const holidays = useDocumentStore((state) => state.holidays);
  const updateHolidays = useDocumentStore((state) => state.updateHolidays);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const count = Object.keys(holidays).length;

  const handleImport = async () => {
    if (!isTauri()) {
      setNotice({ kind: "error", text: t("editor.transfer.needDesktop") });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const picked = await openIcsFile();
      if (!picked.ok) return; // 用户取消，静默
      const parsed = parseIcs(picked.contents);
      if (Object.keys(parsed).length === 0) {
        setNotice({ kind: "error", text: t("editor.holidays.empty") });
        return;
      }
      // 导入是增量合并：同名日期以新文件为准，其余保留。
      const merged = { ...holidays, ...parsed };
      const total = Object.keys(merged).length;
      // clampHolidays 按插入顺序截断，新导入的键排在最后，所以先算清实际落库数。
      const next = clampHolidays(merged);
      updateHolidays(next);
      const added = Object.keys(next).length - Object.keys(holidays).length;
      setNotice(
        total > HOLIDAYS_MAX
          ? {
              kind: "error",
              text: t("editor.holidays.truncated", {
                max: HOLIDAYS_MAX,
                count: added,
              }),
            }
          : {
              kind: "success",
              text: t("editor.holidays.imported", { count: added }),
            },
      );
    } catch (e) {
      setNotice({
        kind: "error",
        text: t("editor.holidays.importError", { message: messageOf(e) }),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleClear = () => {
    updateHolidays({});
    setNotice(null);
  };

  return (
    <section className="border-base-300 space-y-2 border-t pt-4">
      <h2 className="card-title">{t("editor.holidays.title")}</h2>
      <p className="text-sm opacity-70">{t("editor.holidays.hint")}</p>

      <div className="join w-full">
        <button
          type="button"
          className="btn join-item flex-1"
          disabled={disabled || busy}
          onClick={handleImport}
        >
          {busy ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <CalendarIcon />
          )}
          {busy ? t("editor.holidays.importing") : t("editor.holidays.import")}
        </button>
        <button
          type="button"
          className="btn join-item flex-1"
          disabled={disabled || busy || count === 0}
          onClick={handleClear}
        >
          {t("editor.holidays.clear")}
        </button>
      </div>

      <p className="label">
        {count === 0
          ? t("editor.holidays.none")
          : t("editor.holidays.count", { count })}
      </p>

      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`alert ${notice.kind === "error" ? "alert-error" : "alert-success"}`}
        >
          <span className="break-all">{notice.text}</span>
        </div>
      )}
    </section>
  );
});

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
