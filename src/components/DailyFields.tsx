import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
  addDays,
  clampLineWidthPt,
  clampNumber,
  DAILY_HOUR_MAX,
  DAILY_LABEL_SIZE_PT_MAX,
  DAILY_LABEL_SIZE_PT_MIN,
  DAILY_LATITUDE_MAX,
  DAILY_LATITUDE_MIN,
  DAILY_LONGITUDE_MAX,
  DAILY_LONGITUDE_MIN,
  DAILY_PAGES_MAX,
  DAILY_UTC_OFFSET_HOURS_MAX,
  DAILY_UTC_OFFSET_HOURS_MIN,
  type DailyPattern,
  DEFAULT_DAILY,
  DEFAULT_DAILY_SUN,
  daysBetween,
  isIsoDate,
  isValidDateFormat,
  LINE_WIDTH_PT_MAX,
  LINE_WIDTH_PT_MIN,
  TEXT_MAX,
} from "../types/document";
import { NumberField } from "./NumberField";
import { ColorField, TextField, useBodyPatch } from "./PatternControls";

/** 一日时间轴配置：日期范围、整点跨度、每日页数、标题与可选的昼夜着色。 */
export const DailyFields = memo(function DailyFields({
  sectionId,
  body,
}: {
  sectionId: string;
  body: DailyPattern;
}) {
  const { t } = useTranslation();
  const setDaily = useBodyPatch(sectionId, body);
  const days = Math.max(1, daysBetween(body.startDate, body.endDate));
  const maxDays = Math.floor(DAILY_PAGES_MAX / body.pagesPerDay);

  // 起点与天数共同决定终点，避免出现倒置或超过 999 页的日期范围。
  const setRange = (startDate: string, count: number) => {
    if (!isIsoDate(startDate)) return;
    const nextDays = Math.round(
      clampNumber(count, 1, maxDays, Math.min(days, maxDays)),
    );
    setDaily({ startDate, endDate: addDays(startDate, nextDays - 1) });
  };

  const sun = body.sun;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            {t("editor.config.dailyStartDate")}
          </legend>
          <input
            type="date"
            className="input w-full"
            value={body.startDate}
            onChange={(e) => setRange(e.target.value, days)}
          />
        </fieldset>
        <NumberField
          label={t("editor.config.dailyDays")}
          value={days}
          min={1}
          max={maxDays}
          step={1}
          clamp={(value) => Math.round(clampNumber(value, 1, maxDays, days))}
          onCommit={(count) => setRange(body.startDate, count)}
        />
        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            {t("editor.config.dailyPagesPerDay")}
          </legend>
          <select
            className="select w-full"
            value={body.pagesPerDay}
            onChange={(e) => {
              const pagesPerDay = e.target.value === "2" ? 2 : 1;
              const limit = Math.floor(DAILY_PAGES_MAX / pagesPerDay);
              setDaily({
                pagesPerDay,
                endDate: addDays(body.startDate, Math.min(days, limit) - 1),
              });
            }}
          >
            <option value="1">{t("editor.config.dailyOnePage")}</option>
            <option value="2">{t("editor.config.dailyTwoPages")}</option>
          </select>
        </fieldset>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label={t("editor.config.dailyStartHour")}
          value={body.startHour}
          min={0}
          max={DAILY_HOUR_MAX}
          step={1}
          clamp={(value) =>
            Math.round(
              clampNumber(value, 0, DAILY_HOUR_MAX, DEFAULT_DAILY.startHour),
            )
          }
          onCommit={(startHour) => setDaily({ startHour })}
        />
        <NumberField
          label={t("editor.config.dailyEndHour")}
          value={body.endHour}
          min={0}
          max={DAILY_HOUR_MAX}
          step={1}
          clamp={(value) =>
            Math.round(
              clampNumber(value, 0, DAILY_HOUR_MAX, DEFAULT_DAILY.endHour),
            )
          }
          onCommit={(endHour) => setDaily({ endHour })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField
          label={t("editor.config.lineWidthPt")}
          value={body.lineWidthPt}
          min={LINE_WIDTH_PT_MIN}
          max={LINE_WIDTH_PT_MAX}
          step={0.1}
          clamp={clampLineWidthPt}
          onCommit={(lineWidthPt) => setDaily({ lineWidthPt })}
        />
        <NumberField
          label={t("editor.config.dailyLabelSize")}
          value={body.labelSizePt}
          min={DAILY_LABEL_SIZE_PT_MIN}
          max={DAILY_LABEL_SIZE_PT_MAX}
          step={0.2}
          clamp={(value) =>
            clampNumber(
              value,
              DAILY_LABEL_SIZE_PT_MIN,
              DAILY_LABEL_SIZE_PT_MAX,
              DEFAULT_DAILY.labelSizePt,
            )
          }
          onCommit={(labelSizePt) => setDaily({ labelSizePt })}
        />
        <ColorField
          label={t("editor.config.dailyLineColor")}
          value={body.lineColor}
          onChange={(lineColor) => setDaily({ lineColor })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t("editor.config.dailyTitleFormat")}
          value={body.titleFormat}
          hint={t("editor.config.octanFormatHint")}
          maxLength={TEXT_MAX}
          clamp={(text) =>
            isValidDateFormat(text) ? text : DEFAULT_DAILY.titleFormat
          }
          onCommit={(titleFormat) => setDaily({ titleFormat })}
        />
        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            {t("editor.config.octanWeekdayLang")}
          </legend>
          <select
            className="select w-full"
            value={body.weekdayLang}
            onChange={(e) =>
              setDaily({
                weekdayLang: e.target.value as DailyPattern["weekdayLang"],
              })
            }
          >
            <option value="zh">{t("editor.config.octanLangZh")}</option>
            <option value="en">{t("editor.config.octanLangEn")}</option>
            <option value="ja">{t("editor.config.octanLangJa")}</option>
          </select>
        </fieldset>
      </div>

      <div className="divider my-0" />

      <label className="label cursor-pointer justify-start gap-3">
        <input
          type="checkbox"
          className="toggle"
          checked={sun !== null}
          onChange={(e) =>
            setDaily({
              sun: e.target.checked ? { ...DEFAULT_DAILY_SUN } : null,
            })
          }
        />
        <span className="font-medium">{t("editor.config.dailySun")}</span>
      </label>
      <p className="label">{t("editor.config.dailySunHint")}</p>

      {sun && (
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label={t("editor.config.dailyLatitude")}
            value={sun.latitude}
            min={DAILY_LATITUDE_MIN}
            max={DAILY_LATITUDE_MAX}
            step={0.01}
            clamp={(value) =>
              clampNumber(
                value,
                DAILY_LATITUDE_MIN,
                DAILY_LATITUDE_MAX,
                DEFAULT_DAILY_SUN.latitude,
              )
            }
            onCommit={(latitude) => setDaily({ sun: { ...sun, latitude } })}
          />
          <NumberField
            label={t("editor.config.dailyLongitude")}
            value={sun.longitude}
            min={DAILY_LONGITUDE_MIN}
            max={DAILY_LONGITUDE_MAX}
            step={0.01}
            clamp={(value) =>
              clampNumber(
                value,
                DAILY_LONGITUDE_MIN,
                DAILY_LONGITUDE_MAX,
                DEFAULT_DAILY_SUN.longitude,
              )
            }
            onCommit={(longitude) => setDaily({ sun: { ...sun, longitude } })}
          />
          <NumberField
            label={t("editor.config.dailyUtcOffset")}
            value={sun.utcOffsetHours}
            min={DAILY_UTC_OFFSET_HOURS_MIN}
            max={DAILY_UTC_OFFSET_HOURS_MAX}
            step={0.5}
            clamp={(value) =>
              clampNumber(
                value,
                DAILY_UTC_OFFSET_HOURS_MIN,
                DAILY_UTC_OFFSET_HOURS_MAX,
                DEFAULT_DAILY_SUN.utcOffsetHours,
              )
            }
            onCommit={(utcOffsetHours) =>
              setDaily({ sun: { ...sun, utcOffsetHours } })
            }
          />
          <ColorField
            label={t("editor.config.dailyDaylightColor")}
            value={sun.daylightColor}
            onChange={(daylightColor) =>
              setDaily({ sun: { ...sun, daylightColor } })
            }
          />
          <ColorField
            label={t("editor.config.dailyNightColor")}
            value={sun.nightColor}
            onChange={(nightColor) => setDaily({ sun: { ...sun, nightColor } })}
          />
        </div>
      )}
    </div>
  );
});
