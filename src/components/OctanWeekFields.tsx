import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
  addDays,
  clampLineWidthPt,
  clampNumber,
  DEFAULT_OCTAN_WEEK,
  isIsoDate,
  isValidDateFormat,
  isValidWeekdayHeaders,
  LINE_WIDTH_PT_MAX,
  LINE_WIDTH_PT_MIN,
  mondayOf,
  OCTAN_CENTER_GAP_MM_MAX,
  OCTAN_CENTER_GAP_MM_MIN,
  OCTAN_DATE_SIZE_PT_MAX,
  OCTAN_DATE_SIZE_PT_MIN,
  OCTAN_WEEKS_MAX,
  type OctanWeekPattern,
  TEXT_MAX,
  weeksBetween,
} from "../types/document";
import { NumberField } from "./NumberField";
import { ColorField, TextField, useBodyPatch } from "./PatternControls";

/** 八分周视图配置：周范围 + 日期/月历格式 + 线型与颜色。 */
export const OctanWeekFields = memo(function OctanWeekFields({
  sectionId,
  body,
}: {
  sectionId: string;
  body: OctanWeekPattern;
}) {
  const { t } = useTranslation();
  const setOctan = useBodyPatch(sectionId, body);
  const weeks = Math.max(1, weeksBetween(body.startDate, body.endDate));

  // 起点吸附到周一，终点按整周数推导，避免出现半周导致 Rust 拒绝。
  const setRange = (startDate: string, count: number) => {
    const monday = mondayOf(startDate);
    if (!isIsoDate(monday)) return;
    const nextWeeks = clampNumber(count, 1, OCTAN_WEEKS_MAX, weeks);
    setOctan({
      startDate: monday,
      endDate: addDays(monday, nextWeeks * 7 - 1),
    });
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            {t("editor.config.octanStartDate")}
          </legend>
          <input
            type="date"
            className="input w-full"
            value={body.startDate}
            onChange={(e) => {
              if (isIsoDate(e.target.value)) setRange(e.target.value, weeks);
            }}
          />
        </fieldset>
        <NumberField
          label={t("editor.config.octanWeeks")}
          value={weeks}
          min={1}
          max={OCTAN_WEEKS_MAX}
          step={1}
          clamp={(value) => clampNumber(value, 1, OCTAN_WEEKS_MAX, weeks)}
          onCommit={(count) => setRange(body.startDate, count)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t("editor.config.octanDateFormat")}
          value={body.dateFormat}
          hint={t("editor.config.octanFormatHint")}
          maxLength={TEXT_MAX}
          clamp={(text) =>
            isValidDateFormat(text) ? text : DEFAULT_OCTAN_WEEK.dateFormat
          }
          onCommit={(dateFormat) => setOctan({ dateFormat })}
        />
        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            {t("editor.config.octanWeekdayLang")}
          </legend>
          <select
            className="select w-full"
            value={body.weekdayLang}
            onChange={(e) =>
              setOctan({
                weekdayLang: e.target.value as OctanWeekPattern["weekdayLang"],
              })
            }
          >
            <option value="zh">{t("editor.config.octanLangZh")}</option>
            <option value="en">{t("editor.config.octanLangEn")}</option>
            <option value="ja">{t("editor.config.octanLangJa")}</option>
          </select>
        </fieldset>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t("editor.config.octanTitleFormat")}
          value={body.titleFormat}
          hint={t("editor.config.octanFormatHint")}
          maxLength={TEXT_MAX}
          clamp={(text) =>
            isValidDateFormat(text) ? text : DEFAULT_OCTAN_WEEK.titleFormat
          }
          onCommit={(titleFormat) => setOctan({ titleFormat })}
        />
        <TextField
          label={t("editor.config.octanWeekdayHeaders")}
          value={body.weekdayHeaders}
          hint={t("editor.config.octanWeekdayHeadersHint")}
          maxLength={TEXT_MAX}
          clamp={(text) =>
            isValidWeekdayHeaders(text)
              ? text
              : DEFAULT_OCTAN_WEEK.weekdayHeaders
          }
          onCommit={(weekdayHeaders) => setOctan({ weekdayHeaders })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            {t("editor.config.octanLineStyle")}
          </legend>
          <select
            className="select w-full"
            value={body.lineStyle}
            onChange={(e) =>
              setOctan({
                lineStyle: e.target.value as OctanWeekPattern["lineStyle"],
              })
            }
          >
            <option value="solid">{t("editor.config.octanStyleSolid")}</option>
            <option value="dashed">
              {t("editor.config.octanStyleDashed")}
            </option>
            <option value="dotted">
              {t("editor.config.octanStyleDotted")}
            </option>
            <option value="dashDot">
              {t("editor.config.octanStyleDashDot")}
            </option>
          </select>
        </fieldset>
        <NumberField
          label={t("editor.config.lineWidthPt")}
          value={body.lineWidthPt}
          min={LINE_WIDTH_PT_MIN}
          max={LINE_WIDTH_PT_MAX}
          step={0.1}
          clamp={clampLineWidthPt}
          onCommit={(lineWidthPt) => setOctan({ lineWidthPt })}
        />
        <NumberField
          label={t("editor.config.octanCenterGap")}
          value={body.centerGapMm}
          min={OCTAN_CENTER_GAP_MM_MIN}
          max={OCTAN_CENTER_GAP_MM_MAX}
          step={0.5}
          clamp={(value) =>
            clampNumber(
              value,
              OCTAN_CENTER_GAP_MM_MIN,
              OCTAN_CENTER_GAP_MM_MAX,
              DEFAULT_OCTAN_WEEK.centerGapMm,
            )
          }
          onCommit={(centerGapMm) => setOctan({ centerGapMm })}
        />
        <NumberField
          label={t("editor.config.octanDateSize")}
          value={body.dateSizePt}
          min={OCTAN_DATE_SIZE_PT_MIN}
          max={OCTAN_DATE_SIZE_PT_MAX}
          step={0.5}
          clamp={(value) =>
            clampNumber(
              value,
              OCTAN_DATE_SIZE_PT_MIN,
              OCTAN_DATE_SIZE_PT_MAX,
              DEFAULT_OCTAN_WEEK.dateSizePt,
            )
          }
          onCommit={(dateSizePt) => setOctan({ dateSizePt })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField
          label={t("editor.config.octanLineColor")}
          value={body.lineColor}
          onChange={(lineColor) => setOctan({ lineColor })}
        />
        <ColorField
          label={t("editor.config.octanTextColor")}
          value={body.textColor}
          onChange={(textColor) => setOctan({ textColor })}
        />
        <ColorField
          label={t("editor.config.octanHighlightColor")}
          value={body.highlightColor}
          onChange={(highlightColor) => setOctan({ highlightColor })}
        />
        <ColorField
          label={t("editor.config.octanPhaseColor")}
          value={body.phaseColor}
          onChange={(phaseColor) => setOctan({ phaseColor })}
        />
      </div>
    </div>
  );
});
