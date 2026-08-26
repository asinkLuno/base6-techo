import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { open, save } from "@tauri-apps/plugin-dialog";
import { ChevronDown, ChevronUp, Download, Eye, FileDown, GripVertical, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { pyInvoke } from "tauri-plugin-pytauri-api";
import type { RenderSectionRequest, RunPipelineRequest } from "./pipeline-request.generated";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Checkbox } from "./components/ui/checkbox";
import { Input } from "./components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { Select as SelectRoot, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { ColorPicker } from "./components/ui/color-picker";
import { cn } from "./lib/utils";

type Value = string | number | boolean | null;
type Values = Record<string, Value>;
type PatternKind = "basic" | "midori" | "timeline";
type Section = {
  id: string; expanded: boolean; pages: number;
  headerEnabled: boolean; footerEnabled: boolean; watermarkEnabled: boolean;
  page: Values; document: Values; pattern: Values & { kind: PatternKind };
  headerStyle: "date" | "text" | "none";
  nonBindingEnabled: boolean;
};

const patternNames: Record<PatternKind, string> = { basic: "基础版式", midori: "Midori", timeline: "时间轴" };

const PAGE_SIZES: Record<string, [number, number]> = { A5: [148, 210], A6: [105, 148], A7: [74, 105], B5: [176, 250], B6: [125, 176] };

const FONT_OPTIONS: [string, string][] = [
  [String.raw`\sffamily`, "无衬线（sans）"],
  [String.raw`\rmfamily`, "衬线（serif）"],
  [String.raw`\ttfamily`, "等宽（mono）"],
];

const TZ_OPTIONS: [string, string][] = [
  ...Array.from({ length: 12 }, (_, i) => [`Etc/GMT-${12 - i}`, `东${12 - i}区（UTC+${12 - i}）`] as [string, string]),
  ["Etc/GMT", "零时区（UTC）"],
  ...Array.from({ length: 12 }, (_, i) => [`Etc/GMT+${i + 1}`, `西${i + 1}区（UTC-${i + 1}）`] as [string, string]),
];

const defaults: Record<PatternKind, Values & { kind: PatternKind }> = {
  basic: { kind: "basic", spacing: 8, line_width: 0.2, line_color: "#b0b0b0", draw_hlines: true, draw_vlines: false, draw_dots: false, hline_edge_color: "#b0b0b0", hline_edge_width: 0.2, vline_edge_color: "#b0b0b0", vline_edge_width: 0.2, dot_center_color: "#b0b0b0", hline_header: false, hline_footer: false, hline_inner: false, hline_outer: false, vline_header: false, vline_footer: false, vline_inner: false, vline_outer: false, dot_header: false, dot_footer: false, dot_inner: false, dot_outer: false, dot_spacing: 8, dot_radius: 0.3, margin_x: 0, margin_color: "#b0b0b0", vline_spacing: 8 },
  midori: { kind: "midori", spacing: 5, gap: 1, edge_extension: 1.2, dot_frequency: 10, dot_radius: 0.4, line_width: 0.7, line_color: "#a9d1ae", dot_color: "#a9d1ae", header: false, footer: false, inner: false, outer: false },
  timeline: { kind: "timeline", start: 0, end: 26, pages: 1, line_color: "#7a7a7a", line_width: 1.138, label_size: 10.2, latitude: "", longitude: "", timezone: "Etc/GMT-8", daylight_color: "#e5b93f", night_color: "#496a9f" },
};

