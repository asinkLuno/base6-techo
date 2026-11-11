import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
  clampLineWidthPt,
  clampMonth,
  isIsoMonth,
  LINE_WIDTH_PT_MAX,
  LINE_WIDTH_PT_MIN,
  MONTH_DATE_SIZE_PT_MAX,
  MONTH_DATE_SIZE_PT_MIN,
  MONTHS_MAX,
  type MonthPattern,
  TEXT_MAX,
} from "../types/document";
import { NumberField } from "./NumberField";
import { ColorField, TextField, useBodyPatch } from "./PatternControls";

/** 月历配置：起始月份 + 连续月数 + 标题/表头 + 线色与月相。 */
export const MonthFields = memo(function MonthFields({
  sectionId,
  body,
}: {
  sectionId: string;
  body: MonthPattern;
}) {
  const { t } = useTranslation();
  const setMonth = useBodyPatch(sectionId, body);
  // clampMonth 同时负责「起始月越晚，可容纳月数越少」的年界收敛。
  const clamped = clampMonth(body);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            {t("editor.config.monthStart")}
          </legend>
          <input
            type="month"
            className="input w-full"
            value={body.startMonth}
            min="0001-01"
            max="9999-12"
            onChange={(e) => {
              if (!isIsoMonth(e.target.value)) return;
              const next = clampMonth({
                ...body,
                startMonth: e.target.value,
              });
              setMonth({
                startMonth: next.startMonth,
                months: next.months,
              });
            }}
          />
        </fieldset>
        <NumberField
          label={t("editor.config.monthCount")}
          value={clamped.months}
          min={1}
          max={MONTHS_MAX}
          step={1}
          clamp={(value) => clampMonth({ ...body, months: value }).months}
          onCommit={(months) => setMonth({ months })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t("editor.config.monthTitleFormat")}
          value={body.titleFormat}
          hint={t("editor.config.octanFormatHint")}
          maxLength={TEXT_MAX}
          clamp={(text) =>
            clampMonth({ ...body, titleFormat: text }).titleFormat
          }
          onCommit={(titleFormat) => setMonth({ titleFormat })}
        />
        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            {t("editor.config.monthWeekdayLang")}
          </legend>
          <select
            className="select w-full"
            value={body.weekdayLang}
            onChange={(e) =>
              setMonth({
                weekdayLang: e.target.value as MonthPattern["weekdayLang"],
              })
            }
          >
            <option value="zh">{t("editor.config.octanLangZh")}</option>
            <option value="en">{t("editor.config.octanLangEn")}</option>
            <option value="ja">{t("editor.config.octanLangJa")}</option>
          </select>
        </fieldset>
      </div>

      <TextField
        label={t("editor.config.monthWeekdayHeaders")}
        value={body.weekdayHeaders}
        hint={t("editor.config.octanWeekdayHeadersHint")}
        maxLength={TEXT_MAX}
        clamp={(text) =>
          clampMonth({ ...body, weekdayHeaders: text }).weekdayHeaders
        }
        onCommit={(weekdayHeaders) => setMonth({ weekdayHeaders })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label={t("editor.config.lineWidthPt")}
          value={body.lineWidthPt}
          min={LINE_WIDTH_PT_MIN}
          max={LINE_WIDTH_PT_MAX}
          step={0.1}
          clamp={clampLineWidthPt}
          onCommit={(lineWidthPt) => setMonth({ lineWidthPt })}
        />
        <NumberField
          label={t("editor.config.monthDateSize")}
          value={body.dateSizePt}
          min={MONTH_DATE_SIZE_PT_MIN}
          max={MONTH_DATE_SIZE_PT_MAX}
          step={0.5}
          clamp={(value) =>
            clampMonth({ ...body, dateSizePt: value }).dateSizePt
          }
          onCommit={(dateSizePt) => setMonth({ dateSizePt })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField
          label={t("editor.config.monthLineColor")}
          value={body.lineColor}
          onChange={(lineColor) => setMonth({ lineColor })}
        />
        <ColorField
          label={t("editor.config.monthTextColor")}
          value={body.textColor}
          onChange={(textColor) => setMonth({ textColor })}
        />
        <ColorField
          label={t("editor.config.monthPhaseColor")}
          value={body.phaseColor}
          onChange={(phaseColor) => setMonth({ phaseColor })}
        />
        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            {t("editor.config.monthShowPhase")}
          </legend>
          <label className="flex h-12 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="checkbox"
              checked={body.showPhase}
              onChange={(e) => setMonth({ showPhase: e.target.checked })}
            />
            <span className="text-sm">
              {t("editor.config.monthShowPhaseHint")}
            </span>
          </label>
        </fieldset>
      </div>

      {clamped.months !== body.months && (
        <p className="label">
          {t("editor.config.monthClamped", { months: clamped.months })}
        </p>
      )}
    </div>
  );
});
