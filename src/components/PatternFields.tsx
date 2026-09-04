import { Box } from "@mui/material";
import type { Section, Values } from "../lib/schema";
import {
  DATE_LOCALE_OPTIONS, LINE_STYLE_OPTIONS, TZ_OPTIONS, WEEKDAY_LANG_OPTIONS,
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
  const p = section.pattern;

  if (p.kind === "ruled")
    return (
      <Grid>
        <Field label="页数" value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label="行距（mm）" value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label="线宽（mm）" value={p.width} min={0.01} step={0.05} onChange={(v) => set("width", v)} />
        <Field label="颜色" value={p.color} type="color" onChange={(v) => set("color", v)} />
      </Grid>
    );

  if (p.kind === "dots")
    return (
      <Grid>
        <Field label="页数" value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label="行距（mm）" value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label="列距（mm）" value={p.column_spacing} min={0.1} step={0.1} onChange={(v) => set("column_spacing", v)} />
        <Field label="点径（mm）" value={p.radius} min={0.01} step={0.05} onChange={(v) => set("radius", v)} />
        <Field label="颜色" value={p.color} type="color" onChange={(v) => set("color", v)} />
        <Field label="中心点颜色" value={p.center_color} type="color" onChange={(v) => set("center_color", v)} />
      </Grid>
    );

  if (p.kind === "grid")
    return (
      <Grid>
        <Field label="页数" value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label="间距（mm）" value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label="线宽（mm）" value={p.width} min={0.01} step={0.05} onChange={(v) => set("width", v)} />
        <Field label="颜色" value={p.color} type="color" onChange={(v) => set("color", v)} />
      </Grid>
    );

  if (p.kind === "seyes")
    return (
      <Grid>
        <Field label="页数" value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label="格距（mm）" value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label="红线（第几根竖线，0 为无）" value={p.margin_line} min={0} step={1} onChange={(v) => set("margin_line", v)} />
        <Field label="主线色" value={p.main_color} type="color" onChange={(v) => set("main_color", v)} />
        <Field label="细线色" value={p.fine_color} type="color" onChange={(v) => set("fine_color", v)} />
        <Field label="竖线色" value={p.vline_color} type="color" onChange={(v) => set("vline_color", v)} />
        <Field label="边线色" value={p.margin_color} type="color" onChange={(v) => set("margin_color", v)} />
      </Grid>
    );

  if (p.kind === "vertical")
    return (
      <Grid>
        <Field label="页数" value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label="列距（mm）" value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label="颜色" value={p.color} type="color" onChange={(v) => set("color", v)} />
        <Field label="外框宽（mm）" value={p.frame_outer_width} min={0.01} step={0.05} onChange={(v) => set("frame_outer_width", v)} />
        <Field label="内框宽（mm）" value={p.frame_inner_width} min={0.01} step={0.05} onChange={(v) => set("frame_inner_width", v)} />
        <Field label="框间距（mm）" value={p.frame_gap} min={0.1} step={0.1} onChange={(v) => set("frame_gap", v)} />
      </Grid>
    );

  if (p.kind === "us-ruled")
    return (
      <Grid>
        <Field label="页数" value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label="行距（mm）" value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label="线宽（mm）" value={p.rule_width} min={0.01} step={0.05} onChange={(v) => set("rule_width", v)} />
        <Field label="线色" value={p.rule_color} type="color" onChange={(v) => set("rule_color", v)} />
        <Field label="红线位置（mm）" value={p.margin_x} min={0} step={0.5} onChange={(v) => set("margin_x", v)} />
        <Field label="红线宽（mm）" value={p.margin_width} min={0.01} step={0.05} onChange={(v) => set("margin_width", v)} />
        <Field label="红线色" value={p.margin_color} type="color" onChange={(v) => set("margin_color", v)} />
      </Grid>
    );

  if (p.kind === "hakubunkan-toyo-nikki")
    return (
      <Grid>
        <Field label="开始日期" value={p.start_date} type="date" onChange={(v) => set("start_date", v)} />
        <Field label="结束日期" value={p.end_date} type="date" onChange={(v) => set("end_date", v)} />
        <Field label="日期格式" value={p.date_format} type="text" placeholder="%-m月%-d日" onChange={(v) => set("date_format", v)} />
        <Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label="线宽（pt）" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
      </Grid>
    );

  if (p.kind === "midori")
    return (
      <Grid>
        <Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
      </Grid>
    );

  if (p.kind === "八分周视图")
    return (
      <Grid>
        <Field label="开始日期" value={p.start_date} type="date" onChange={(v) => set("start_date", v)} />
        <Field label="结束日期" value={p.end_date} type="date" onChange={(v) => set("end_date", v)} />
        <Field label="日期格式" value={p.date_format} type="text" placeholder="例如：%-d、%m/%d、%a %cccc（农历）" onChange={(v) => set("date_format", v)} />
        <SelectField label="语言" value={p.date_locale} options={DATE_LOCALE_OPTIONS} onChange={(v) => set("date_locale", v)} />
        <Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label="线宽（pt）" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
        <SelectField label="线样式" value={p.line_style} options={LINE_STYLE_OPTIONS} onChange={(v) => set("line_style", v)} />
        <Field label="中心点间距（mm）" value={p.center_gap} min={0} step={0.5} onChange={(v) => set("center_gap", v)} />
        <Field label="日期字号（pt）" value={p.date_size} min={1} step={0.5} onChange={(v) => set("date_size", v)} />
        <SelectField label="表头语言" value={p.weekday_lang} options={WEEKDAY_LANG_OPTIONS} onChange={(v) => set("weekday_lang", v)} />
        <WeekdayHeaderField value={String(p.weekday_headers ?? "")} onChange={(v) => set("weekday_headers", v)} />
        <Field label="月历标题格式" value={p.title_format} type="text" placeholder="%Y.%m" onChange={(v) => set("title_format", v)} />
      </Grid>
    );

  if (p.kind === "hakubunkan-kaichu-nikki")
    return (
      <Grid>
        <Field label="开始日期" value={p.start_date} type="date" onChange={(v) => set("start_date", v)} />
        <Field label="结束日期" value={p.end_date} type="date" onChange={(v) => set("end_date", v)} />
        <Field label="日期格式" value={p.date_format} type="text" placeholder="%-m 月  %-d 日" onChange={(v) => set("date_format", v)} />
        <SelectField label="语言" value={p.date_locale} options={DATE_LOCALE_OPTIONS} onChange={(v) => set("date_locale", v)} />
        <WeekdayHeaderField value={String(p.weekday_headers ?? "")} onChange={(v) => set("weekday_headers", v)} />
        <SelectField label="农历格式" value={p.lunar_style} options={[["numeric", "旧 + 阿拉伯数字"], ["traditional", "传统农历表述"]]} onChange={(v) => set("lunar_style", v)} />
        <Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label="线宽（pt）" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
        <Field label="日期字号（pt）" value={p.date_size} min={1} step={0.5} onChange={(v) => set("date_size", v)} />
      </Grid>
    );

  if (p.kind === "year")
    return (
      <Grid>
        <Field label="开始月份" value={p.start} type="month" onChange={(v) => set("start", v)} />
        <Field label="结束月份" value={p.end} type="month" onChange={(v) => set("end", v)} />
        <Field label="行数" value={p.rows} min={1} max={12} onChange={(v) => set("rows", v)} />
        <Field label="列数" value={p.cols} min={1} max={12} onChange={(v) => set("cols", v)} />
        <Field label="日期字号（pt）" value={p.date_size} min={1} step={0.5} onChange={(v) => set("date_size", v)} />
        <WeekdayHeaderField value={String(p.weekday_headers ?? "")} onChange={(v) => set("weekday_headers", v)} />
        <Field label="月历标题格式" value={p.title_format} type="text" placeholder="%Y.%m" onChange={(v) => set("title_format", v)} />
        <Field label="显示节假日" value={Boolean(p.show_holidays ?? true)} type="checkbox" onChange={(v) => set("show_holidays", Boolean(v))} />
        <Field label="显示农历" value={Boolean(p.lunar)} type="checkbox" onChange={(v) => set("lunar", Boolean(v))} />
      </Grid>
    );

  if (p.kind === "month")
    return (
      <Grid>
        <Field label="年" value={p.year} min={1900} max={2100} onChange={(v) => set("year", v)} />
        <Field label="月" value={p.month} min={1} max={12} onChange={(v) => set("month", v)} />
        <Field label="月相颜色" value={p.phase_color} type="color" onChange={(v) => set("phase_color", v)} />
        <Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label="线宽（pt）" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
        <Field label="日期字号（pt）" value={p.date_size} min={1} step={0.5} onChange={(v) => set("date_size", v)} />
        <WeekdayHeaderField value={String(p.weekday_headers ?? "")} onChange={(v) => set("weekday_headers", v)} />
        <Field label="双页（周一~三 / 周四~日）" value={p.two_page} type="checkbox" onChange={(v) => set("two_page", v)} />
        <Field label="标题格式" value={p.title_format} type="text" placeholder="%Y年%-m月" onChange={(v) => set("title_format", v)} />
        <Field label="显示节假日" value={Boolean(p.show_holidays ?? true)} type="checkbox" onChange={(v) => set("show_holidays", Boolean(v))} />
        <Field label="显示农历" value={Boolean(p.lunar)} type="checkbox" onChange={(v) => set("lunar", Boolean(v))} />
        <Field label="农历/节日字号（pt）" value={p.sub_size} min={1} step={0.5} onChange={(v) => set("sub_size", v)} />
        <Field label="标签间隔（mm）" value={p.sub_gap} step={0.1} onChange={(v) => set("sub_gap", v)} />
      </Grid>
    );

  if (p.kind === "tracker")
    return (
      <Grid>
        <Field label="年" value={p.year} min={1900} max={2100} onChange={(v) => set("year", v)} />
        <Field label="月" value={p.month} min={1} max={12} onChange={(v) => set("month", v)} />
        <Field label="打卡项数" value={p.items} min={1} max={30} onChange={(v) => set("items", v)} />
        <Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label="线宽（pt）" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
        <Field label="日期字号（pt）" value={p.date_size} min={1} step={0.5} onChange={(v) => set("date_size", v)} />
      </Grid>
    );

  if (p.kind === "month-tracker")
    return (
      <Grid>
        <Field label="开始月份" value={p.start} type="month" onChange={(v) => set("start", v)} />
        <Field label="结束月份" value={p.end} type="month" onChange={(v) => set("end", v)} />
        <Field label="双页（1–14 日 / 15–31 日，格子同大）" value={p.two_page} type="checkbox" onChange={(v) => set("two_page", Boolean(v))} />
        <Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label="线宽（pt）" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
        <Field label="日期字号（pt）" value={p.date_size} min={1} step={0.5} onChange={(v) => set("date_size", v)} />
      </Grid>
    );

  if (p.kind === "graph")
    return (
      <Grid>
        <SelectField
          label="数字位置"
          value={p.axis}
          options={[
            ["right", "右侧（逆时针转 90° 阅读）"],
            ["left", "左侧（顺时针转 90° 阅读）"],
          ]}
          onChange={(v) => set("axis", v)}
        />
        <Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label="细线宽（pt，粗线为两倍）" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
        <Field label="轴标签字号（pt）" value={p.date_size} min={1} step={0.5} onChange={(v) => set("date_size", v)} />
        <Field label="纵轴下界" value={p.y_min ?? ""} placeholder="留空不绘" onChange={(v) => set("y_min", v)} />
        <Field label="纵轴上界" value={p.y_max ?? ""} placeholder="留空不绘" onChange={(v) => set("y_max", v)} />
        <Field label="纵轴刻度段数" value={p.y_steps} min={1} step={1} onChange={(v) => set("y_steps", v)} />
      </Grid>
    );

  if (p.kind === "blank")
    return (
      <Grid>
        <Field label="页数" value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
      </Grid>
    );

  // timeline
  return (
    <Grid>
      <Field label="起始时间" value={p.start} min={0} max={23} onChange={(v) => set("start", v)} />
      <Field label="结束时间" value={p.end} min={1} max={24} onChange={(v) => set("end", v)} />
      <SelectField
        label="跨页"
        value={p.pages}
        options={[
          [1, "单页"],
          [2, "左右双页"],
        ]}
        onChange={(v) => set("pages", Number(v))}
      />
      <Field label="开始日期" value={p.start_date} type="date" onChange={(v) => set("start_date", v || "")} />
      <Field label="结束日期" value={p.end_date} type="date" onChange={(v) => set("end_date", v || "")} />
      <Field label="标题格式" value={p.title_format} type="text" placeholder="%Y年%-m月%-d日" onChange={(v) => set("title_format", v)} />
      <Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
      <Field label="线宽" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
      <Field label="标签字号（pt）" value={p.label_size} min={1} step={0.1} onChange={(v) => set("label_size", v)} />
      <Field
        label="纬度（留空不绘制日照）"
        value={p.latitude}
        type="text"
        placeholder="如 30°15′N 或 30.25"
        onChange={(v) => set("latitude", toDecimal(String(v)) ?? v)}
      />
      <Field
        label="经度"
        value={p.longitude}
        type="text"
        placeholder="如 120°12′E 或 120.2"
        onChange={(v) => set("longitude", toDecimal(String(v)) ?? v)}
      />
      <SelectField label="时区" value={String(p.timezone ?? "")} options={TZ_OPTIONS} onChange={(v) => set("timezone", v)} />
      <Field label="日照颜色" value={p.daylight_color} type="color" onChange={(v) => set("daylight_color", v)} />
      <Field label="夜间颜色" value={p.night_color} type="color" onChange={(v) => set("night_color", v)} />
    </Grid>
  );
}