function newSection(width = 148, height = 210): Section {
  return {
    id: crypto.randomUUID(), expanded: true, pages: 32,
    headerEnabled: false, footerEnabled: false,
    page: { width, height, header: 10, footer: 10, binding: 15, non_binding: 8 },
    document: { header_date: new Date().toISOString().slice(0, 10), header_date_end: null, header_date_format: "yyyy-MM-dd", header_date_locale: "zh_CN", header_parity: "both", header_date_size: 8, header_date_position: "center", binding_text: "", binding_text_2: "", binding_text_size: 8, binding_text_2_size: 8, binding_text_spacing: 5, binding_text_edge: null, binding_text_color: "#7a7a7a", header_text: "", header_text_2: "", header_text_size: 8, header_text_2_size: 8, header_text_spacing: 5, header_text_color: "#7a7a7a", footer_text: "", footer_text_2: "", footer_text_size: 8, footer_text_2_size: 8, footer_text_spacing: 5, footer_text_color: "#7a7a7a", non_binding_text: "", non_binding_text_2: "", non_binding_text_size: 8, non_binding_text_2_size: 8, non_binding_text_spacing: 5, non_binding_text_edge: null, non_binding_text_color: "#7a7a7a" },
    watermarkEnabled: false, nonBindingEnabled: false,
    headerStyle: "date",
    pattern: { ...defaults.basic },
  };
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-sm text-muted-foreground">{children}</span>;
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
  const d = Number(deg), mi = Number(min), se = Number(sec);
  if (![d, mi, se].every(Number.isFinite)) return null;
  const negative = /[SWsw]/.test(orig) || /^-/.test(deg.trim());
  return (Math.abs(d) + mi / 60 + se / 3600) * (negative ? -1 : 1);
}

