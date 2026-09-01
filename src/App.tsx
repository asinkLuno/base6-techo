import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { ChevronDown, ChevronUp, Download, Eye, FileDown, GripVertical, Plus, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { RenderSectionRequest, RunPipelineRequest } from "./pipeline-request.generated";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Checkbox } from "./components/ui/checkbox";
import { Input } from "./components/ui/input";
import { Calendar } from "./components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { zhCN } from "react-day-picker/locale";
import { Select as SelectRoot, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { ColorPicker } from "./components/ui/color-picker";
import { cn } from "./lib/utils";
import { parseICS } from "./lib/ics-parser";

type Value = string | number | boolean | null;
type Values = Record<string, Value>;
type PatternKind = "bunkwan" | "dots" | "eight" | "graph" | "grid" | "midori" | "month" | "ruled" | "timeline" | "seyes" | "tracker" | "us-ruled" | "vertical" | "year";
type Section = {
  id: string;
  expanded: boolean;
  headerEnabled: boolean;
  headerMode: "text" | "number";
  footerEnabled: boolean;
  footerMode: "text" | "number";
  pageNumber: boolean;
  watermarkEnabled: boolean;
  page: Values;
  document: Values;
  pattern: Values & { kind: PatternKind };
  nonBindingEnabled: boolean;
};

const patternNames: Record<PatternKind, string> = {
  dots: "点阵",
  grid: "网格",
  ruled: "横线",
  seyes: "法文格",
  vertical: "古文竖排",
  "us-ruled": "美式横线",
  bunkwan: "博文馆当用日历",
  eight: "八分视图",
  graph: "制图网格",
  midori: "Midori",
  month: "月历",
  timeline: "时间轴",
  tracker: "月打卡",
  year: "年历",
};


// 默认颜色，须与后端 src-tauri/src/backend/colors.rs 一一对应。
const COLORS = {
  gray: "#7a7a7a",
  phaseGold: "#e5b93f",
  timelineNight: "#496a9f",
  holidayRed: "#b83b38",
  bunkwanGreen: "#31584a",
  bunkwanFaint: "#82968e",
  midoriGreen: "#a9d1ae",
};
const PAGE_SIZES: Record<string, [number, number]> = {
  A4: [210, 297],
  "A5S/TN 标准": [110, 210],
  "TN护照": [88, 125],
  A5: [148, 210],
  A6: [105, 148],
  A6FC: [108, 171],
  A6Personal: [95, 171],
  A6PW: [120, 170],
  A6Slim: [80, 171],
  A7: [80, 120],
  "127A7": [80, 127],
  B5: [176, 250],
  B6: [125, 176],
  B6Slim: [98, 176],
  "74m5": [74, 105],
  "67m5": [67, 105],
  "62m5": [62, 105],
};

const PAGE_SIZE_OPTIONS: [string, string][] = [
  ...Object.entries(PAGE_SIZES).map(([k, [w, h]]) => [k, `${k}（${w} × ${h} mm）`] as [string, string]),
  ["custom", "自定义"],
];

const FONT_OPTIONS: [string, string][] = [
  [String.raw`\sffamily`, "无衬线（sans）"],
  [String.raw`\rmfamily`, "衬线（serif）"],
  [String.raw`\ttfamily`, "等宽（mono）"],
];
const LINE_STYLE_OPTIONS: [string, string][] = [["solid", "实线"], ["dashed", "虚线"], ["dotted", "点线"], ["dash-dot", "点虚线"], ["double-solid", "双实线"]];
const WEEKDAY_LANG_OPTIONS: [string, string][] = [["zh", "中文"], ["en", "English"], ["ja", "日本語"]];

const TZ_OPTIONS: [string, string][] = [...Array.from({ length: 12 }, (_, i) => [`Etc/GMT-${12 - i}`, `东${12 - i}区（UTC+${12 - i}）`] as [string, string]), ["Etc/GMT", "零时区（UTC）"], ...Array.from({ length: 12 }, (_, i) => [`Etc/GMT+${i + 1}`, `西${i + 1}区（UTC-${i + 1}）`] as [string, string])];

const currentMonday = new Date();
currentMonday.setDate(currentMonday.getDate() - ((currentMonday.getDay() + 6) % 7));
const currentSunday = new Date(currentMonday);
currentSunday.setDate(currentMonday.getDate() + 6);

const defaults: Record<PatternKind, Values & { kind: PatternKind }> = {
  ruled: {
    kind: "ruled",
    pages: 32,
    spacing: 8,
    color: COLORS.gray,
    width: 0.2,
  },
  dots: {
    kind: "dots",
    pages: 1,
    spacing: 5,
    column_spacing: 5,
    radius: 0.3,
    color: COLORS.gray,
  },
  grid: {
    kind: "grid",
    pages: 1,
    spacing: 5,
    color: COLORS.gray,
    width: 0.2,
  },
  seyes: {
    kind: "seyes",
    pages: 1,
    spacing: 8,
    margin_line: 7,
    main_color: "#9db0cf",
    main_width: 0.2,
    fine_color: "#c5d0e4",
    fine_width: 0.1,
    vline_color: "#c5d0e4",
    vline_width: 0.1,
    margin_color: "#d96a6a",
    margin_width: 0.4,
  },
  vertical: {
    kind: "vertical",
    pages: 1,
    spacing: 10,
    color: "#000000",
    frame_outer_width: 0.5,
    frame_inner_width: 0.18,
    frame_gap: 1.2,
  },
  "us-ruled": {
    kind: "us-ruled",
    pages: 1,
    spacing: 8.7,
    rule_color: "#8fb0d8",
    rule_width: 0.2,
    margin_x: 25,
    margin_color: "#d96a6a",
    margin_width: 0.4,
  },
  bunkwan: {
    kind: "bunkwan",
    line_color: COLORS.bunkwanGreen,
    faint_color: COLORS.bunkwanFaint,
    line_width: 0.4,
  },
  midori: {
    kind: "midori",
    spacing: 5,
    gap: 1,
    edge_extension: 1.2,
    dot_frequency: 10,
    dot_radius: 0.4,
    line_width: 0.7,
    line_color: COLORS.midoriGreen,
    dot_color: COLORS.midoriGreen,
    header: false,
    footer: false,
    inner: false,
    outer: false,
  },
  eight: {
    kind: "eight",
    start_date: toISODate(currentMonday),
    end_date: toISODate(currentSunday),
    date_format: "%-d",
    date_locale: "zh-CN",
    weekday_lang: "zh",
    line_color: COLORS.gray,
    line_width: 0.4,
    line_style: "solid",
    center_gap: 2,
    date_size: 10,
  },
  graph: {
    kind: "graph",
    axis: "right",
    line_color: COLORS.gray,
    line_width: 0.2,
    date_size: 8,
  },
  month: {
    kind: "month",
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    phase_color: COLORS.phaseGold,
    line_color: COLORS.gray,
    line_width: 0.4,
    date_size: 8,
    weekday_lang: "en",
    two_page: false,
  },
  tracker: {
    kind: "tracker",
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    items: 4,
    line_color: COLORS.gray,
    line_width: 0.4,
    date_size: 8,
  },
  year: {
    kind: "year",
    start: `${new Date().getFullYear()}-01`,
    end: `${new Date().getFullYear()}-12`,
    rows: 1,
    cols: 2,
    date_size: 6,
    weekday_lang: "zh",
  },
  timeline: {
    kind: "timeline",
    start: 0,
    end: 26,
    pages: 1,
    date: "",
    line_color: COLORS.gray,
    line_width: 1.138,
    label_size: 10.2,
    latitude: "",
    longitude: "",
    timezone: "Etc/GMT-8",
    daylight_color: COLORS.phaseGold,
    night_color: COLORS.timelineNight,
  },
};

function newSection(width = 148, height = 210): Section {
  return {
    id: crypto.randomUUID(),
    expanded: true,
    headerEnabled: false,
    headerMode: "text",
    footerEnabled: false,
    footerMode: "text",
    pageNumber: true,
    page: {
      width,
      height,
      header: 10,
      footer: 10,
      binding: 15,
      non_binding: 8,
    },
    document: {
      binding_text: "",
      binding_text_2: "",
      binding_text_size: 8,
      binding_text_2_size: 8,
      binding_text_spacing: 5,
      binding_text_edge: null,
      binding_text_color: COLORS.gray,
      header_text: "",
      header_text_2: "",
      header_text_size: 8,
      header_text_2_size: 8,
      header_text_spacing: 5,
      header_text_color: COLORS.gray,
      footer_text: "",
      footer_text_2: "",
      footer_text_size: 8,
      footer_text_2_size: 8,
      footer_text_spacing: 5,
      footer_text_color: COLORS.gray,
      non_binding_text: "",
      non_binding_text_2: "",
      non_binding_text_size: 8,
      non_binding_text_2_size: 8,
      non_binding_text_spacing: 5,
      non_binding_text_edge: null,
      non_binding_text_color: COLORS.gray,
    },
    watermarkEnabled: false,
    nonBindingEnabled: false,
    pattern: { ...defaults.ruled },
  };
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-sm text-muted-foreground">{children}</span>;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISODate(s: string): Date | undefined {
  const [y, m, d] = s.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}

function toDecimal(raw: string): number | null {
  const orig = raw.trim();
  if (!orig) return null;
  const parts = orig.replace(/[NSEWnsew]/g, "").split(/[°度′'’"″]/);
  if (parts.length === 1) {
    const v = Number(parts[0]);
    return Number.isFinite(v) ? v : null;
  }
  const [deg, min = "0", sec = "0"] = parts;
  const d = Number(deg),
    mi = Number(min),
    se = Number(sec);
  if (![d, mi, se].every(Number.isFinite)) return null;
  const negative = /[SWsw]/.test(orig) || /^-/.test(deg.trim());
  return (Math.abs(d) + mi / 60 + se / 3600) * (negative ? -1 : 1);
}

function Field({ label, value, type = "number", min, max, step, placeholder, onChange }: { label: string; value: Value; type?: string; min?: number; max?: number; step?: number; placeholder?: string; onChange: (value: Value) => void }) {
  const [dateOpen, setDateOpen] = useState(false);
  if (type === "date") {
    const date = parseISODate(String(value ?? ""));
    return (
      <div className="grid gap-1.5">
        <FieldLabel>{label}</FieldLabel>
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start font-normal", !value && "text-muted-foreground")}>
              {value ? String(value) : "选择日期"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              captionLayout="dropdown"
              locale={zhCN}
              selected={date}
              onSelect={(d) => {
                onChange(d ? toISODate(d) : "");
                setDateOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }
  if (type === "checkbox")
    return (
      <label className="flex cursor-pointer items-center gap-2 text-sm leading-none">
        <Checkbox checked={Boolean(value)} onCheckedChange={(checked) => onChange(Boolean(checked))} />
        {label}
      </label>
    );
  if (type === "color")
    return (
      <div className="grid gap-1.5">
        <FieldLabel>{label}</FieldLabel>
        <ColorPicker value={String(value)} onChange={(v) => onChange(v)} />
      </div>
    );
  return (
    <label className="grid gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Input type={type} value={String(value ?? "")} min={min} max={max} step={step} placeholder={placeholder} onChange={(event) => onChange(type === "number" ? Number(event.target.value) : event.target.value)} />
    </label>
  );
}
function Select({ label, value, options, onChange, disabledKeys }: { label: string; value: Value; options: [string | number, string][]; onChange: (value: string) => void; disabledKeys?: (string | number)[] }) {
  return (
    <div className="grid gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <SelectRoot value={String(value ?? "")} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([key, text]) => (
            <SelectItem key={key} value={String(key)} disabled={disabledKeys?.includes(key)}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </div>
  );
}
function Group({ title, enabled, onEnabled, children }: { title: string; enabled: boolean; onEnabled: (enabled: boolean) => void; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-lg border bg-background p-4 sm:col-span-2">
      <Field label={title} value={enabled} type="checkbox" onChange={(value) => onEnabled(Boolean(value))} />
      {enabled && <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">{children}</div>}
    </section>
  );
}

function TextFields({ values, prefix, set }: { values: Values; prefix: string; set: (key: string, value: Value) => void }) {
  return (
    <>
      <Field label="第一行文字" value={values[prefix]} type="text" onChange={(v) => set(prefix, v)} />
      {values[prefix] ? (
        <>
          <Field label="第一行字号（pt）" value={values[`${prefix}_size`]} min={1} step={0.5} onChange={(v) => set(`${prefix}_size`, v)} />
          <Field label="第二行文字" value={values[`${prefix}_2`]} type="text" onChange={(v) => set(`${prefix}_2`, v)} />
        </>
      ) : null}
      {values[prefix] && values[`${prefix}_2`] ? (
        <>
          <Field label="第二行字号（pt）" value={values[`${prefix}_2_size`]} min={1} step={0.5} onChange={(v) => set(`${prefix}_2_size`, v)} />
          <Field label="两行间距（mm）" value={values[`${prefix}_spacing`]} min={0} step={0.5} onChange={(v) => set(`${prefix}_spacing`, v)} />
        </>
      ) : null}
    </>
  );
}

function PatternFields({ section, set }: { section: Section; set: (key: string, value: Value) => void }) {
  const p = section.pattern;
  if (p.kind === "ruled")
    return (
      <>
        <Field label="页数" value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label="行距（mm）" value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label="线宽（mm）" value={p.width} min={0.01} step={0.05} onChange={(v) => set("width", v)} />
        <Field label="颜色" value={p.color} type="color" onChange={(v) => set("color", v)} />
      </>
    );
  if (p.kind === "dots")
    return (
      <>
        <Field label="页数" value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label="行距（mm）" value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label="列距（mm）" value={p.column_spacing} min={0.1} step={0.1} onChange={(v) => set("column_spacing", v)} />
        <Field label="点径（mm）" value={p.radius} min={0.01} step={0.05} onChange={(v) => set("radius", v)} />
        <Field label="颜色" value={p.color} type="color" onChange={(v) => set("color", v)} />
      </>
    );
  if (p.kind === "grid")
    return (
      <>
        <Field label="页数" value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label="间距（mm）" value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label="线宽（mm）" value={p.width} min={0.01} step={0.05} onChange={(v) => set("width", v)} />
        <Field label="颜色" value={p.color} type="color" onChange={(v) => set("color", v)} />
      </>
    );
  if (p.kind === "seyes")
    return (
      <>
        <Field label="页数" value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label="格距（mm）" value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label="红线（第几根竖线，0 为无）" value={p.margin_line} min={0} step={1} onChange={(v) => set("margin_line", v)} />
        <Field label="主线色" value={p.main_color} type="color" onChange={(v) => set("main_color", v)} />
        <Field label="细线色" value={p.fine_color} type="color" onChange={(v) => set("fine_color", v)} />
        <Field label="竖线色" value={p.vline_color} type="color" onChange={(v) => set("vline_color", v)} />
        <Field label="边线色" value={p.margin_color} type="color" onChange={(v) => set("margin_color", v)} />
      </>
    );
  if (p.kind === "vertical")
    return (
      <>
        <Field label="页数" value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label="列距（mm）" value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label="颜色" value={p.color} type="color" onChange={(v) => set("color", v)} />
        <Field label="外框宽（mm）" value={p.frame_outer_width} min={0.01} step={0.05} onChange={(v) => set("frame_outer_width", v)} />
        <Field label="内框宽（mm）" value={p.frame_inner_width} min={0.01} step={0.05} onChange={(v) => set("frame_inner_width", v)} />
        <Field label="框间距（mm）" value={p.frame_gap} min={0.1} step={0.1} onChange={(v) => set("frame_gap", v)} />
      </>
    );
  if (p.kind === "us-ruled")
    return (
      <>
        <Field label="页数" value={p.pages} min={1} max={500} onChange={(v) => set("pages", v)} />
        <Field label="行距（mm）" value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label="线宽（mm）" value={p.rule_width} min={0.01} step={0.05} onChange={(v) => set("rule_width", v)} />
        <Field label="线色" value={p.rule_color} type="color" onChange={(v) => set("rule_color", v)} />
        <Field label="红线位置（mm）" value={p.margin_x} min={0} step={0.5} onChange={(v) => set("margin_x", v)} />
        <Field label="红线宽（mm）" value={p.margin_width} min={0.01} step={0.05} onChange={(v) => set("margin_width", v)} />
        <Field label="红线色" value={p.margin_color} type="color" onChange={(v) => set("margin_color", v)} />
      </>
    );
  if (p.kind === "bunkwan")
    return (
      <>
        <Field label="主线颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label="点线颜色" value={p.faint_color} type="color" onChange={(v) => set("faint_color", v)} />
        <Field label="线宽（pt）" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
      </>
    );
  if (p.kind === "midori")
    return (
      <>
        <Field label="间距（mm）" value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} />
        <Field label="双线间隙（mm）" value={p.gap} min={0} step={0.1} onChange={(v) => set("gap", v)} />
        <Field label="边缘延伸（mm）" value={p.edge_extension} min={0} step={0.1} onChange={(v) => set("edge_extension", v)} />
        <Field label="圆点频率" value={p.dot_frequency} min={1} onChange={(v) => set("dot_frequency", v)} />
        <Field label="圆点半径（mm）" value={p.dot_radius} min={0.01} step={0.05} onChange={(v) => set("dot_radius", v)} />
        <Field label="线宽" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
        <Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label="圆点颜色" value={p.dot_color} type="color" onChange={(v) => set("dot_color", v)} />
      </>
    );
  if (p.kind === "eight")
    return (
      <>
        <Field label="开始日期" value={p.start_date} type="date" onChange={(v) => set("start_date", v)} />
        <Field label="结束日期" value={p.end_date} type="date" onChange={(v) => set("end_date", v)} />
        <Field label="日期格式" value={p.date_format} type="text" placeholder="例如：%-d、%m/%d、%a %cccc（农历）" onChange={(v) => set("date_format", v)} />
        <Select
          label="语言"
          value={p.date_locale}
          options={[
            ["zh-CN", "中文"],
            ["en-US", "English"],
          ]}
          onChange={(v) => set("date_locale", v)}
        />
        <Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label="线宽（pt）" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
        <Select label="线样式" value={p.line_style} options={LINE_STYLE_OPTIONS} onChange={(v) => set("line_style", v)} />
        <Field label="中心点间距（mm）" value={p.center_gap} min={0} step={0.5} onChange={(v) => set("center_gap", v)} />
        <Field label="日期字号（pt）" value={p.date_size} min={1} step={0.5} onChange={(v) => set("date_size", v)} />
        <Select
          label="表头语言"
          value={p.weekday_lang}
          options={WEEKDAY_LANG_OPTIONS}
          onChange={(v) => set("weekday_lang", v)}
        />
      </>
    );
  if (p.kind === "year")
    return (
      <>
        <Field label="开始月份" value={p.start} type="month" onChange={(v) => set("start", v)} />
        <Field label="结束月份" value={p.end} type="month" onChange={(v) => set("end", v)} />
        <Field label="行数" value={p.rows} min={1} max={12} onChange={(v) => set("rows", v)} />
        <Field label="列数" value={p.cols} min={1} max={12} onChange={(v) => set("cols", v)} />
        <Field label="日期字号（pt）" value={p.date_size} min={1} step={0.5} onChange={(v) => set("date_size", v)} />
        <Select
          label="表头语言"
          value={p.weekday_lang}
          options={WEEKDAY_LANG_OPTIONS}
          onChange={(v) => set("weekday_lang", v)}
        />
      </>
    );
  if (p.kind === "month")
    return (
      <>
        <Field label="年" value={p.year} min={1900} max={2100} onChange={(v) => set("year", v)} />
        <Field label="月" value={p.month} min={1} max={12} onChange={(v) => set("month", v)} />
        <Field label="月相颜色" value={p.phase_color} type="color" onChange={(v) => set("phase_color", v)} />
        <Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label="线宽（pt）" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
        <Field label="日期字号（pt）" value={p.date_size} min={1} step={0.5} onChange={(v) => set("date_size", v)} />
        <Select
          label="表头语言"
          value={p.weekday_lang}
          options={WEEKDAY_LANG_OPTIONS}
          onChange={(v) => set("weekday_lang", v)}
        />
        <Field label="双页（周一~三 / 周四~日）" value={p.two_page} type="checkbox" onChange={(v) => set("two_page", v)} />
      </>
    );
  if (p.kind === "tracker")
    return (
      <>
        <Field label="年" value={p.year} min={1900} max={2100} onChange={(v) => set("year", v)} />
        <Field label="月" value={p.month} min={1} max={12} onChange={(v) => set("month", v)} />
        <Field label="打卡项数" value={p.items} min={1} max={30} onChange={(v) => set("items", v)} />
        <Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
        <Field label="线宽（pt）" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
        <Field label="日期字号（pt）" value={p.date_size} min={1} step={0.5} onChange={(v) => set("date_size", v)} />
      </>
    );
  if (p.kind === "graph")
    return (
      <>
        <Select
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
      </>
    );
  return (
    <>
      <Field label="起始小时" value={p.start} min={0} max={29} onChange={(v) => set("start", v)} />
      <Field label="结束小时" value={p.end} min={1} max={30} onChange={(v) => set("end", v)} />
      <Select
        label="跨页"
        value={p.pages}
        options={[
          [1, "单页"],
          [2, "左右双页"],
        ]}
        onChange={(v) => set("pages", Number(v))}
      />
      <Field label="日期（留空不区分昼夜）" value={p.date} type="date" onChange={(v) => set("date", v || "")} />
      <Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
      <Field label="线宽" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} />
      <Field label="标签字号（pt）" value={p.label_size} min={1} step={0.1} onChange={(v) => set("label_size", v)} /> <Field label="纬度（留空不绘制日照）" value={p.latitude} type="text" placeholder="如 30°15′N 或 30.25" onChange={(v) => set("latitude", toDecimal(String(v)) ?? v)} />
      <Field label="经度" value={p.longitude} type="text" placeholder="如 120°12′E 或 120.2" onChange={(v) => set("longitude", toDecimal(String(v)) ?? v)} />
      <Select label="时区" value={String(p.timezone ?? "")} options={TZ_OPTIONS} onChange={(v) => set("timezone", v)} />
      <Field label="日照颜色" value={p.daylight_color} type="color" onChange={(v) => set("daylight_color", v)} />
      <Field label="夜间颜色" value={p.night_color} type="color" onChange={(v) => set("night_color", v)} />
    </>
  );
}

function FontPicker({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter(([, label]) => label.toLowerCase().includes(q)) : options;
    return list.slice(0, 50);
  }, [query, options]);
  return (
    <div className="grid gap-1.5">
      <span className="text-sm text-muted-foreground">字体（边距文字）</span>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 w-full justify-start font-normal">
            {options.find(([v]) => v === value)?.[1] ?? (value || "选择字体…")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="p-2">
            <Input autoFocus placeholder="搜索字体…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8" />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.map(([v, label]) => (
              <button
                key={v}
                className={cn("flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent", value === v && "bg-accent")}
                onClick={() => {
                  onChange(v);
                  setOpen(false);
                }}
              >
                {label}
              </button>
            ))}
            {filtered.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">未找到字体</p>}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// 页数由版式真实参数决定：是多少页就算多少页。
function effectivePages(section: Section): number {
  const p = section.pattern;
  if (p.kind === "ruled" || p.kind === "dots" || p.kind === "grid" || p.kind === "us-ruled" || p.kind === "seyes" || p.kind === "timeline" || p.kind === "vertical")
    return Math.max(1, Number(p.pages) || 1);
  if (p.kind === "eight") {
    const start = parseISODate(String(p.start_date));
    const end = parseISODate(String(p.end_date));
    if (start && end && start <= end) return (Math.round((end.getTime() - start.getTime()) / 86400000 / 7) + 1) * 2;
  }
  if (p.kind === "year") {
    const [sy, sm] = String(p.start).split("-").map(Number);
    const [ey, em] = String(p.end).split("-").map(Number);
    if (sy && sm && ey && em) {
      const months = ey * 12 + em - sy * 12 - sm + 1;
      if (months > 0) return Math.ceil(months / (Number(p.rows) * Number(p.cols) || 1));
    }
  }
  return 1;
}

// 页头/页脚参数完全一致，共用同一个带状区域请求。
function bandRequest(values: Values, prefix: "header" | "footer", enabled: boolean, mode: "text" | "number") {
  const text = enabled && mode === "text";
  return {
    text: text ? values[`${prefix}_text`] || null : null,
    text_2: text ? values[`${prefix}_text_2`] || null : null,
    text_size: values[`${prefix}_text_size`],
    text_2_size: values[`${prefix}_text_2_size`],
    text_spacing: values[`${prefix}_text_spacing`],
    text_color: values[`${prefix}_text_color`],
    page_number: enabled && mode === "number",
  };
}

function sectionRequest(section: Section, holidays: Record<string, string>): RenderSectionRequest {
  return {
    page: {
      ...section.page,
      header: section.headerEnabled ? section.page.header : 0,
      footer: section.footerEnabled ? section.page.footer : 0,
      binding: section.watermarkEnabled ? section.page.binding : 0,
      non_binding: section.nonBindingEnabled ? section.page.non_binding : 0,
    },
    document: {
      page_number: section.pageNumber,
      header: bandRequest(section.document, "header", section.headerEnabled, section.headerMode),
      footer: bandRequest(section.document, "footer", section.footerEnabled, section.footerMode),
      binding_text: section.watermarkEnabled ? section.document.binding_text || null : null,
      binding_text_2: section.watermarkEnabled ? section.document.binding_text_2 || null : null,
      binding_text_size: section.document.binding_text_size,
      binding_text_2_size: section.document.binding_text_2_size,
      binding_text_spacing: section.document.binding_text_spacing,
      binding_text_edge: section.document.binding_text_edge,
      binding_text_font: section.document.binding_text_font,
      binding_text_color: section.document.binding_text_color,
      non_binding_text: section.nonBindingEnabled ? section.document.non_binding_text || null : null,
      non_binding_text_2: section.nonBindingEnabled ? section.document.non_binding_text_2 || null : null,
      non_binding_text_size: section.document.non_binding_text_size,
      non_binding_text_2_size: section.document.non_binding_text_2_size,
      non_binding_text_spacing: section.document.non_binding_text_spacing,
      non_binding_text_edge: section.document.non_binding_text_edge,
      non_binding_text_color: section.document.non_binding_text_color,
  },
  title: patternNames[section.pattern.kind],
  pattern: cleanPattern(section.pattern),
  holidays,
  } as unknown as RenderSectionRequest;
}

const SortableSection = memo(function SortableSection({ section, index, update, remove }: { section: Section; index: number; update: (id: string, patch: Partial<Section>) => void; remove: (id: string) => void }) {
  const sortable = useSortable({ id: section.id });
  const doc = (key: string, value: Value) =>
    update(section.id, {
      document: {
        ...section.document,
        [key]: value,
        ...(!value && ["header_text", "footer_text", "binding_text", "non_binding_text"].includes(key) ? { [`${key}_2`]: "" } : {}),
      },
    });
  const page = (key: string, value: Value) => update(section.id, { page: { ...section.page, [key]: value } });
  const pattern = (key: string, value: Value) => update(section.id, { pattern: { ...section.pattern, [key]: value } });
  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
    >
      <Card className={cn("overflow-hidden", sortable.isDragging && "relative z-10 opacity-80 shadow-lg")}>
        <div className="flex items-center gap-2 p-3">
          <button className="cursor-grab touch-none rounded p-1.5 text-muted-foreground hover:bg-muted" aria-label={`拖动第 ${index + 1} 个卡片`} {...sortable.attributes} {...sortable.listeners}>
            <GripVertical className="size-5" />
          </button>
          <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold">{index + 1}</span>
          <button className="min-w-0 flex-1 text-left" onClick={() => update(section.id, { expanded: !section.expanded })}>
            <span className="block truncate font-medium">#{index + 1}</span>
            <span className="text-xs text-muted-foreground">
              {patternNames[section.pattern.kind]} · {effectivePages(section)} 页
            </span>
          </button>
          <Button variant="ghost" size="icon" aria-label="展开或收起" onClick={() => update(section.id, { expanded: !section.expanded })}>
            {section.expanded ? <ChevronUp /> : <ChevronDown />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="删除卡片" onClick={() => remove(section.id)}>
            <Trash2 className="text-destructive" />
          </Button>
        </div>
        {section.expanded && (
          <CardContent className="grid gap-4 border-t bg-muted/30 pt-5 sm:grid-cols-2">
            <Field label="参与页码" value={section.pageNumber} type="checkbox" onChange={(pageNumber) => update(section.id, { pageNumber: Boolean(pageNumber) })} />
            <Group title="页头" enabled={section.headerEnabled} onEnabled={(headerEnabled) => update(section.id, { headerEnabled })}>
              <Field label="页头高度（mm）" value={section.page.header} min={0} step={0.5} onChange={(v) => page("header", v)} />
              <Select
                label="页头内容"
                value={section.headerMode}
                options={[
                  ["text", "文字"],
                  ["number", "页码"],
                ]}
                onChange={(v) => update(section.id, { headerMode: v as Section["headerMode"] })}
              />
              {section.headerMode === "text" && <TextFields values={section.document} prefix="header_text" set={doc} />}
              <Field label="页头颜色" value={section.document.header_text_color} type="color" onChange={(v) => doc("header_text_color", v)} />
            </Group>
            <Group title="页脚" enabled={section.footerEnabled} onEnabled={(footerEnabled) => update(section.id, { footerEnabled })}>
              <Field label="页脚高度（mm）" value={section.page.footer} min={5} step={0.5} onChange={(v) => page("footer", v)} />
              <Select
                label="页脚内容"
                value={section.footerMode}
                options={[
                  ["text", "文字"],
                  ["number", "页码"],
                ]}
                onChange={(v) => update(section.id, { footerMode: v as Section["footerMode"] })}
              />
              {section.footerMode === "text" && <TextFields values={section.document} prefix="footer_text" set={doc} />}
              <Field label="页脚颜色" value={section.document.footer_text_color} type="color" onChange={(v) => doc("footer_text_color", v)} />
            </Group>
            <Group title="装订侧水印" enabled={section.watermarkEnabled} onEnabled={(watermarkEnabled) => update(section.id, { watermarkEnabled })}>
              <Field label="装订侧宽度（mm）" value={section.page.binding} min={0} step={0.5} onChange={(v) => page("binding", v)} />
              <Field label="离边缘距离（mm，留空居中）" value={section.document.binding_text_edge} type="number" min={0} step={0.5} onChange={(v) => doc("binding_text_edge", Number(v) || null)} />
              <TextFields values={section.document} prefix="binding_text" set={doc} />
              <Field label="水印颜色" value={section.document.binding_text_color} type="color" onChange={(v) => doc("binding_text_color", v)} />
            </Group>
            <Group title="非装订侧水印" enabled={section.nonBindingEnabled} onEnabled={(nonBindingEnabled) => update(section.id, { nonBindingEnabled })}>
              <Field label="非装订侧宽度（mm）" value={section.page.non_binding} min={0} step={0.5} onChange={(v) => page("non_binding", v)} />
              <Field label="离边缘距离（mm，留空居中）" value={section.document.non_binding_text_edge} type="number" min={0} step={0.5} onChange={(v) => doc("non_binding_text_edge", Number(v) || null)} />
              <TextFields values={section.document} prefix="non_binding_text" set={doc} />
              <Field label="水印颜色" value={section.document.non_binding_text_color} type="color" onChange={(v) => doc("non_binding_text_color", v)} />
            </Group>
            <section className="grid gap-4 rounded-lg border bg-background p-4 sm:col-span-2">
              <Select
                label="版式"
                value={section.pattern.kind}
                options={Object.entries(patternNames)}
                onChange={(kind) => update(section.id, { pattern: { ...defaults[kind as PatternKind] } })}
              />
              <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                <PatternFields section={section} set={pattern} />
              </div>
            </section>
          </CardContent>
        )}
      </Card>
    </div>
  );
});

/// localStorage 里可能存着旧版式字段：迁移到当前模板结构，避免后端 deny_unknown_fields 拒绝。
function migrateSection(s: Section): Section {
  const pattern = { ...s.pattern } as Values & { kind: string };
  if (pattern.kind === "seyes" && pattern.margin_x != null) {
    const spacing = Number(pattern.spacing) || 8;
    const w = Number(s.page?.width ?? 148) - Number(s.page?.binding ?? 0) - Number(s.page?.non_binding ?? 0);
    const offset = (((w % spacing) + spacing) % spacing) / 2;
    pattern.margin_line = Math.max(
      0,
      Math.round((Number(pattern.margin_x) - Number(s.page?.binding ?? 0) - offset) / spacing) + 1,
    );
    delete pattern.margin_x;
  }
  if (pattern.kind === "basic") {
    if (pattern.draw_dots) {
      return {
        ...s,
        pattern: {
          kind: "dots",
          pages: pattern.pages,
          spacing: pattern.spacing,
          column_spacing: pattern.dot_spacing ?? pattern.spacing,
          radius: pattern.dot_radius,
          color: pattern.dot_color ?? pattern.line_color,
        },
      } as Section;
    }
    if (pattern.draw_vlines && !pattern.draw_hlines) {
      return {
        ...s,
        pattern: {
          kind: "grid",
          pages: pattern.pages,
          spacing: pattern.vline_spacing ?? pattern.spacing,
          color: pattern.vline_color,
          width: pattern.vline_width,
        },
      } as Section;
    }
    return {
      ...s,
      pattern: {
        kind: "ruled",
        pages: pattern.pages,
        spacing: pattern.spacing,
        color: pattern.line_color,
        width: pattern.line_width,
      },
    } as Section;
  }
  return { ...s, pattern } as Section;
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function cleanPattern(pattern: Section["pattern"]) {
  if (pattern.kind === "bunkwan") {
    const cleaned = { ...pattern };
    delete cleaned.date_size;
    return cleaned;
  }
  if (pattern.kind === "timeline")
    return {
      ...pattern,
      latitude: pattern.latitude ?? null,
      longitude: pattern.longitude ?? null,
      timezone: pattern.timezone || null,
      date: pattern.date || null,
    };
  return pattern;
}

export default function App() {
  const [saved] = useState(() =>
    loadJSON<{
      sections?: Section[];
      binding?: "booklet" | "thread" | null;
      sheetsPerGroup?: number;
      size?: { width: number; height: number };
      pageSize?: string;
      holidays?: Record<string, string>;
    } | null>("base6.state", null),
  );
  const [sections, setSections] = useState<Section[]>(() =>
    (saved?.sections ?? [newSection()]).map(migrateSection),
  );
  const [binding, setBinding] = useState<"booklet" | "thread" | null>(saved?.binding ?? "booklet");
  const [size, setSize] = useState(saved?.size ?? { width: 148, height: 210 });
const [pageSize, setPageSize] = useState(saved?.pageSize ?? "A5");
const [holidays, setHolidays] = useState<Record<string, string>>(saved?.holidays ?? {});
  const [fontOptions, setFontOptions] = useState<[string, string][]>(FONT_OPTIONS);
  useEffect(() => {
    invoke<string>("list_system_fonts")
      .then((json) => {
        const names = JSON.parse(json) as string[];
        if (names.length) setFontOptions((base) => [...base, ...names.map((n) => [n, n] as [string, string])]);
      })
      .catch(() => {
        /* 保持三个字族兑底 */
      });
  }, []);
  const applySize = (w: number, h: number) => {
    setSize({ width: w, height: h });
    setSections((items) => items.map((s) => ({ ...s, page: { ...s.page, width: w, height: h } })));
  };
  const [sheetsPerGroup, setSheetsPerGroup] = useState(saved?.sheetsPerGroup ?? 4);
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);
  useEffect(() => {
localStorage.setItem("base6.state", JSON.stringify({ sections, binding, sheetsPerGroup, size, pageSize, holidays }));
  }, [sections, binding, sheetsPerGroup, size, pageSize, holidays]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const update = useCallback((id: string, patch: Partial<Section>) => setSections((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item))), []);
  const removeSection = useCallback((id: string) => setSections((items) => items.filter(({ id: itemId }) => itemId !== id)), []);
  function dragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setSections((items) =>
      arrayMove(
        items,
        items.findIndex(({ id }) => id === active.id),
        items.findIndex(({ id }) => id === over.id),
      ),
    );
  }
  async function exportPreset() {
    const output = await save({
      title: "导出预设",
      defaultPath: "base6-preset.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!output) return;
    try {
      await invoke<string>("write_text_file", {
        path: output,
        content: JSON.stringify({ sections, binding, sheetsPerGroup, size, pageSize, holidays }, null, 2),
      });
      setStatus("预设已导出");
    } catch (error) {
      setStatus(`导出失败：${String(error)}`);
    }
  }
  async function importPreset() {
    const input = await open({
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!input || Array.isArray(input)) return;
    try {
      const content = await invoke<string>("read_text_file", { path: input });
      const data = JSON.parse(content) as {
        sections?: unknown;
        binding?: unknown;
        sheetsPerGroup?: unknown;
        size?: unknown;
        pageSize?: unknown;
        holidays?: unknown;
      };
      if (!data || !Array.isArray(data.sections)) {
        setStatus("预设文件格式不正确");
        return;
      }
      setSections(data.sections as Section[]);
      if (data.binding === "booklet" || data.binding === "thread" || data.binding === null) setBinding(data.binding);
      if (typeof data.sheetsPerGroup === "number") setSheetsPerGroup(data.sheetsPerGroup);
      if (data.size && typeof data.size === "object" && "width" in data.size && "height" in data.size) setSize(data.size as { width: number; height: number });
      if (typeof data.pageSize === "string") setPageSize(data.pageSize);
      if (data.holidays && typeof data.holidays === "object") setHolidays(data.holidays as Record<string, string>);
      setStatus("预设已导入");
    } catch (error) {
      setStatus(`导入失败：${String(error)}`);
    }
  }

  async function importICS() {
    try {
      const path = await open({
        title: "选择 ICS 日历文件",
        filters: [{ name: "ICS 日历", extensions: ["ics", "ical"] }],
        multiple: false,
      });
      if (!path) return;
      const content = await invoke<string>("read_text_file", { path });
      const parsed = parseICS(content);
      setHolidays(parsed);
      setStatus(`已导入 ${Object.keys(parsed).length} 个节日`);
    } catch (error) {
      setStatus(`导入失败：${String(error)}`);
    }
  }

  async function generate() {
    const output = await save({
      title: "生成手帐 PDF",
      defaultPath: "base6-techo.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!output) return;
    setRunning(true);
    setStatus("正在排版并生成 PDF…");
    try {
      const request = {
        output,
        sections: sections.map((section) => sectionRequest(section, holidays)),
        bind: { mode: binding, sheets_per_group: sheetsPerGroup },
      } as unknown as RunPipelineRequest;
      setStatus(`已生成：${await invoke<string>("run_pipeline", { body: request })}`);
    } catch (error) {
      setStatus(`生成失败：${String(error)}`);
    } finally {
      setRunning(false);
    }
  }

  const [preview, setPreview] = useState<{ open: boolean; data: string; busy: boolean; error: string }>({ open: false, data: "", busy: false, error: "" });
  async function previewDocument(rerender = false) {
    if (preview.open && !rerender) {
      setPreview((p) => ({ ...p, open: false }));
      return;
    }
    setPreview({ open: true, data: "", busy: true, error: "" });
    try {
      const request = {
        output: "",
        sections: sections.map((section) => sectionRequest(section, holidays)),
        bind: { mode: binding, sheets_per_group: sheetsPerGroup },
      } as unknown as RunPipelineRequest;
      const data = await invoke<string>("preview_document", { body: request });
      setPreview({ open: true, data, busy: false, error: "" });
    } catch (error) {
      setPreview({ open: true, data: "", busy: false, error: String(error) });
    }
  }
  return (
    <main className="mx-auto max-w-6xl p-5 sm:p-8">
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <section className="grid gap-3">
          {preview.open && (
            <div className="overflow-hidden rounded-xl border bg-muted/30">
              {preview.busy ? (
                <p className="p-6 text-center text-sm text-muted-foreground">正在渲染整体预览…</p>
              ) : preview.error ? (
                <p className="p-6 text-xs text-destructive">预览失败：{preview.error}</p>
              ) : (
                <iframe title="整体预览" src={`data:application/pdf;base64,${preview.data}`} className="block h-[80vh] w-full" />
              )}
            </div>
          )}
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Sections</h2>
            <Button variant="outline" onClick={() => setSections((items) => [...items, newSection(size.width, size.height)])}>
              <Plus />
              添加
            </Button>
          </div>
          <DndContext sensors={sensors} onDragEnd={dragEnd}>
            <SortableContext items={sections.map(({ id }) => id)} strategy={verticalListSortingStrategy}>
              {sections.map((section, index) => (
<SortableSection key={section.id} section={section} index={index} update={update} remove={removeSection} />
              ))}
            </SortableContext>
          </DndContext>
          {sections.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">至少添加一个 Section。</div>}
        </section>
        <Card className="lg:sticky lg:top-8">
          <CardHeader>
            <CardTitle>装订方式</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 border-b pb-4">
              <Select
                label="页面大小"
                value={pageSize}
                options={PAGE_SIZE_OPTIONS}
                onChange={(v) => {
                  setPageSize(v);
                  if (v !== "custom") {
                    const [w, h] = PAGE_SIZES[v];
                    applySize(w, h);
                  }
                }}
              />
              {pageSize === "custom" && (
                <>
                  <Field label="宽度（mm）" value={size.width} min={10} step={0.5} onChange={(v) => applySize(Number(v), size.height)} />
                  <Field label="高度（mm）" value={size.height} min={10} step={0.5} onChange={(v) => applySize(size.width, Number(v))} />
                </>
              )}
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={importICS} disabled={running}>
                    <Upload />
                    导入 ICS 日历
                  </Button>
                  {Object.keys(holidays).length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setHolidays({})}>
                      <Trash2 />
                      清除
                    </Button>
                  )}
                </div>
                {Object.keys(holidays).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    已导入 {Object.keys(holidays).length} 个节日日期
                  </p>
                )}
              </div>
              <FontPicker
                value={String(sections[0]?.document.binding_text_font ?? String.raw`\sffamily`)}
                options={fontOptions}
                onChange={(v) =>
                  setSections((items) =>
                    items.map((s) => ({
                      ...s,
                      document: { ...s.document, binding_text_font: v },
                    })),
                  )
                }
              />
            </div>
            {(
              [
                {
                  value: "booklet",
                  title: "骑马钉",
                  hint: "整本按 4 页补齐并拼版",
                },
                {
                  value: "thread",
                  title: "锁线分册",
                  hint: "按每帖纸张数分组拼版",
                },
                { value: null, title: "不拼版", hint: "保持页面顺序输出" },
              ] as const
            ).map((option) => (
              <button key={option.title} className={cn("rounded-lg border p-3 text-left", binding === option.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted")} onClick={() => setBinding(option.value)}>
                <span className="block text-sm font-medium">{option.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{option.hint}</span>
              </button>
            ))}
            {binding === "thread" && <Field label="每帖纸张数" value={sheetsPerGroup} min={1} onChange={(value) => setSheetsPerGroup(Number(value))} />}
            <div className="border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sections</span>
                <span>{sections.length}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-muted-foreground">成品页数</span>
                <span>{sections.reduce((sum, section) => sum + effectivePages(section), 0)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={exportPreset}>
                <Download />
                导出预设
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={importPreset}>
                <Upload />
                导入预设
              </Button>
            </div>
            <Button variant="outline" size="lg" disabled={running || preview.busy || !sections.length} onClick={() => previewDocument(true)}>
              {preview.open ? <RefreshCw /> : <Eye />}
              {preview.busy ? "渲染中…" : preview.open ? "重新渲染" : "整体预览"}
            </Button>
            {preview.open && (
              <Button variant="ghost" size="lg" disabled={preview.busy} onClick={() => setPreview((p) => ({ ...p, open: false }))}>
                <X />
                关闭预览
              </Button>
            )}
            <Button size="lg" disabled={running || !sections.length} onClick={generate}>
              <FileDown />
              {running ? "生成中…" : "选择位置并生成"}
            </Button>
            {status && (
              <p className="break-all rounded-md bg-muted p-3 text-xs text-muted-foreground" role="status">
                {status}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
