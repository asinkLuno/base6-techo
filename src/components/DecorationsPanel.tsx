import { useTranslation } from "react-i18next";
import type {
  Band,
  Decorations,
  Margins,
  PaperSize,
  Watermark,
} from "../types/document";
import { DecorationsEditor } from "./DecorationsEditor";
import { MarginsEditor } from "./MarginsEditor";

/**
 * 「页头、页脚与水印」的完整控件（含折叠外框）：边距 + 页头 + 页脚 + 两侧水印。
 * 全书默认与 section 覆盖共用这一份实现，父组件只负责传入生效值与回调，
 * 两处的 DOM 结构因此完全一致。
 * section 处于继承全书状态时传 `inherited`，只展示全书值的只读摘要。
 */
export function DecorationsPanel({
  paper,
  margins,
  decorations,
  onMarginsChange,
  onDecorationsChange,
  inherited = false,
}: {
  paper: PaperSize;
  margins: Margins;
  decorations: Decorations;
  onMarginsChange: (margins: Margins) => void;
  onDecorationsChange: (decorations: Decorations) => void;
  inherited?: boolean;
}) {
  const { t } = useTranslation();

  const bandLabel = (band: Band): string => {
    const content =
      band.content.kind === "text" && band.content.text
        ? band.content.text
        : band.content.kind === "date"
          ? t("editor.decorations.contentDate")
          : t("editor.decorations.contentEmpty");
    return band.pageNumber
      ? `${content} · ${t("editor.decorations.pageNumber")}`
      : content;
  };
  const watermarkLabel = (watermark: Watermark | null): string =>
    watermark?.text || t("editor.decorations.contentEmpty");

  return (
    <details className="collapse-arrow bg-base-200 collapse">
      <summary className="collapse-title font-medium">
        {t("editor.decorations.title")}
      </summary>
      <div className="collapse-content">
        {inherited ? (
          <div className="grid gap-2">
            <p className="text-base-content/70 text-xs">
              {t("editor.page.inheritedMargins", {
                header: margins.headerMm,
                footer: margins.footerMm,
                inner: margins.innerMm,
                outer: margins.outerMm,
              })}
            </p>
            <p className="text-base-content/70 text-xs">
              {t("editor.decorations.inheritedSummary", {
                header: bandLabel(decorations.header),
                footer: bandLabel(decorations.footer),
                inner: watermarkLabel(decorations.innerWatermark),
                outer: watermarkLabel(decorations.outerWatermark),
              })}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            <MarginsEditor
              paper={paper}
              margins={margins}
              onChange={onMarginsChange}
            />
            <div className="divider my-0" />
            <DecorationsEditor
              value={decorations}
              onChange={onDecorationsChange}
            />
          </div>
        )}
      </div>
    </details>
  );
}