function Field({ label, value, type = "number", min, max, step, placeholder, onChange }: { label: string; value: Value; type?: string; min?: number; max?: number; step?: number; placeholder?: string; onChange: (value: Value) => void }) {
  if (type === "checkbox") return <label className="flex cursor-pointer items-center gap-2 text-sm leading-none"><Checkbox checked={Boolean(value)} onCheckedChange={(checked) => onChange(Boolean(checked))} />{label}</label>;
  if (type === "color") return <div className="grid gap-1.5"><FieldLabel>{label}</FieldLabel><ColorPicker value={String(value)} onChange={(v) => onChange(v)} /></div>;
  return <label className="grid gap-1.5"><FieldLabel>{label}</FieldLabel><Input type={type} value={String(value ?? "")} min={min} max={max} step={step} placeholder={placeholder} onChange={(event) => onChange(type === "number" ? Number(event.target.value) : event.target.value)} /></label>;
}
function Select({ label, value, options, onChange }: { label: string; value: Value; options: [string | number, string][]; onChange: (value: string) => void }) {
  return <div className="grid gap-1.5"><FieldLabel>{label}</FieldLabel><SelectRoot value={String(value ?? "")} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([key, text]) => <SelectItem key={key} value={String(key)}>{text}</SelectItem>)}</SelectContent></SelectRoot></div>;
}
function Group({ title, enabled, onEnabled, children }: { title: string; enabled: boolean; onEnabled: (enabled: boolean) => void; children: ReactNode }) {
  return <section className="grid gap-4 rounded-lg border bg-background p-4 sm:col-span-2"><Field label={title} value={enabled} type="checkbox" onChange={(value) => onEnabled(Boolean(value))} />{enabled && <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">{children}</div>}</section>;
}

function TextFields({ values, prefix, set }: { values: Values; prefix: string; set: (key: string, value: Value) => void }) {
  return <>
    <Field label="第一行文字" value={values[prefix]} type="text" onChange={(v) => set(prefix, v)} />
    {values[prefix] ? <>
      <Field label="第一行字号（pt）" value={values[`${prefix}_size`]} min={1} step={0.5} onChange={(v) => set(`${prefix}_size`, v)} />
      <Field label="第二行文字" value={values[`${prefix}_2`]} type="text" onChange={(v) => set(`${prefix}_2`, v)} />
    </> : null}
    {values[prefix] && values[`${prefix}_2`] ? <><Field label="第二行字号（pt）" value={values[`${prefix}_2_size`]} min={1} step={0.5} onChange={(v) => set(`${prefix}_2_size`, v)} /><Field label="两行间距（mm）" value={values[`${prefix}_spacing`]} min={0} step={0.5} onChange={(v) => set(`${prefix}_spacing`, v)} /></> : null}
  </>;
}

function PatternFields({ section, set }: { section: Section; set: (key: string, value: Value) => void }) {
  const p = section.pattern;
  if (p.kind === "basic") return <>
    <Field label="基础间距（mm）" value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} /><Field label="线宽" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} /><Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} />
    <div className="flex flex-wrap items-end gap-4"><Field label="横线" value={p.draw_hlines} type="checkbox" onChange={(v) => set("draw_hlines", v)} /><Field label="竖线" value={p.draw_vlines} type="checkbox" onChange={(v) => set("draw_vlines", v)} /><Field label="点阵" value={p.draw_dots} type="checkbox" onChange={(v) => set("draw_dots", v)} /></div>
    {p.draw_hlines && <><Field label="横线边缘颜色" value={p.hline_edge_color} type="color" onChange={(v) => set("hline_edge_color", v)} /><Field label="横线边缘线宽" value={p.hline_edge_width} min={0.01} step={0.05} onChange={(v) => set("hline_edge_width", v)} /></>}
    {p.draw_vlines && <><Field label="竖线间距（mm）" value={p.vline_spacing} min={0.1} step={0.1} onChange={(v) => set("vline_spacing", v)} /><Field label="竖线边缘颜色" value={p.vline_edge_color} type="color" onChange={(v) => set("vline_edge_color", v)} /><Field label="竖线边缘线宽" value={p.vline_edge_width} min={0.01} step={0.05} onChange={(v) => set("vline_edge_width", v)} /></>}
    {p.draw_dots && <><Field label="点阵间距（mm）" value={p.dot_spacing} min={0.1} step={0.1} onChange={(v) => set("dot_spacing", v)} /><Field label="点半径（mm）" value={p.dot_radius} min={0.01} step={0.05} onChange={(v) => set("dot_radius", v)} /><Field label="中心点颜色" value={p.dot_center_color} type="color" onChange={(v) => set("dot_center_color", v)} /></>}
    <Field label="边距线 X（0 为关闭）" value={p.margin_x} min={0} step={0.5} onChange={(v) => set("margin_x", v)} />{Number(p.margin_x) > 0 && <Field label="边距线颜色" value={p.margin_color} type="color" onChange={(v) => set("margin_color", v)} />}
  </>;
  if (p.kind === "midori") return <>
    <Field label="间距（mm）" value={p.spacing} min={0.1} step={0.1} onChange={(v) => set("spacing", v)} /><Field label="双线间隙（mm）" value={p.gap} min={0} step={0.1} onChange={(v) => set("gap", v)} /><Field label="边缘延伸（mm）" value={p.edge_extension} min={0} step={0.1} onChange={(v) => set("edge_extension", v)} /><Field label="圆点频率" value={p.dot_frequency} min={1} onChange={(v) => set("dot_frequency", v)} /><Field label="圆点半径（mm）" value={p.dot_radius} min={0.01} step={0.05} onChange={(v) => set("dot_radius", v)} /><Field label="线宽" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} /><Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} /><Field label="圆点颜色" value={p.dot_color} type="color" onChange={(v) => set("dot_color", v)} />
  </>;
  return <>
    <Field label="起始小时" value={p.start} min={0} max={29} onChange={(v) => set("start", v)} /><Field label="结束小时" value={p.end} min={1} max={30} onChange={(v) => set("end", v)} /><Select label="跨页" value={p.pages} options={[[1, "单页"], [2, "左右双页"]]} onChange={(v) => set("pages", Number(v))} /><Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} /><Field label="线宽" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} /><Field label="标签字号（pt）" value={p.label_size} min={1} step={0.1} onChange={(v) => set("label_size", v)} />    <Field label="纬度（留空不绘制日照）" value={p.latitude} type="text" placeholder="如 30°15′N 或 30.25" onChange={(v) => set("latitude", toDecimal(String(v)) ?? v)} /><Field label="经度" value={p.longitude} type="text" placeholder="如 120°12′E 或 120.2" onChange={(v) => set("longitude", toDecimal(String(v)) ?? v)} /><Select label="时区" value={String(p.timezone ?? "")} options={TZ_OPTIONS} onChange={(v) => set("timezone", v)} /><Field label="日照颜色" value={p.daylight_color} type="color" onChange={(v) => set("daylight_color", v)} /><Field label="夜间颜色" value={p.night_color} type="color" onChange={(v) => set("night_color", v)} />
  </>;
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
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 w-full justify-start font-normal">
            {options.find(([v]) => v === value)?.[1] ?? (value || "选择字体…")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="p-2"><Input autoFocus placeholder="搜索字体…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8" /></div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.map(([v, label]) => (
              <button key={v} className={cn("flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent", value === v && "bg-accent")} onClick={() => { onChange(v); setOpen(false); }}>
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

function effectivePages(section: Section): number {
  const { headerEnabled, headerStyle, pages, document } = section;
  if (headerEnabled && headerStyle === "date" && document.header_date && document.header_date_end) {
    const days = Math.round((Date.parse(String(document.header_date_end)) - Date.parse(String(document.header_date))) / 86400000) + 1;
    // 奇数/偶数页模式：每天占一个可见页 + 一个空白对页，页数按 2×天数扩展
    const factor = document.header_parity === "both" ? 1 : 2;
    return Math.min(Math.max(days * factor, 1), pages);
  }
  return pages;
}

function dateModeError(section: Section): string | null {
  if (!(section.headerEnabled && section.headerStyle === "date")) return null;
  const { header_date, header_date_end } = section.document;
  if (!header_date || !header_date_end) return "页头日期模式需要同时填写开始和结束日期";
  if (String(header_date_end) < String(header_date)) return "页头日期模式的结束日期必须晚于或等于开始日期";
  return null;
}

function sectionRequest(section: Section, pageCount = effectivePages(section)): RenderSectionRequest {
  return { page: { ...section.page, header: section.headerEnabled ? section.page.header : 0, footer: section.footerEnabled ? section.page.footer : 0, binding: section.watermarkEnabled ? section.page.binding : 0, non_binding: section.nonBindingEnabled ? section.page.non_binding : 0 }, document: { ...section.document, page_count: pageCount, show_header: section.headerEnabled && section.headerStyle === "date", header_date: section.headerEnabled && section.headerStyle === "date" ? section.document.header_date : null, header_date_end: section.headerEnabled && section.headerStyle === "date" ? section.document.header_date_end || null : null, header_text: section.headerEnabled && section.headerStyle === "text" ? section.document.header_text || null : null, header_text_2: section.headerEnabled && section.headerStyle === "text" ? section.document.header_text_2 || null : null, footer_text: section.footerEnabled ? section.document.footer_text || null : null, footer_text_2: section.footerEnabled ? section.document.footer_text_2 || null : null, binding_text: section.watermarkEnabled ? section.document.binding_text || null : null, binding_text_2: section.watermarkEnabled ? section.document.binding_text_2 || null : null, non_binding_text: section.nonBindingEnabled ? section.document.non_binding_text || null : null, non_binding_text_2: section.nonBindingEnabled ? section.document.non_binding_text_2 || null : null }, pattern: cleanPattern(section.pattern) } as unknown as RenderSectionRequest;
}

function SortableSection({ section, index, update, remove }: { section: Section; index: number; update: (patch: Partial<Section>) => void; remove: () => void }) {
  const sortable = useSortable({ id: section.id });
  const [preview, setPreview] = useState(""); const [previewOpen, setPreviewOpen] = useState(false); const [previewing, setPreviewing] = useState(false); const [previewError, setPreviewError] = useState("");
  const previewRequest = JSON.stringify(sectionRequest(section, 2));
  useEffect(() => {
    if (!previewOpen) return;
    let stale = false;
    const timer = setTimeout(() => {
      setPreviewing(true); setPreviewError("");
      const dateErr = dateModeError(section);
      if (dateErr) { setPreviewing(false); setPreviewError(dateErr); return; }
      pyInvoke<string>("preview_section", JSON.parse(previewRequest)).then((pdf) => { if (!stale) setPreview(pdf); }, (error) => { if (!stale) setPreviewError(String(error)); }).finally(() => { if (!stale) setPreviewing(false); });
    }, 400);
    return () => { stale = true; clearTimeout(timer); };
  }, [previewOpen, previewRequest]);
  const doc = (key: string, value: Value) => update({ document: { ...section.document, [key]: value } });
  const page = (key: string, value: Value) => update({ page: { ...section.page, [key]: value } });
  const pattern = (key: string, value: Value) => update({ pattern: { ...section.pattern, [key]: value } });
  return <div ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}><Card className={cn("overflow-hidden", sortable.isDragging && "relative z-10 opacity-80 shadow-lg")}>
    <div className="flex items-center gap-2 p-3"><button className="cursor-grab touch-none rounded p-1.5 text-muted-foreground hover:bg-muted" aria-label={`拖动第 ${index + 1} 个卡片`} {...sortable.attributes} {...sortable.listeners}><GripVertical className="size-5" /></button><span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold">{index + 1}</span><button className="min-w-0 flex-1 text-left" onClick={() => update({ expanded: !section.expanded })}><span className="block truncate font-medium">#{index + 1}</span><span className="text-xs text-muted-foreground">{patternNames[section.pattern.kind]} · {section.pages} 页</span></button><Button variant="ghost" size="icon" aria-label={previewOpen ? "关闭预览" : "预览前 2 页"} onClick={() => setPreviewOpen((open) => !open)}><Eye /></Button><Button variant="ghost" size="icon" aria-label="展开或收起" onClick={() => update({ expanded: !section.expanded })}>{section.expanded ? <ChevronUp /> : <ChevronDown />}</Button><Button variant="ghost" size="icon" aria-label="删除卡片" onClick={remove}><Trash2 className="text-destructive" /></Button></div>
    {previewing && <p className="border-t bg-muted/30 p-3 text-center text-xs text-muted-foreground">正在渲染 2 页预览…</p>}
    {previewError && <p className="border-t bg-destructive/5 p-3 text-xs text-destructive">预览失败：{previewError}</p>}
    {preview && !previewing && <iframe title={`第 ${index + 1} 个卡片前 2 页预览`} src={`data:application/pdf;base64,${preview}`} className="h-96 w-full border-t bg-muted/30" />}
    {section.expanded && <CardContent className="grid gap-4 border-t bg-muted/30 pt-5 sm:grid-cols-2">
      <Field label="页数" value={section.pages} min={1} max={500} onChange={(pages) => update({ pages: Number(pages) })} />
      <Group title="页头" enabled={section.headerEnabled} onEnabled={(headerEnabled) => update({ headerEnabled })}><Field label="页头高度（mm）" value={section.page.header} min={0} step={0.5} onChange={(v) => page("header", v)} /><Select label="页头样式" value={section.headerStyle} options={[["date", "日期"], ["text", "水印文字"], ["none", "无样式（空白）"]]} onChange={(v) => update({ headerStyle: v as Section["headerStyle"] })} />{section.headerStyle === "date" && <><Field label="开始日期" value={section.document.header_date} type="date" onChange={(v) => doc("header_date", v)} /><Field label="结束日期" value={section.document.header_date_end ?? ""} type="date" onChange={(v) => doc("header_date_end", v || null)} /><Field label="日期格式（ICU）" value={section.document.header_date_format} type="text" onChange={(v) => doc("header_date_format", v)} /><Field label="语言地区" value={section.document.header_date_locale} type="text" onChange={(v) => doc("header_date_locale", v)} /><Select label="显示页" value={section.document.header_parity} options={[["both", "全部"], ["odd", "奇数页"], ["even", "偶数页"]]} onChange={(v) => doc("header_parity", v)} /><Select label="位置" value={section.document.header_date_position} options={[["center", "居中"], ["binding", "装订侧"], ["outer", "外侧"]]} onChange={(v) => doc("header_date_position", v)} /><Field label="字号（pt）" value={section.document.header_date_size} min={1} step={0.5} onChange={(v) => doc("header_date_size", v)} /></>}{section.headerStyle === "text" && <TextFields values={section.document} prefix="header_text" set={doc} />}<Field label="页头颜色" value={section.document.header_text_color} type="color" onChange={(v) => doc("header_text_color", v)} /></Group>
      <Group title="页脚" enabled={section.footerEnabled} onEnabled={(footerEnabled) => update({ footerEnabled })}><Field label="页脚高度（mm）" value={section.page.footer} min={5} step={0.5} onChange={(v) => page("footer", v)} /><TextFields values={section.document} prefix="footer_text" set={doc} /><Field label="页脚颜色" value={section.document.footer_text_color} type="color" onChange={(v) => doc("footer_text_color", v)} /></Group>
      <Group title="装订侧水印" enabled={section.watermarkEnabled} onEnabled={(watermarkEnabled) => update({ watermarkEnabled })}><Field label="装订侧宽度（mm）" value={section.page.binding} min={0} step={0.5} onChange={(v) => page("binding", v)} /><Field label="离边缘距离（mm，留空居中）" value={section.document.binding_text_edge} type="number" min={0} step={0.5} onChange={(v) => doc("binding_text_edge", Number(v) || null)} /><TextFields values={section.document} prefix="binding_text" set={doc} /><Field label="水印颜色" value={section.document.binding_text_color} type="color" onChange={(v) => doc("binding_text_color", v)} /></Group>
      <Group title="非装订侧水印" enabled={section.nonBindingEnabled} onEnabled={(nonBindingEnabled) => update({ nonBindingEnabled })}><Field label="非装订侧宽度（mm）" value={section.page.non_binding} min={0} step={0.5} onChange={(v) => page("non_binding", v)} /><Field label="离边缘距离（mm，留空居中）" value={section.document.non_binding_text_edge} type="number" min={0} step={0.5} onChange={(v) => doc("non_binding_text_edge", Number(v) || null)} /><TextFields values={section.document} prefix="non_binding_text" set={doc} /><Field label="水印颜色" value={section.document.non_binding_text_color} type="color" onChange={(v) => doc("non_binding_text_color", v)} /></Group>
      <section className="grid gap-4 rounded-lg border bg-background p-4 sm:col-span-2"><Select label="版式" value={section.pattern.kind} options={Object.entries(patternNames)} onChange={(kind) => update({ pattern: { ...defaults[kind as PatternKind] } })} /><div className="grid gap-4 border-t pt-4 sm:grid-cols-2"><PatternFields section={section} set={pattern} /></div></section>
    </CardContent>}
  </Card></div>;
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
  if (pattern.kind === "basic" && Number(pattern.margin_x) <= 0) return { ...pattern, margin_x: null };
  if (pattern.kind !== "timeline") return pattern;
  return { ...pattern, latitude: pattern.latitude ?? null, longitude: pattern.longitude ?? null, timezone: pattern.timezone || null };
}

export default function App() {
  const saved = useRef(loadJSON<{ sections?: Section[]; binding?: "booklet" | "thread" | null; sheetsPerGroup?: number; size?: { width: number; height: number }; pageSize?: string } | null>("base6.state", null)).current;
  const [sections, setSections] = useState<Section[]>(saved?.sections ?? [newSection()]);
  const [binding, setBinding] = useState<"booklet" | "thread" | null>(saved?.binding ?? "booklet");
  const [size, setSize] = useState(saved?.size ?? { width: 148, height: 210 });
  const [pageSize, setPageSize] = useState(saved?.pageSize ?? "A5");
  const [fontOptions, setFontOptions] = useState<[string, string][]>(FONT_OPTIONS);
  useEffect(() => {
    pyInvoke<string>("list_system_fonts").then((json) => {
      const names = JSON.parse(json) as string[];
      if (names.length) setFontOptions((base) => [...base, ...names.map((n) => [n, n] as [string, string])]);
    }).catch(() => { /* 保持三个字族兑底 */ });
  }, []);
  const applySize = (w: number, h: number) => { setSize({ width: w, height: h }); setSections((items) => items.map((s) => ({ ...s, page: { ...s.page, width: w, height: h } }))); };
  const [sheetsPerGroup, setSheetsPerGroup] = useState(saved?.sheetsPerGroup ?? 4); const [status, setStatus] = useState(""); const [running, setRunning] = useState(false);
  useEffect(() => {
    localStorage.setItem("base6.state", JSON.stringify({ sections, binding, sheetsPerGroup, size, pageSize }));
  }, [sections, binding, sheetsPerGroup, size, pageSize]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const update = (id: string, patch: Partial<Section>) => setSections((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  function dragEnd({ active, over }: DragEndEvent) { if (!over || active.id === over.id) return; setSections((items) => arrayMove(items, items.findIndex(({ id }) => id === active.id), items.findIndex(({ id }) => id === over.id))); }
  async function exportPreset() {
    const output = await save({ title: "导出预设", defaultPath: "base6-preset.json", filters: [{ name: "JSON", extensions: ["json"] }] });
    if (!output) return;
    try {
      await pyInvoke<string>("write_text_file", { path: output, content: JSON.stringify({ sections, binding, sheetsPerGroup, size, pageSize }, null, 2) });
      setStatus("预设已导出");
    } catch (error) { setStatus(`导出失败：${String(error)}`); }
  }
  async function importPreset() {
    const input = await open({ multiple: false, filters: [{ name: "JSON", extensions: ["json"] }] });
    if (!input || Array.isArray(input)) return;
    try {
      const content = await pyInvoke<string>("read_text_file", { path: input });
      const data = JSON.parse(content) as { sections?: unknown; binding?: unknown; sheetsPerGroup?: unknown; size?: unknown; pageSize?: unknown };
      if (!data || !Array.isArray(data.sections)) { setStatus("预设文件格式不正确"); return; }
      setSections(data.sections as Section[]);
      if (data.binding === "booklet" || data.binding === "thread" || data.binding === null) setBinding(data.binding);
      if (typeof data.sheetsPerGroup === "number") setSheetsPerGroup(data.sheetsPerGroup);
      if (data.size && typeof data.size === "object" && "width" in data.size && "height" in data.size) setSize(data.size as { width: number; height: number });
      if (typeof data.pageSize === "string") setPageSize(data.pageSize);
      setStatus("预设已导入");
    } catch (error) { setStatus(`导入失败：${String(error)}`); }
  }
  async function generate() {
    const output = await save({ title: "生成手帐 PDF", defaultPath: "base6-techo.pdf", filters: [{ name: "PDF", extensions: ["pdf"] }] }); if (!output) return;
    for (const section of sections) {
      const err = dateModeError(section);
      if (err) { setStatus(err); return; }
    }
    setRunning(true); setStatus("正在排版并生成 PDF…");
    try {
      const request = { output, sections: sections.map((section) => sectionRequest(section)), bind: { mode: binding, sheets_per_group: sheetsPerGroup } } as unknown as RunPipelineRequest;
      setStatus(`已生成：${await pyInvoke<string>("run_pipeline", request)}`);
    } catch (error) { setStatus(`生成失败：${String(error)}`); } finally { setRunning(false); }
  }
  return <main className="mx-auto max-w-6xl p-5 sm:p-8"><header className="mb-8"><p className="mb-2 text-sm font-medium text-primary">BASE 6 TECHO</p><h1 className="text-3xl font-semibold tracking-tight">编排你的手帐</h1><p className="mt-2 text-muted-foreground">配置并排序 Sessions，最后选择装订方式。</p></header><div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]"><section className="grid gap-3"><div className="mb-1 flex items-center justify-between"><h2 className="text-lg font-semibold">Sessions</h2><Button variant="outline" onClick={() => setSections((items) => [...items, newSection(size.width, size.height)])}><Plus />添加</Button></div><DndContext sensors={sensors} onDragEnd={dragEnd}><SortableContext items={sections.map(({ id }) => id)} strategy={verticalListSortingStrategy}>{sections.map((section, index) => <SortableSection key={section.id} section={section} index={index} update={(patch) => update(section.id, patch)} remove={() => setSections((items) => items.filter(({ id }) => id !== section.id))} />)}</SortableContext></DndContext>{sections.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">至少添加一个 Session。</div>}</section><Card className="lg:sticky lg:top-8"><CardHeader><CardTitle>最后：选择装订</CardTitle></CardHeader><CardContent className="grid gap-4"><div className="grid gap-3 border-b pb-4"><Select label="页面大小" value={pageSize} options={[["A5", "A5（148 × 210 mm）"], ["A6", "A6（105 × 148 mm）"], ["A7", "A7（74 × 105 mm）"], ["B5", "B5（176 × 250 mm）"], ["B6", "B6（125 × 176 mm）"], ["custom", "自定义"]]} onChange={(v) => { setPageSize(v); if (v !== "custom") { const [w, h] = PAGE_SIZES[v]; applySize(w, h); } }} />{pageSize === "custom" && <><Field label="宽度（mm）" value={size.width} min={10} step={0.5} onChange={(v) => applySize(Number(v), size.height)} /><Field label="高度（mm）" value={size.height} min={10} step={0.5} onChange={(v) => applySize(size.width, Number(v))} /></>}<FontPicker value={String(sections[0]?.document.binding_text_font ?? String.raw`\sffamily`)} options={fontOptions} onChange={(v) => setSections((items) => items.map((s) => ({ ...s, document: { ...s.document, binding_text_font: v } })))} /></div>{([{ value: "booklet", title: "骑马钉", hint: "整本按 4 页补齐并拼版" }, { value: "thread", title: "锁线分册", hint: "按每帖纸张数分组拼版" }, { value: null, title: "不拼版", hint: "保持页面顺序输出" }] as const).map((option) => <button key={option.title} className={cn("rounded-lg border p-3 text-left", binding === option.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted")} onClick={() => setBinding(option.value)}><span className="block text-sm font-medium">{option.title}</span><span className="mt-1 block text-xs text-muted-foreground">{option.hint}</span></button>)}{binding === "thread" && <Field label="每帖纸张数" value={sheetsPerGroup} min={1} onChange={(value) => setSheetsPerGroup(Number(value))} />}<div className="border-t pt-4 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Sessions</span><span>{sections.length}</span></div><div className="mt-2 flex justify-between"><span className="text-muted-foreground">成品页数</span><span>{sections.reduce((sum, section) => sum + effectivePages(section), 0)}</span></div></div><div className="flex gap-2"><Button variant="outline" size="sm" className="flex-1" onClick={exportPreset}><Download />导出预设</Button><Button variant="outline" size="sm" className="flex-1" onClick={importPreset}><Upload />导入预设</Button></div><Button size="lg" disabled={running || !sections.length} onClick={generate}><FileDown />{running ? "生成中…" : "选择位置并生成"}</Button>{status && <p className="break-all rounded-md bg-muted p-3 text-xs text-muted-foreground" role="status">{status}</p>}</CardContent></Card></div></main>;
}
