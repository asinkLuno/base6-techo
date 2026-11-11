import { useTranslation } from "react-i18next";
import {
  clampNumber,
  defaultMarginsForPaper,
  MARGIN_MM_MIN,
  type Margins,
  maxMarginMm,
  type PaperSize,
  paperDimsMm,
} from "../types/document";
import { NumberField } from "./NumberField";

const clampMargin = (max: number, fallback: number) => (value: number) =>
  clampNumber(value, MARGIN_MM_MIN, max, Math.min(fallback, max));

/** 四周边距编辑器：全书默认与 section 覆盖共用同一个组件。 */
export function MarginsEditor({
  paper,
  margins,
  onChange,
}: {
  paper: PaperSize;
  margins: Margins;
  onChange: (margins: Margins) => void;
}) {
  const { t } = useTranslation();
  const dims = paperDimsMm(paper);
  const recommended = defaultMarginsForPaper(paper);
  const { headerMm, footerMm, innerMm, outerMm } = margins;
  const contentWidth = Math.max(0, dims.widthMm - innerMm - outerMm);
  const contentHeight = Math.max(0, dims.heightMm - headerMm - footerMm);
  const set = (patch: Partial<Margins>) => onChange({ ...margins, ...patch });

  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">{t("editor.page.margins")}</legend>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={t("editor.page.marginHeader")}
          value={headerMm}
          min={MARGIN_MM_MIN}
          max={maxMarginMm(dims.heightMm, footerMm)}
          step={1}
          clamp={clampMargin(
            maxMarginMm(dims.heightMm, footerMm),
            recommended.headerMm,
          )}
          onCommit={(headerMm) => set({ headerMm })}
        />
        <NumberField
          label={t("editor.page.marginFooter")}
          value={footerMm}
          min={MARGIN_MM_MIN}
          max={maxMarginMm(dims.heightMm, headerMm)}
          step={1}
          clamp={clampMargin(
            maxMarginMm(dims.heightMm, headerMm),
            recommended.footerMm,
          )}
          onCommit={(footerMm) => set({ footerMm })}
        />
        <NumberField
          label={t("editor.page.marginInner")}
          value={innerMm}
          min={MARGIN_MM_MIN}
          max={maxMarginMm(dims.widthMm, outerMm)}
          step={1}
          clamp={clampMargin(
            maxMarginMm(dims.widthMm, outerMm),
            recommended.innerMm,
          )}
          onCommit={(innerMm) => set({ innerMm })}
        />
        <NumberField
          label={t("editor.page.marginOuter")}
          value={outerMm}
          min={MARGIN_MM_MIN}
          max={maxMarginMm(dims.widthMm, innerMm)}
          step={1}
          clamp={clampMargin(
            maxMarginMm(dims.widthMm, innerMm),
            recommended.outerMm,
          )}
          onCommit={(outerMm) => set({ outerMm })}
        />
      </div>
      <p className="text-base-content/60 text-xs">
        {t("editor.page.contentArea", {
          width: contentWidth.toFixed(1),
          height: contentHeight.toFixed(1),
        })}
      </p>
    </fieldset>
  );
}
