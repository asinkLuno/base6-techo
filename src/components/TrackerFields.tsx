import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
  clampLineWidthPt,
  clampTracker,
  isIsoMonth,
  LINE_WIDTH_PT_MAX,
  LINE_WIDTH_PT_MIN,
  MONTH_DATE_SIZE_PT_MAX,
  MONTH_DATE_SIZE_PT_MIN,
  MONTHS_MAX,
  TRACKER_ITEMS_MAX,
  TRACKER_ITEMS_MIN,
  type TrackerPattern,
} from "../types/document";
import { NumberField } from "./NumberField";
import { ColorField, useBodyPatch } from "./PatternControls";

/** 月打卡配置：起始月份 + 连续月数 + 打卡项数 + 线色与字号。 */
export const TrackerFields = memo(function TrackerFields({
  sectionId,
  body,
}: {
  sectionId: string;
  body: TrackerPattern;
}) {
  const { t } = useTranslation();
  const setTracker = useBodyPatch(sectionId, body);
  // clampTracker 同时负责「起始月越晚，可容纳月数越少」的年界收敛。
  const clamped = clampTracker(body);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            {t("editor.config.trackerStart")}
          </legend>
          <input
            type="month"
            className="input w-full"
            value={body.startMonth}
            min="0001-01"
            max="9999-12"
            onChange={(e) => {
              if (!isIsoMonth(e.target.value)) return;
              const next = clampTracker({
                ...body,
                startMonth: e.target.value,
              });
              setTracker({
                startMonth: next.startMonth,
                months: next.months,
              });
            }}
          />
        </fieldset>
        <NumberField
          label={t("editor.config.trackerCount")}
          value={clamped.months}
          min={1}
          max={MONTHS_MAX}
          step={1}
          clamp={(value) => clampTracker({ ...body, months: value }).months}
          onCommit={(months) => setTracker({ months })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label={t("editor.config.trackerItems")}
          value={body.items}
          min={TRACKER_ITEMS_MIN}
          max={TRACKER_ITEMS_MAX}
          step={1}
          clamp={(value) => clampTracker({ ...body, items: value }).items}
          onCommit={(items) => setTracker({ items })}
        />
        <NumberField
          label={t("editor.config.trackerDateSize")}
          value={body.dateSizePt}
          min={MONTH_DATE_SIZE_PT_MIN}
          max={MONTH_DATE_SIZE_PT_MAX}
          step={0.5}
          clamp={(value) =>
            clampTracker({ ...body, dateSizePt: value }).dateSizePt
          }
          onCommit={(dateSizePt) => setTracker({ dateSizePt })}
        />
      </div>

      <p className="label">{t("editor.config.trackerItemsHint")}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField
          label={t("editor.config.trackerLineColor")}
          value={body.lineColor}
          onChange={(lineColor) => setTracker({ lineColor })}
        />
        <NumberField
          label={t("editor.config.lineWidthPt")}
          value={body.lineWidthPt}
          min={LINE_WIDTH_PT_MIN}
          max={LINE_WIDTH_PT_MAX}
          step={0.1}
          clamp={clampLineWidthPt}
          onCommit={(lineWidthPt) => setTracker({ lineWidthPt })}
        />
      </div>

      {clamped.months !== body.months && (
        <p className="label">
          {t("editor.config.trackerClamped", { months: clamped.months })}
        </p>
      )}
    </div>
  );
});
