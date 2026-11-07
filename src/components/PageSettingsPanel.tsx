import { useTranslation } from "react-i18next";
import { NumberField } from "./NumberField";
import { useDocumentStore } from "../stores/document";
import {
  A5_DIMS,
  clampNumber,
  DEFAULT_PAGE,
  MARGIN_MM_MAX,
  MARGIN_MM_MIN,
  PAPER_MM_MAX,
  PAPER_MM_MIN,
  type PaperSize,
} from "../types/document";

const PAPER_PRESETS = ["a4", "a5", "b5", "a6", "b6", "letter"] as const;

// NumberField 的 clamp 是数字级的，这里按字段配上范围与回落值。
const clampPaperMm = (fallback: number) => (value: number) =>
  clampNumber(value, PAPER_MM_MIN, PAPER_MM_MAX, fallback);
const clampMarginMm = (fallback: number) => (value: number) =>
  clampNumber(value, MARGIN_MM_MIN, MARGIN_MM_MAX, fallback);

/** 右侧栏的页面设置卡片：纸张（含自定义宽高）、装订方向、四边留白。 */
export function PageSettingsPanel() {
  const { t } = useTranslation();
  const page = useDocumentStore((s) => s.page);
  const updatePage = useDocumentStore((s) => s.updatePage);
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

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t("editor.page.headerMm")}
            value={page.margins.headerMm}
            min={MARGIN_MM_MIN}
            max={MARGIN_MM_MAX}
            step={1}
            clamp={clampMarginMm(DEFAULT_PAGE.margins.headerMm)}
            onCommit={(headerMm) => updatePage({ margins: { ...page.margins, headerMm } })}
          />
          <NumberField
            label={t("editor.page.footerMm")}
            value={page.margins.footerMm}
            min={MARGIN_MM_MIN}
            max={MARGIN_MM_MAX}
            step={1}
            clamp={clampMarginMm(DEFAULT_PAGE.margins.footerMm)}
            onCommit={(footerMm) => updatePage({ margins: { ...page.margins, footerMm } })}
          />
          <NumberField
            label={t("editor.page.innerMm")}
            value={page.margins.innerMm}
            min={MARGIN_MM_MIN}
            max={MARGIN_MM_MAX}
            step={1}
            clamp={clampMarginMm(DEFAULT_PAGE.margins.innerMm)}
            onCommit={(innerMm) => updatePage({ margins: { ...page.margins, innerMm } })}
          />
          <NumberField
            label={t("editor.page.outerMm")}
            value={page.margins.outerMm}
            min={MARGIN_MM_MIN}
            max={MARGIN_MM_MAX}
            step={1}
            clamp={clampMarginMm(DEFAULT_PAGE.margins.outerMm)}
            onCommit={(outerMm) => updatePage({ margins: { ...page.margins, outerMm } })}
          />
        </div>
      </div>
    </section>
  );
}
