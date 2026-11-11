import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "../stores/document";
import {
  A5_DIMS,
  clampNumber,
  DEFAULT_SHEETS_PER_SIGNATURE,
  isPaperPresetKind,
  PAPER_MM_MAX,
  PAPER_MM_MIN,
  PAPER_PRESET_KINDS,
  PAPER_PRESET_NAMES,
  paperDimsMm,
  SHEETS_PER_SIGNATURE_MAX,
  SHEETS_PER_SIGNATURE_MIN,
} from "../types/document";
import { DecorationsPanel } from "./DecorationsPanel";
import { NumberField } from "./NumberField";

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

// NumberField 的 clamp 是数字级的，这里按字段配上范围与回落值。
const clampPaperMm = (fallback: number) => (value: number) =>
  clampNumber(value, PAPER_MM_MIN, PAPER_MM_MAX, fallback);
const clampSheets = (value: number) =>
  clampNumber(
    value,
    SHEETS_PER_SIGNATURE_MIN,
    SHEETS_PER_SIGNATURE_MAX,
    DEFAULT_SHEETS_PER_SIGNATURE,
  );

/** 右侧栏的页面设置区（无卡片外框）：纸张（含自定义宽高）、装订方式。
 *  memo：无 props，编译日志每帧推流导致父组件重渲时跳过本面板；store 订阅仍照常触发自身更新。 */
export const PageSettingsPanel = memo(function PageSettingsPanel() {
  const { t } = useTranslation();
  const page = useDocumentStore((s) => s.page);
  const decorations = useDocumentStore((s) => s.decorations);
  const imposition = useDocumentStore((s) => s.imposition);
  const updatePage = useDocumentStore((s) => s.updatePage);
  const updateDecorations = useDocumentStore((s) => s.updateDecorations);
  const updateImposition = useDocumentStore((s) => s.updateImposition);
  const paper = page.paper;
  const impositionInfo = t(
    imposition.mode === "thread"
      ? "editor.page.impositionInfoThread"
      : imposition.mode === "booklet"
        ? "editor.page.impositionInfoBooklet"
        : "editor.page.impositionInfoNone",
  );

  return (
    <section className="space-y-4">
      <h2 className="card-title">{t("editor.page.title")}</h2>

      <fieldset className="fieldset">
        <legend className="fieldset-legend">{t("editor.page.paper")}</legend>
        <select
          className="select w-full"
          value={paper.kind}
          onChange={(e) => {
            const kind = e.target.value;
            updatePage({
              paper:
                kind === "custom"
                  ? {
                      kind: "custom",
                      widthMm: A5_DIMS.widthMm,
                      heightMm: A5_DIMS.heightMm,
                    }
                  : isPaperPresetKind(kind)
                    ? { kind }
                    : page.paper,
            });
          }}
        >
          {PAPER_PRESET_KINDS.map((kind) => {
            const dims = paperDimsMm({ kind });
            const name =
              kind === "a5sTnStandard"
                ? t("editor.page.paperA5sTn")
                : kind === "tnPassport"
                  ? t("editor.page.paperTnPassport")
                  : PAPER_PRESET_NAMES[kind];
            return (
              <option key={kind} value={kind}>
                {t("editor.page.paperOption", {
                  name,
                  width: dims.widthMm,
                  height: dims.heightMm,
                })}
              </option>
            );
          })}
          <option value="custom">{t("editor.page.custom")}</option>
        </select>
      </fieldset>

      {paper.kind === "custom" && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t("editor.page.widthMm")}
            value={paper.widthMm}
            min={PAPER_MM_MIN}
            max={PAPER_MM_MAX}
            step={1}
            clamp={clampPaperMm(A5_DIMS.widthMm)}
            onCommit={(widthMm) => updatePage({ paper: { ...paper, widthMm } })}
          />
          <NumberField
            label={t("editor.page.heightMm")}
            value={paper.heightMm}
            min={PAPER_MM_MIN}
            max={PAPER_MM_MAX}
            step={1}
            clamp={clampPaperMm(A5_DIMS.heightMm)}
            onCommit={(heightMm) =>
              updatePage({ paper: { ...paper, heightMm } })
            }
          />
        </div>
      )}

      <fieldset className="fieldset">
        <legend className="fieldset-legend flex items-center gap-1">
          {t("editor.page.imposition")}
          {/* 悬停/聚焦显示当前装订方式的说明 */}
          <span className="tooltip tooltip-left" data-tip={impositionInfo}>
            <button
              type="button"
              className="btn btn-ghost btn-circle btn-xs"
              aria-label={t("editor.page.impositionInfoAria")}
            >
              <InfoIcon />
            </button>
          </span>
        </legend>
        <select
          className="select w-full"
          value={imposition.mode}
          onChange={(e) => {
            const mode = e.target.value;
            updateImposition(
              mode === "thread"
                ? {
                    mode: "thread",
                    sheetsPerSignature: DEFAULT_SHEETS_PER_SIGNATURE,
                  }
                : mode === "booklet"
                  ? { mode: "booklet" }
                  : { mode: "none" },
            );
          }}
        >
          <option value="none">{t("editor.page.impositionNone")}</option>
          <option value="booklet">{t("editor.page.impositionBooklet")}</option>
          <option value="thread">{t("editor.page.impositionThread")}</option>
        </select>
      </fieldset>

      {imposition.mode === "thread" && (
        <NumberField
          label={t("editor.page.sheetsPerSignature")}
          value={imposition.sheetsPerSignature}
          min={SHEETS_PER_SIGNATURE_MIN}
          max={SHEETS_PER_SIGNATURE_MAX}
          step={1}
          clamp={clampSheets}
          onCommit={(sheetsPerSignature) =>
            updateImposition({ mode: "thread", sheetsPerSignature })
          }
        />
      )}

      <DecorationsPanel
        paper={paper}
        margins={page.margins}
        decorations={decorations}
        onMarginsChange={(margins) => updatePage({ margins })}
        onDecorationsChange={updateDecorations}
      />
    </section>
  );
});
