import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { save } from "@tauri-apps/plugin-dialog";
import { ChevronDown, ChevronUp, Eye, FileDown, GripVertical, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { pyInvoke } from "tauri-plugin-pytauri-api";
import type { RenderSectionRequest, RunPipelineRequest } from "./pipeline-request.generated";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
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

const defaults: Record<PatternKind, Values & { kind: PatternKind }> = {
  basic: { kind: "basic", spacing: 8, line_width: 0.2, line_color: "#b0b0b0", draw_hlines: true, draw_vlines: false, draw_dots: false, hline_edge_color: "#b0b0b0", hline_edge_width: 0.2, vline_edge_color: "#b0b0b0", vline_edge_width: 0.2, dot_center_color: "#b0b0b0", hline_header: false, hline_footer: false, hline_inner: false, hline_outer: false, vline_header: false, vline_footer: false, vline_inner: false, vline_outer: false, dot_header: false, dot_footer: false, dot_inner: false, dot_outer: false, dot_spacing: 8, dot_radius: 0.3, margin_x: 0, margin_color: "#b0b0b0", vline_spacing: 8 },
  midori: { kind: "midori", spacing: 5, gap: 1, edge_extension: 1.2, dot_frequency: 10, dot_radius: 0.4, line_width: 0.7, line_color: "#99ffff", dot_color: "#99ffff", header: false, footer: false, inner: false, outer: false },
  timeline: { kind: "timeline", start: 0, end: 26, pages: 1, swap: false, line_color: "#7a7a7a", line_width: 1.138, label_size: 10.2, city_name: "", latitude: "", longitude: "", timezone: "", daylight_color: "#e5b93f", night_color: "#496a9f" },
};

function newSection(): Section {
  return {
    id: crypto.randomUUID(), expanded: true, pages: 32,
    headerEnabled: false, footerEnabled: false,
    page: { width: 148, height: 210, header: 10, footer: 10, binding: 15, non_binding: 8 },
    document: { header_date: new Date().toISOString().slice(0, 10), header_date_end: null, header_date_format: "yyyy-MM-dd", header_date_locale: "zh_CN", header_parity: "both", header_date_size: 8, header_date_position: "center", binding_text: "", binding_text_2: "", binding_text_size: 8, binding_text_2_size: 8, binding_text_spacing: 5, header_text: "", header_text_2: "", header_text_size: 8, header_text_2_size: 8, header_text_spacing: 5, footer_text: "", footer_text_2: "", footer_text_size: 8, footer_text_2_size: 8, footer_text_spacing: 5, non_binding_text: "", non_binding_text_2: "", non_binding_text_size: 8, non_binding_text_2_size: 8, non_binding_text_spacing: 5 },
    watermarkEnabled: false, nonBindingEnabled: false,
    headerStyle: "date",
    pattern: { ...defaults.basic },
  };
}

function Field({ label, value, type = "number", min, max, step, placeholder, onChange }: { label: string; value: Value; type?: string; min?: number; max?: number; step?: number; placeholder?: string; onChange: (value: Value) => void }) {
  if (type === "checkbox") return <label className="flex cursor-pointer items-center gap-2 text-sm"><input className="size-4 accent-primary" type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
  if (type === "color") return <label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">{label}</span><span className="flex h-9 items-center gap-2 rounded-md border bg-background px-2"><input type="color" value={String(value)} onChange={(event) => onChange(event.target.value)} className="h-6 w-8" /><span className="text-xs">{String(value)}</span></span></label>;
  if (type === "date") return <label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">{label}</span><Input type="date" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} /></label>;
  return <label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">{label}</span><Input type={type} value={String(value ?? "")} min={min} max={max} step={step} placeholder={placeholder} onChange={(event) => onChange(type === "number" ? Number(event.target.value) : event.target.value)} /></label>;
}
function Select({ label, value, options, onChange }: { label: string; value: Value; options: [string | number, string][]; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">{label}</span><select className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={String(value)} onChange={(event) => onChange(event.target.value)}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
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
    <Field label="起始小时" value={p.start} min={0} max={25} onChange={(v) => set("start", v)} /><Field label="结束小时" value={p.end} min={1} max={26} onChange={(v) => set("end", v)} /><Select label="跨页" value={p.pages} options={[[1, "单页"], [2, "左右双页"]]} onChange={(v) => set("pages", Number(v))} /><div className="flex items-end pb-2"><Field label="交换左右页" value={p.swap} type="checkbox" onChange={(v) => set("swap", v)} /></div><Field label="线条颜色" value={p.line_color} type="color" onChange={(v) => set("line_color", v)} /><Field label="线宽" value={p.line_width} min={0.01} step={0.05} onChange={(v) => set("line_width", v)} /><Field label="标签字号（pt）" value={p.label_size} min={1} step={0.1} onChange={(v) => set("label_size", v)} /><Field label="城市（留空则不绘制日照）" value={p.city_name} type="text" onChange={(v) => set("city_name", v)} />
    {p.city_name && <><Field label="纬度" value={p.latitude} type="number" min={-90} max={90} onChange={(v) => set("latitude", v)} /><Field label="经度" value={p.longitude} type="number" min={-180} max={180} onChange={(v) => set("longitude", v)} /><Field label="时区" value={p.timezone} type="text" placeholder="Asia/Shanghai" onChange={(v) => set("timezone", v)} /><Field label="日照颜色" value={p.daylight_color} type="color" onChange={(v) => set("daylight_color", v)} /><Field label="夜间颜色" value={p.night_color} type="color" onChange={(v) => set("night_color", v)} /></>}
  </>;
}

function sectionRequest(section: Section, pageCount = section.pages): RenderSectionRequest {
  return { page: { ...section.page, header: section.headerEnabled ? section.page.header : 0, footer: section.footerEnabled ? section.page.footer : 0 }, document: { ...section.document, page_count: pageCount, show_header: section.headerEnabled && section.headerStyle === "date", header_date: section.headerEnabled && section.headerStyle === "date" ? section.document.header_date : null, header_date_end: section.headerEnabled && section.headerStyle === "date" ? section.document.header_date_end || null : null, header_text: section.headerEnabled && section.headerStyle === "text" ? section.document.header_text || null : null, header_text_2: section.headerEnabled && section.headerStyle === "text" ? section.document.header_text_2 || null : null, footer_text: section.footerEnabled ? section.document.footer_text || null : null, footer_text_2: section.footerEnabled ? section.document.footer_text_2 || null : null, binding_text: section.watermarkEnabled ? section.document.binding_text || null : null, binding_text_2: section.watermarkEnabled ? section.document.binding_text_2 || null : null, non_binding_text: section.nonBindingEnabled ? section.document.non_binding_text || null : null, non_binding_text_2: section.nonBindingEnabled ? section.document.non_binding_text_2 || null : null }, pattern: cleanPattern(section.pattern) } as unknown as RenderSectionRequest;
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
      <Group title="页头" enabled={section.headerEnabled} onEnabled={(headerEnabled) => update({ headerEnabled })}><Field label="页头高度（mm）" value={section.page.header} min={0} step={0.5} onChange={(v) => page("header", v)} /><Select label="页头样式" value={section.headerStyle} options={[["date", "日期"], ["text", "水印文字"], ["none", "无样式（空白）"]]} onChange={(v) => update({ headerStyle: v as Section["headerStyle"] })} />{section.headerStyle === "date" && <><Field label="开始日期" value={section.document.header_date} type="date" onChange={(v) => doc("header_date", v)} /><Field label="结束日期（可选）" value={section.document.header_date_end ?? ""} type="date" onChange={(v) => doc("header_date_end", v || null)} /><Field label="日期格式（ICU）" value={section.document.header_date_format} type="text" onChange={(v) => doc("header_date_format", v)} /><Field label="语言地区" value={section.document.header_date_locale} type="text" onChange={(v) => doc("header_date_locale", v)} /><Select label="显示页" value={section.document.header_parity} options={[["both", "全部"], ["odd", "奇数页"], ["even", "偶数页"]]} onChange={(v) => doc("header_parity", v)} /><Select label="位置" value={section.document.header_date_position} options={[["center", "居中"], ["binding", "装订侧"], ["outer", "外侧"]]} onChange={(v) => doc("header_date_position", v)} /><Field label="字号（pt）" value={section.document.header_date_size} min={1} step={0.5} onChange={(v) => doc("header_date_size", v)} /></>}{section.headerStyle === "text" && <TextFields values={section.document} prefix="header_text" set={doc} />}</Group>
      <Group title="页脚" enabled={section.footerEnabled} onEnabled={(footerEnabled) => update({ footerEnabled })}><Field label="页脚高度（mm）" value={section.page.footer} min={5} step={0.5} onChange={(v) => page("footer", v)} /><TextFields values={section.document} prefix="footer_text" set={doc} /></Group>
      <Group title="装订侧水印" enabled={section.watermarkEnabled} onEnabled={(watermarkEnabled) => update({ watermarkEnabled })}><Field label="装订侧宽度（mm）" value={section.page.binding} min={0} step={0.5} onChange={(v) => page("binding", v)} /><TextFields values={section.document} prefix="binding_text" set={doc} /></Group>
      <Group title="非装订侧水印" enabled={section.nonBindingEnabled} onEnabled={(nonBindingEnabled) => update({ nonBindingEnabled })}><Field label="非装订侧宽度（mm）" value={section.page.non_binding} min={0} step={0.5} onChange={(v) => page("non_binding", v)} /><TextFields values={section.document} prefix="non_binding_text" set={doc} /></Group>
      <section className="grid gap-4 rounded-lg border bg-background p-4 sm:col-span-2"><Select label="版式" value={section.pattern.kind} options={Object.entries(patternNames)} onChange={(kind) => update({ pattern: { ...defaults[kind as PatternKind] } })} /><div className="grid gap-4 border-t pt-4 sm:grid-cols-2"><PatternFields section={section} set={pattern} /></div></section>
    </CardContent>}
  </Card></div>;
}

function cleanPattern(pattern: Section["pattern"]) {
  if (pattern.kind === "basic" && Number(pattern.margin_x) <= 0) return { ...pattern, margin_x: null };
  if (pattern.kind !== "timeline" || pattern.city_name) return pattern;
  return { ...pattern, city_name: null, latitude: null, longitude: null, timezone: null };
}

export default function App() {
  const [sections, setSections] = useState<Section[]>([newSection()]);
  const [binding, setBinding] = useState<"booklet" | "thread" | null>("booklet");
  const [sheetsPerGroup, setSheetsPerGroup] = useState(4); const [status, setStatus] = useState(""); const [running, setRunning] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const update = (id: string, patch: Partial<Section>) => setSections((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  function dragEnd({ active, over }: DragEndEvent) { if (!over || active.id === over.id) return; setSections((items) => arrayMove(items, items.findIndex(({ id }) => id === active.id), items.findIndex(({ id }) => id === over.id))); }
  async function generate() {
    const output = await save({ title: "生成手帐 PDF", defaultPath: "base6-techo.pdf", filters: [{ name: "PDF", extensions: ["pdf"] }] }); if (!output) return;
    setRunning(true); setStatus("正在排版并生成 PDF…");
    const request = { output, sections: sections.map((section) => sectionRequest(section)), bind: { mode: binding, sheets_per_group: sheetsPerGroup } } as unknown as RunPipelineRequest;
    try { setStatus(`已生成：${await pyInvoke<string>("run_pipeline", request)}`); } catch (error) { setStatus(`生成失败：${String(error)}`); } finally { setRunning(false); }
  }
  return <main className="mx-auto max-w-6xl p-5 sm:p-8"><header className="mb-8"><p className="mb-2 text-sm font-medium text-primary">BASE 6 TECHO</p><h1 className="text-3xl font-semibold tracking-tight">编排你的手帐</h1><p className="mt-2 text-muted-foreground">配置并排序 Sessions，最后选择装订方式。</p></header><div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]"><section className="grid gap-3"><div className="mb-1 flex items-center justify-between"><h2 className="text-lg font-semibold">Sessions</h2><Button variant="outline" onClick={() => setSections((items) => [...items, newSection()])}><Plus />添加</Button></div><DndContext sensors={sensors} onDragEnd={dragEnd}><SortableContext items={sections.map(({ id }) => id)} strategy={verticalListSortingStrategy}>{sections.map((section, index) => <SortableSection key={section.id} section={section} index={index} update={(patch) => update(section.id, patch)} remove={() => setSections((items) => items.filter(({ id }) => id !== section.id))} />)}</SortableContext></DndContext>{sections.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">至少添加一个 Session。</div>}</section><Card className="lg:sticky lg:top-8"><CardHeader><CardTitle>最后：选择装订</CardTitle></CardHeader><CardContent className="grid gap-4">{([{ value: "booklet", title: "骑马钉", hint: "整本按 4 页补齐并拼版" }, { value: "thread", title: "锁线分册", hint: "按每帖纸张数分组拼版" }, { value: null, title: "不拼版", hint: "保持 A5 页面顺序输出" }] as const).map((option) => <button key={option.title} className={cn("rounded-lg border p-3 text-left", binding === option.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted")} onClick={() => setBinding(option.value)}><span className="block text-sm font-medium">{option.title}</span><span className="mt-1 block text-xs text-muted-foreground">{option.hint}</span></button>)}{binding === "thread" && <Field label="每帖纸张数" value={sheetsPerGroup} min={1} onChange={(value) => setSheetsPerGroup(Number(value))} />}<div className="border-t pt-4 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Sessions</span><span>{sections.length}</span></div><div className="mt-2 flex justify-between"><span className="text-muted-foreground">成品页数</span><span>{sections.reduce((sum, section) => sum + section.pages, 0)}</span></div></div><Button size="lg" disabled={running || !sections.length} onClick={generate}><FileDown />{running ? "生成中…" : "选择位置并生成"}</Button>{status && <p className="break-all rounded-md bg-muted p-3 text-xs text-muted-foreground" role="status">{status}</p>}</CardContent></Card></div></main>;
}
