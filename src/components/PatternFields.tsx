import { useMemo } from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { Section, Values } from "../lib/schema";
import {
  DATE_LOCALE_OPTIONS, LINE_STYLE_OPTIONS, WEEKDAY_LANG_OPTIONS,
} from "../lib/schema";
import { toDecimal } from "../lib/utils";
import { Field, SelectField, WeekdayHeaderField } from "./controls";

type Props = { section: Section; set: (key: string, value: Values[keyof Values]) => void };

// 响应式双列网格；full 项横跨两列。
function Grid({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
        gap: 2,
        alignItems: "start",
      }}
    >
      {children}
    </Box>
  );
}



export function PatternFields({ section, set }: Props) {
  const { t } = useTranslation();
  const p = section.pattern;

  // 日期格式等 strftime 样例属于发给后端的内容格式，不随界面语言翻译。
  const tzOptions = useMemo<[string, string][]>(
    () => [
      ...Array.from({ length: 12 }, (_, i) => [`Etc/GMT-${12 - i}`, t("tz.east", { n: 12 - i })] as [string, string]),
      ["Etc/GMT", t("tz.zero")],
      ...Array.from({ length: 12 }, (_, i) => [`Etc/GMT+${i + 1}`, t("tz.west", { n: i + 1 })] as [string, string]),
    ],
    [t],
  );

  if (p.kind === "ruled")
    return (
      <Grid>
        <Field label={t("field.pages")} value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label={t("field.spacing")} value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label={t("field.lineWidth")} value={p.width} min={0.01} step={0.05} onChange={(v) => set("width", v)} />
        <Field label={t("field.color")} value={p.color} type="color" onChange={(v) => set("color", v)} />
      </Grid>
    );

  if (p.kind === "dots")
    return (
      <Grid>
        <Field label={t("field.pages")} value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label={t("field.spacing")} value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label={t("field.columnSpacing")} value={p.column_spacing} min={0.1} step={0.1} onChange={(v) => set("column_spacing", v)} />
        <Field label={t("field.dotSize")} value={p.radius} min={0.01} step={0.05} onChange={(v) => set("radius", v)} />
        <Field label={t("field.color")} value={p.color} type="color" onChange={(v) => set("color", v)} />
        <Field label={t("field.centerColor")} value={p.center_color} type="color" onChange={(v) => set("center_color", v)} />
      </Grid>
    );

  if (p.kind === "grid")
    return (
      <Grid>
        <Field label={t("field.pages")} value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label={t("field.gap")} value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label={t("field.lineWidth")} value={p.width} min={0.01} step={0.05} onChange={(v) => set("width", v)} />
        <Field label={t("field.color")} value={p.color} type="color" onChange={(v) => set("color", v)} />
      </Grid>
    );

  if (p.kind === "seyes")
    return (
      <Grid>
        <Field label={t("field.pages")} value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label={t("field.cellSpacing")} value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label={t("field.redLineIndex")} value={p.margin_line} min={0} step={1} onChange={(v) => set("margin_line", v)} />
        <Field label={t("field.mainColor")} value={p.main_color} type="color" onChange={(v) => set("main_color", v)} />
        <Field label={t("field.fineColor")} value={p.fine_color} type="color" onChange={(v) => set("fine_color", v)} />
        <Field label={t("field.vlineColor")} value={p.vline_color} type="color" onChange={(v) => set("vline_color", v)} />
        <Field label={t("field.edgeColor")} value={p.margin_color} type="color" onChange={(v) => set("margin_color", v)} />
      </Grid>
    );

  if (p.kind === "vertical")
    return (
      <Grid>
        <Field label={t("field.pages")} value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label={t("field.columnSpacing")} value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label={t("field.color")} value={p.color} type="color" onChange={(v) => set("color", v)} />
        <Field label={t("field.frameOuter")} value={p.frame_outer_width} min={0.01} step={0.05} onChange={(v) => set("frame_outer_width", v)} />
        <Field label={t("field.frameInner")} value={p.frame_inner_width} min={0.01} step={0.05} onChange={(v) => set("frame_inner_width", v)} />
        <Field label={t("field.frameGap")} value={p.frame_gap} min={0.1} step={0.1} onChange={(v) => set("frame_gap", v)} />
      </Grid>
    );

  if (p.kind === "us-ruled")
    return (
      <Grid>
        <Field label={t("field.pages")} value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label={t("field.spacing")} value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label={t("field.lineWidth")} value={p.rule_width} min={0.01} step={0.05} onChange={(v) => set("rule_width", v)} />
        <Field label={t("field.ruleColor")} value={p.rule_color} type="color" onChange={(v) => set("rule_color", v)} />
        <Field label={t("field.redLineX")} value={p.margin_x} min={0} step={0.5} onChange={(v) => set("margin_x", v)} />
        <Field label={t("field.redLineWidth")} value={p.margin_width} min={0.01} step={0.05} onChange={(v) => set("margin_width", v)} />
        <Field label={t("field.redLineColor")} value={p.margin_color} type="color" onChange={(v) => set("margin_color", v)} />
      </Grid>
    );

  if (p.kind === "hakubunkan-toyo-nikki")
    return (
      <Grid>
        <Field label={t("field.startDate")} value={p.start_date} type="date" onChange={(v) => set("start_date", v)} />
        <Field label={t("field.endDate")} value={p.end_date} type="date" onChange={(v) => set("end_date", v)} />
        <Field label={t("field.dateFormat")} value={p.date_format} type="text" placeholder="%-m月%-d日" onChange={(v) => set("date_format", v)} />
        <Field label={t("field.lineColor")} value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label={t("field.lineWidthPt")} value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
      </Grid>
    );

  if (p.kind === "方眼罫")
    return (
      <Grid>
        <Field label={t("field.lineColor")} value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
      </Grid>
    );

  if (p.kind === "八分周视图")
    return (
      <Grid>
        <Field label={t("field.startDate")} value={p.start_date} type="date" onChange={(v) => set("start_date", v)} />
        <Field label={t("field.endDate")} value={p.end_date} type="date" onChange={(v) => set("end_date", v)} />
        <Field label={t("field.dateFormat")} value={p.date_format} type="text" placeholder={t("field.dateFormatHint")} onChange={(v) => set("date_format", v)} />
        <SelectField label={t("field.language")} value={p.date_locale} options={DATE_LOCALE_OPTIONS} onChange={(v) => set("date_locale", v)} />
        <Field label={t("field.lineColor")} value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label={t("field.textColor")} value={p.text_color} type="color" onChange={(v) => set("text_color", v)} />
        <Field label={t("field.holidayColor")} value={p.holiday_color} type="color" onChange={(v) => set("holiday_color", v)} />
        <Field label={t("field.phaseColor")} value={p.phase_color} type="color" onChange={(v) => set("phase_color", v)} />
        <Field label={t("field.lineWidthPt")} value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
        <SelectField label={t("field.lineStyle")} value={p.line_style} options={LINE_STYLE_OPTIONS.map(([v, k]) => [v, t(k)] as [string, string])} onChange={(v) => set("line_style", v)} />
        <Field label={t("field.centerGap")} value={p.center_gap} min={0} step={0.5} onChange={(v) => set("center_gap", v)} />
        <Field label={t("field.dateSize")} value={p.date_size} min={1} step={0.5} onChange={(v) => set("date_size", v)} />
        <SelectField label={t("field.weekdayLang")} value={p.weekday_lang} options={WEEKDAY_LANG_OPTIONS} onChange={(v) => set("weekday_lang", v)} />
        <WeekdayHeaderField value={String(p.weekday_headers ?? "")} onChange={(v) => set("weekday_headers", v)} />
        <Field label={t("field.monthTitleFormat")} value={p.title_format} type="text" placeholder="%Y年%-m月" onChange={(v) => set("title_format", v)} />
      </Grid>
    );

  if (p.kind === "hakubunkan-kaichu-nikki")
    return (
      <Grid>
        <Field label={t("field.startDate")} value={p.start_date} type="date" onChange={(v) => set("start_date", v)} />
        <Field label={t("field.endDate")} value={p.end_date} type="date" onChange={(v) => set("end_date", v)} />
        <Field label={t("field.dateFormat")} value={p.date_format} type="text" placeholder="%-m 月  %-d 日" onChange={(v) => set("date_format", v)} />
        <SelectField label={t("field.language")} value={p.date_locale} options={DATE_LOCALE_OPTIONS} onChange={(v) => set("date_locale", v)} />
        <WeekdayHeaderField value={String(p.weekday_headers ?? "")} onChange={(v) => set("weekday_headers", v)} />
        <SelectField label={t("field.lunarFormat")} value={p.lunar_style} options={[["numeric", t("lunarStyle.numeric")], ["traditional", t("lunarStyle.traditional")]]} onChange={(v) => set("lunar_style", v)} />
        <Field label={t("field.lineColor")} value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label={t("field.lineWidthPt")} value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
        <Field label={t("field.dateSize")} value={p.date_size} min={1} step={0.5} onChange={(v) => set("date_size", v)} />
      </Grid>
    );

  if (p.kind === "year-calendar")
    return (
      <Grid>
        <Field label={t("field.startMonth")} value={p.start} type="month" onChange={(v) => set("start", v)} />
        <Field label={t("field.endMonth")} value={p.end} type="month" onChange={(v) => set("end", v)} />
        <Field label={t("field.rows")} value={p.rows} min={1} max={12} onChange={(v) => set("rows", v)} />
        <Field label={t("field.cols")} value={p.cols} min={1} max={12} onChange={(v) => set("cols", v)} />
        <Field label={t("field.dateSize")} value={p.date_size} min={1} step={0.5} onChange={(v) => set("date_size", v)} />
        <Field label={t("field.textColor")} value={p.text_color} type="color" onChange={(v) => set("text_color", v)} />
        <Field label={t("field.holidayColor")} value={p.holiday_color} type="color" onChange={(v) => set("holiday_color", v)} />
        <WeekdayHeaderField value={String(p.weekday_headers ?? "")} onChange={(v) => set("weekday_headers", v)} />
        <Field label={t("field.monthTitleFormat")} value={p.title_format} type="text" placeholder="%Y年%-m月" onChange={(v) => set("title_format", v)} />
        <Field label={t("field.showHolidays")} value={Boolean(p.show_holidays ?? true)} type="checkbox" onChange={(v) => set("show_holidays", Boolean(v))} />
        <Field label={t("field.showLunar")} value={Boolean(p.lunar)} type="checkbox" onChange={(v) => set("lunar", Boolean(v))} />
      </Grid>
    );

  if (p.kind === "month-calendar")
    return (
      <Grid>
        <Field label={t("field.year")} value={p.year} min={1900} max={2100} onChange={(v) => set("year", v)} />
        <Field label={t("field.month")} value={p.month} min={1} max={12} onChange={(v) => set("month", v)} />
        <Field label={t("field.phaseColor")} value={p.phase_color} type="color" onChange={(v) => set("phase_color", v)} />
        <Field label={t("field.lineColor")} value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label={t("field.holidayColor")} value={p.holiday_color} type="color" onChange={(v) => set("holiday_color", v)} />
        <Field label={t("field.lineWidthPt")} value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
        <Field label={t("field.dateSize")} value={p.date_size} min={1} step={0.5} onChange={(v) => set("date_size", v)} />
        <WeekdayHeaderField value={String(p.weekday_headers ?? "")} onChange={(v) => set("weekday_headers", v)} />
        <Field label={t("field.twoPageWeekSplit")} value={p.two_page} type="checkbox" onChange={(v) => set("two_page", v)} />
        <Field label={t("field.titleFormat")} value={p.title_format} type="text" placeholder="%Y年%-m月" onChange={(v) => set("title_format", v)} />
        <Field label={t("field.showHolidays")} value={Boolean(p.show_holidays ?? true)} type="checkbox" onChange={(v) => set("show_holidays", Boolean(v))} />
        <Field label={t("field.showLunar")} value={Boolean(p.lunar)} type="checkbox" onChange={(v) => set("lunar", Boolean(v))} />
        <Field label={t("field.subSize")} value={p.sub_size} min={1} step={0.5} onChange={(v) => set("sub_size", v)} />
        <Field label={t("field.subGap")} value={p.sub_gap} step={0.1} onChange={(v) => set("sub_gap", v)} />
      </Grid>
    );

  if (p.kind === "month-tracker")
    return (
      <Grid>
        <Field label={t("field.year")} value={p.year} min={1900} max={2100} onChange={(v) => set("year", v)} />
        <Field label={t("field.month")} value={p.month} min={1} max={12} onChange={(v) => set("month", v)} />
        <Field label={t("field.trackerItems")} value={p.items} min={1} max={30} onChange={(v) => set("items", v)} />
        <Field label={t("field.lineColor")} value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label={t("field.lineWidthPt")} value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
        <Field label={t("field.dateSize")} value={p.date_size} min={1} step={0.5} onChange={(v) => set("date_size", v)} />
      </Grid>
    );

  if (p.kind === "year-tracker")
    return (
      <Grid>
        <Field label={t("field.startMonth")} value={p.start} type="month" onChange={(v) => set("start", v)} />
        <Field label={t("field.endMonth")} value={p.end} type="month" onChange={(v) => set("end", v)} />
        <Field label={t("field.twoPageHalfMonth")} value={p.two_page} type="checkbox" onChange={(v) => set("two_page", Boolean(v))} />
        <Field label={t("field.lineColor")} value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label={t("field.lineWidthPt")} value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
        <Field label={t("field.dateSize")} value={p.date_size} min={1} step={0.5} onChange={(v) => set("date_size", v)} />
      </Grid>
    );

  if (p.kind === "blank")
    return (
      <Grid>
        <Field label={t("field.pages")} value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
      </Grid>
    );

  // timeline
  return (
    <Grid>
      <Field label={t("field.startHour")} value={p.start} min={0} max={23} onChange={(v) => set("start", v)} />
      <Field label={t("field.endHour")} value={p.end} min={1} max={24} onChange={(v) => set("end", v)} />
      <SelectField
        label={t("field.span")}
        value={p.pages}
        options={[[1, t("spanOption.single")], [2, t("spanOption.spread")]]}
        onChange={(v) => set("pages", Number(v))}
      />
      <Field label={t("field.startDate")} value={p.start_date} type="date" onChange={(v) => set("start_date", v || "")} />
      <Field label={t("field.endDate")} value={p.end_date} type="date" onChange={(v) => set("end_date", v || "")} />
      <Field label={t("field.titleFormat")} value={p.title_format} type="text" placeholder="[ %a. %m/%d ]" onChange={(v) => set("title_format", v)} />
      <Field label={t("field.lineColor")} value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
      <Field label={t("field.lineWidthBare")} value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
      <Field label={t("field.labelSize")} value={p.label_size} min={1} step={0.1} onChange={(v) => set("label_size", v)} />
      <Field
        label={t("field.latitude")}
        value={p.latitude}
        type="text"
        placeholder={t("field.latitudeHint")}
        onChange={(v) => set("latitude", toDecimal(String(v)) ?? v)}
      />
      <Field
        label={t("field.longitude")}
        value={p.longitude}
        type="text"
        placeholder={t("field.longitudeHint")}
        onChange={(v) => set("longitude", toDecimal(String(v)) ?? v)}
      />
      <SelectField label={t("field.timezone")} value={String(p.timezone ?? "")} options={tzOptions} onChange={(v) => set("timezone", v)} />
      <Field label={t("field.daylightColor")} value={p.daylight_color} type="color" onChange={(v) => set("daylight_color", v)} />
      <Field label={t("field.nightColor")} value={p.night_color} type="color" onChange={(v) => set("night_color", v)} />
    </Grid>
  );
}
