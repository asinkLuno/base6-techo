import { useTranslation } from "react-i18next";
import { NumberField } from "./NumberField";
import { useDocumentStore } from "../stores/document";
import {
  A5_DIMS,
  clampNumber,
  DEFAULT_SHEETS_PER_SIGNATURE,
  PAPER_MM_MAX,
  PAPER_MM_MIN,
  SHEETS_PER_SIGNATURE_MAX,
  SHEETS_PER_SIGNATURE_MIN,
  type PaperSize,
} from "../types/document";

const PAPER_PRESETS = ["a4", "a5", "b5", "a6", "b6", "letter"] as const;

// NumberField 的 clamp 是数字级的，这里按字段配上范围与回落值。
const clampPaperMm = (fallback: number) => (value: number) =>
  clampNumber(value, PAPER_MM_MIN, PAPER_MM_MAX, fallback);
const clampSheets = (value: number) =>
  clampNumber(value, SHEETS_PER_SIGNATURE_MIN, SHEETS_PER_SIGNATURE_MAX, DEFAULT_SHEETS_PER_SIGNATURE);

/** 右侧栏的设置卡片：纸张（含自定义宽高）、装订边、装订方式。 */
export function PageSettingsPanel() {
  const { t } = useTranslation();
  const page = useDocumentStore((s) => s.page);
  const imposition = useDocumentStore((s) => s.imposition);
  const updatePage = useDocumentStore((s) => s.updatePage);
  const updateImposition = useDocumentStore((s) => s.updateImposition);
  const paper = page.paper;

  return (
    <section className="card bg-base-100 shadow-md">
      <div className="card-body gap-4">
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
                    ? { kind: "custom", widthMm: A5_DIMS.widthMm, heightMm: A5_DIMS.heightMm }
                    : ({ kind } as PaperSize),
              });
            }}
          >
            {PAPER_PRESETS.map((kind) => (
              <option key={kind} value={kind}>
                {kind.toUpperCase()}
              </option>
            ))}
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
              onCommit={(heightMm) => updatePage({ paper: { ...paper, heightMm } })}
            />
          </div>
        )}

        <fieldset className="fieldset">
          <legend className="fieldset-legend">{t("editor.page.binding")}</legend>
          <select
            className="select w-full"
            value={page.binding}
            onChange={(e) => updatePage({ binding: e.target.value === "right" ? "right" : "left" })}
          >
            <option value="left">{t("editor.page.bindingLeft")}</option>
            <option value="right">{t("editor.page.bindingRight")}</option>
          </select>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">{t("editor.page.imposition")}</legend>
          <select
            className="select w-full"
            value={imposition.mode}
            onChange={(e) => {
              const mode = e.target.value;
              updateImposition(
                mode === "thread"
                  ? { mode: "thread", sheetsPerSignature: DEFAULT_SHEETS_PER_SIGNATURE }
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
      </div>
    </section>
  );
}
