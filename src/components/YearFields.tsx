import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
  clampLineWidthPt,
  clampYear,
  isIsoMonth,
  LINE_WIDTH_PT_MAX,
  LINE_WIDTH_PT_MIN,
  MONTH_DATE_SIZE_PT_MAX,
  MONTH_DATE_SIZE_PT_MIN,
  MONTHS_MAX,
  TEXT_MAX,
  YEAR_GRID_MAX,
  YEAR_GRID_MIN,
  type YearPattern,
} from "../types/document";
import { NumberField } from "./NumberField";
import { ColorField, TextField, useBodyPatch } from "./PatternControls";

/** 年历配置：起始月 + 月数 + 网格行列 + 标题/表头 + 三色与节假日着色。 */
export const YearFields = memo(function YearFields({
  sectionId,
  body,
}: {
  sectionId: string;
  body: YearPattern;
}) {
  const { t } = useTranslation();
  const setYear = useBodyPatch(sectionId, body);
  // clampYear 同时处理起始月与月数的年界收敛。
  const clamped = clampYear(body);

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
              const next = clampYear({ ...body, startMonth: e.target.value });
              setYear({ startMonth: next.startMonth, months: next.months });
            }}
          />
        </fieldset>
        <NumberField
          label={t("editor.config.monthCount")}
          value={clamped.months}
          min={1}
          max={MONTHS_MAX}
          step={1}
          clamp={(value) => clampYear({ ...body, months: value }).months}
          onCommit={(months) => setYear({ months })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label={t("editor.config.yearRows")}
          value={body.rows}
          min={YEAR_GRID_MIN}
          max={YEAR_GRID_MAX}
          step={1}
          clamp={(value) => clampYear({ ...body, rows: value }).rows}
          onCommit={(rows) => setYear({ rows })}
        />
        <NumberField
          label={t("editor.config.yearCols")}
          value={body.cols}
          min={YEAR_GRID_MIN}
          max={YEAR_GRID_MAX}
          step={1}
          clamp={(value) => clampYear({ ...body, cols: value }).cols}
          onCommit={(cols) => setYear({ cols })}
        />
      </div>

      <p className="label">
        {t("editor.config.yearPerPage", {
          per: body.rows * body.cols,
          pages: Math.ceil(clamped.months / (body.rows * body.cols)),
        })}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t("editor.config.monthTitleFormat")}
          value={body.titleFormat}
          hint={t("editor.config.octanFormatHint")}
          maxLength={TEXT_MAX}
          clamp={(text) =>
            clampYear({ ...body, titleFormat: text }).titleFormat
          }
          onCommit={(titleFormat) => setYear({ titleFormat })}
        />
        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            {t("editor.config.monthWeekdayLang")}
          </legend>
          <select
            className="select w-full"
            value={body.weekdayLang}
            onChange={(e) =>
              setYear({
                weekdayLang: e.target.value as YearPattern["weekdayLang"],
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
        <NumberField
          label={t("editor.config.lineWidthPt")}
          value={body.lineWidthPt}
          min={LINE_WIDTH_PT_MIN}
          max={LINE_WIDTH_PT_MAX}
          step={0.1}
          clamp={clampLineWidthPt}
          onCommit={(lineWidthPt) => setYear({ lineWidthPt })}
        />
        <NumberField
          label={t("editor.config.monthDateSize")}
          value={body.dateSizePt}
          min={MONTH_DATE_SIZE_PT_MIN}
          max={MONTH_DATE_SIZE_PT_MAX}
          step={0.5}
          clamp={(value) =>
            clampYear({ ...body, dateSizePt: value }).dateSizePt
          }
          onCommit={(dateSizePt) => setYear({ dateSizePt })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField
          label={t("editor.config.monthLineColor")}
          value={body.lineColor}
          onChange={(lineColor) => setYear({ lineColor })}
        />
        <ColorField
          label={t("editor.config.monthTextColor")}
          value={body.textColor}
          onChange={(textColor) => setYear({ textColor })}
        />
        <ColorField
          label={t("editor.config.yearHolidayColor")}
          value={body.holidayColor}
          onChange={(holidayColor) => setYear({ holidayColor })}
        />
        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            {t("editor.config.yearShowHolidays")}
          </legend>
          <label className="flex h-12 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="checkbox"
              checked={body.showHolidays}
              onChange={(e) => setYear({ showHolidays: e.target.checked })}
            />
            <span className="text-sm">
              {t("editor.config.yearShowHolidaysHint")}
            </span>
          </label>
        </fieldset>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            {t("editor.config.yearShowLunar")}
          </legend>
          <label className="flex h-12 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="checkbox"
              checked={body.showLunar}
              onChange={(e) => setYear({ showLunar: e.target.checked })}
            />
            <span className="text-sm">
              {t("editor.config.yearShowLunarHint")}
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
