import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import {
  DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  AppBar, Box, Button, Card, CardContent, Divider, IconButton, MenuItem, Stack, TextField, Toolbar, Typography,
} from "@mui/material";
import { Add, Delete, Download, FileDownload, Refresh, Upload, Visibility } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type { PatternKind, Section } from "./lib/schema";
import {
  FONT_OPTIONS, PAGE_SIZES, margins, newSection,
} from "./lib/schema";
import { effectivePages, loadJSON, sectionRequest, renderToSection, isRenderRequest } from "./lib/utils";
import { parseICS } from "./lib/ics-parser";
import { LANG_OPTIONS, changeAppLanguage } from "./i18n";
import { Field, FontPicker, SelectField } from "./components/controls";
import { SectionCard } from "./components/SectionCard";

function Panel({ title, description, action, children }: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ overflow: "hidden" }}>
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "rgba(45,54,64,0.025)",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{title}</Typography>
          {description && (
            <Typography variant="caption" color="text.secondary">{description}</Typography>
          )}
        </Box>
        {action}
      </Box>
      <CardContent sx={{ display: "grid", gap: 2 }}>{children}</CardContent>
    </Card>
  );
}


// 老版本 kind 命名迁移：year→year-calendar、month→month-calendar、tracker→month-tracker、month-tracker→year-tracker。
const MIGRATE_KIND: Record<string, string> = {
  year: "year-calendar",
  month: "month-calendar",
  tracker: "month-tracker",
  "month-tracker": "year-tracker",
};
function migrateSections(sections?: Section[]): Section[] {
  if (!sections) return [newSection()];
  return sections.map((s) => {
    const kind = MIGRATE_KIND[String(s.pattern.kind)];
    return kind && kind !== s.pattern.kind
      ? { ...s, pattern: { ...s.pattern, kind: kind as PatternKind } }
      : s;
  });
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

  const [sections, setSections] = useState<Section[]>(migrateSections(saved?.sections));
  const [binding, setBinding] = useState<"booklet" | "thread" | null>(saved?.binding ?? null);
  const [size, setSize] = useState(saved?.size ?? { width: 148, height: 210 });
  const [pageSize, setPageSize] = useState(saved?.pageSize ?? "A5");
  const [holidays, setHolidays] = useState<Record<string, string>>(saved?.holidays ?? {});
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [sheetsPerGroup, setSheetsPerGroup] = useState(saved?.sheetsPerGroup ?? 4);
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);
  const [latexLog, setLatexLog] = useState("");
  const [preview, setPreview] = useState<{ open: boolean; data: string; busy: boolean; error: string }>(
    { open: false, data: "", busy: false, error: "" },
  );
  const { t, i18n } = useTranslation();

  useEffect(() => {
    invoke<string>("list_system_fonts")
      .then((json) => {
        const names = JSON.parse(json) as string[];
        if (names.length) setSystemFonts(names);
      })
      .catch(() => { /* 保持三个字族兜底 */ });
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<string>("latex-log", ({ payload }) => setLatexLog((log) => `${log}${payload}\n`)).then((stop) => {
      unlisten = stop;
    });
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("base6.state", JSON.stringify({ sections, binding, sheetsPerGroup, size, pageSize, holidays }));
    } catch { /* ponytail: 隐私模式禁写，状态不持久化即可 */ }
  }, [sections, binding, sheetsPerGroup, size, pageSize, holidays]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const update = useCallback(
    (id: string, patch: Partial<Section>) =>
      setSections((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item))),
    [],
  );
  const removeSection = useCallback(
    (id: string) => startTransition(() => setSections((items) => items.filter(({ id: itemId }) => itemId !== id))),
    [],
  );

  function applySize(w: number, h: number) {
    setSize({ width: w, height: h });
    setSections((items) => items.map((s) => ({ ...s, page: { ...s.page, width: w, height: h, ...margins(w, h) } })));
  }

  function dragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    startTransition(() =>
      setSections((items) =>
        arrayMove(
          items,
          items.findIndex(({ id }) => id === active.id),
          items.findIndex(({ id }) => id === over.id),
        ),
      ),
    );
  }

  const totalPages = useMemo(() => sections.reduce((sum, s) => sum + effectivePages(s), 0), [sections]);

  // 内置三字族标签经翻译，系统字体名原样展示。
  const fontOptions = useMemo<[string, string][]>(
    () => [
      ...FONT_OPTIONS.map(([v, k]) => [v, t(k)] as [string, string]),
      ...systemFonts.map((n) => [n, n] as [string, string]),
    ],
    [t, systemFonts],
  );

  const pageSizeOptions = useMemo<[string, string][]>(
    () => [
      ...Object.entries(PAGE_SIZES).map(([k, [w, h]]) => {
        const name = k === "A5S/TN 标准" ? t("paper.a5sTn") : k === "TN护照" ? t("paper.tnPassport") : k;
        return [k, t("paper.label", { name, w, h })] as [string, string];
      }),
      ["custom", t("paper.custom")],
    ],
    [t],
  );

  async function exportPreset() {
    const output = await save({
      title: t("dialog.exportPreset"),
      defaultPath: "base6-preset.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!output) return;
    try {
      await invoke<string>("write_text_file", {
        path: output,
        content: JSON.stringify({ sections, binding, sheetsPerGroup, size, pageSize, holidays }, null, 2),
      });
      setStatus(t("status.presetExported"));
    } catch (error) {
      setStatus(t("status.exportFailed", { error: String(error) }));
    }
  }

  async function importPreset() {
    const input = await open({ multiple: false, filters: [{ name: "JSON", extensions: ["json"] }] });
    if (!input || Array.isArray(input)) return;
    try {
      const content = await invoke<string>("read_text_file", { path: input });
      const data: unknown = JSON.parse(content);
      const obj = (data ?? {}) as Record<string, unknown>;
      if (!Array.isArray(obj.sections)) {
        setStatus(t("status.badPresetFormat"));
        return;
      }
      // 支持两种格式：桌面应用导出的预设（前端 Section），或 gen-examples.py
      // 生成的后端请求 JSON（展示页下载的版本）。
      if (isRenderRequest(obj)) {
        const raw = obj as {
          sections: Record<string, unknown>[];
          bind?: { mode?: unknown; sheets_per_group?: unknown };
          holidays?: unknown;
        };
        setSections(raw.sections.map((rs) => renderToSection(rs)));
        const { mode, sheets_per_group } = raw.bind ?? {};
        if (mode === "booklet" || mode === "thread" || mode === null) setBinding(mode);
        if (typeof sheets_per_group === "number") setSheetsPerGroup(sheets_per_group);
        if (raw.holidays && typeof raw.holidays === "object")
          setHolidays(raw.holidays as Record<string, string>);
        setStatus(t("status.sampleImported"));
      } else {
        const preset = obj as {
          sections: Section[];
          binding?: unknown;
          sheetsPerGroup?: unknown;
          size?: unknown;
          pageSize?: unknown;
          holidays?: unknown;
        };
        setSections(preset.sections);
        if (preset.binding === "booklet" || preset.binding === "thread" || preset.binding === null)
          setBinding(preset.binding);
        if (typeof preset.sheetsPerGroup === "number") setSheetsPerGroup(preset.sheetsPerGroup);
        if (preset.size && typeof preset.size === "object" && "width" in preset.size && "height" in preset.size)
          setSize(preset.size as { width: number; height: number });
        if (typeof preset.pageSize === "string") setPageSize(preset.pageSize);
        if (preset.holidays && typeof preset.holidays === "object")
          setHolidays(preset.holidays as Record<string, string>);
        setStatus(t("status.presetImported"));
      }
    } catch (error) {
      setStatus(t("status.importFailed", { error: String(error) }));
    }
  }

  async function importICS() {
    try {
      const path = await open({
        title: t("dialog.chooseIcs"),
        filters: [{ name: t("filter.ics"), extensions: ["ics", "ical"] }],
        multiple: false,
      });
      if (!path) return;
      const content = await invoke<string>("read_text_file", { path });
      const parsed = parseICS(content);
      setHolidays(parsed);
      setStatus(t("status.holidaysImported", { count: Object.keys(parsed).length }));
    } catch (error) {
      setStatus(t("status.importFailed", { error: String(error) }));
    }
  }

  function buildRequest(output: string) {
    return {
      output,
      sections: sections.map((section) => sectionRequest(section, holidays)),
      bind: { mode: binding, sheets_per_group: sheetsPerGroup },
    };
  }

  async function generate() {
    const output = await save({
      title: t("dialog.generatePdf"),
      defaultPath: "base6-techo.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!output) return;
    setRunning(true);
    setLatexLog("");
    setStatus(t("status.typesetting"));
    try {
      const result = await invoke<string>("run_pipeline", { body: buildRequest(output) });
      setStatus(t("status.generated", { path: result }));
    } catch (error) {
      setStatus(t("status.generateFailed", { error: String(error) }));
    } finally {
      setRunning(false);
    }
  }

  async function previewDocument(rerender = false) {
    if (preview.open && !rerender) {
      startTransition(() => setPreview((p) => ({ ...p, open: false })));
      return;
    }
    setPreview({ open: true, data: "", busy: true, error: "" });
    setLatexLog("");
    try {
      const data = await invoke<string>("preview_document", { body: buildRequest("") });
      startTransition(() => setPreview({ open: true, data, busy: false, error: "" }));
    } catch (error) {
      setPreview({ open: true, data: "", busy: false, error: String(error) });
    }
  }

  const busy = running || preview.busy;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
        <Toolbar sx={{ maxWidth: 1240, width: "100%", mx: "auto", px: { xs: 2, md: 3 }, minHeight: { xs: 56, sm: 64 } }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "baseline" }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 500,
                letterSpacing: "0.12em",
                fontFamily: '"Songti SC", "Noto Serif CJK SC", "SimSun", serif',
                fontSize: "1.15rem",
              }}
            >
              base<span>6</span> <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>· techo</Box>
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", letterSpacing: "0.22em", fontFamily: "monospace", display: { xs: "none", sm: "block" } }}>
              {t("app.tagline")}
            </Typography>
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={1}>
            <TextField
              select
              size="small"
              value={i18n.language.startsWith("zh") ? "zh-CN" : "en"}
              onChange={(e) => changeAppLanguage(e.target.value)}
              aria-label={t("app.language")}
              sx={{ width: 112 }}
            >
              {LANG_OPTIONS.map(([value, label]) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </TextField>
            <IconButton size="small" title={t("toolbar.exportPreset")} aria-label={t("toolbar.exportPreset")} onClick={exportPreset}>
              <Download fontSize="small" />
            </IconButton>
            <IconButton size="small" title={t("toolbar.importPreset")} aria-label={t("toolbar.importPresetShort")} onClick={importPreset}>
              <Upload fontSize="small" />
            </IconButton>
            <Button
              variant="outlined"
              startIcon={preview.busy ? <Refresh sx={{ animation: "spin 1s linear infinite" }} /> : <Visibility />}
              disabled={busy || !sections.length}
              onClick={() => previewDocument(true)}
            >
              {preview.busy ? t("action.rendering") : preview.open ? t("action.refreshPreview") : t("action.preview")}
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={running ? <Refresh sx={{ animation: "spin 1s linear infinite" }} /> : <FileDownload />}
              disabled={busy || !sections.length}
              onClick={generate}
            >
              {running ? t("action.generating") : t("action.generatePdf")}
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box sx={{ maxWidth: 1240, width: "100%", mx: "auto", px: { xs: 2, md: 3 }, py: 3 }}>
        <Box sx={{ display: "grid", gap: 3, alignItems: "start", gridTemplateColumns: { lg: "1fr 340px" } }}>
          {/* 主区：预览 + 版面列表 */}
          <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
            {preview.open && (
              <Box sx={{ overflow: "hidden", borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "action.hover" }}>
                {preview.busy ? (
                  <Box sx={{ height: "72vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
                    <Refresh sx={{ animation: "spin 1s linear infinite" }} />
                    <Box component="pre" sx={{ maxHeight: 256, width: "100%", overflow: "auto", whiteSpace: "pre-wrap", px: 3, fontSize: 12 }}>
                      {latexLog || t("status.startingLatex")}
                    </Box>
                    <Typography variant="body2" color="text.secondary">{t("status.renderingPreview")}</Typography>
                  </Box>
                ) : preview.error ? (
                  <Typography color="error" sx={{ p: 3, fontSize: 12 }}>{t("status.previewFailed", { error: preview.error })}</Typography>
                ) : (
                  <iframe title={t("layout.fullPreview")} src={`data:application/pdf;base64,${preview.data}`} style={{ display: "block", width: "100%", height: "72vh", border: 0 }} />
                )}
              </Box>
            )}

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Stack spacing={0.25}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t("layout.title")}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("layout.summary", { count: sections.length, pages: totalPages })}
                </Typography>
              </Stack>
              <Button
                startIcon={<Add />}
                onClick={() => startTransition(() => setSections((items) => [...items, newSection(size.width, size.height)]))}
              >
                {t("action.addSection")}
              </Button>
            </Box>

            <DndContext sensors={sensors} onDragEnd={dragEnd}>
              <SortableContext items={sections.map(({ id }) => id)} strategy={verticalListSortingStrategy}>
                <Box sx={{ display: "grid", gap: 2 }}>
                  {sections.map((section, index) => (
                    <SectionCard key={section.id} section={section} index={index} update={update} remove={removeSection} />
                  ))}
                </Box>
              </SortableContext>
            </DndContext>
            {sections.length === 0 && (
              <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 10, textAlign: "center" }}>
                <Typography color="text.secondary">{t("layout.empty")}</Typography>
              </Box>
            )}
          </Box>

          {/* 侧栏：分组的设置面板 */}
          <Box sx={{ display: "grid", gap: 2.5, position: { lg: "sticky" }, top: 80 }}>
            <Panel title={t("panel.paper")} description={t("panel.paperDesc")}>
              <SelectField
                label={t("paper.pageSize")}
                value={pageSize}
                options={pageSizeOptions}
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
                  <Field label={t("paper.width")} value={size.width} min={10} step={0.5} onChange={(v) => applySize(Number(v), size.height)} />
                  <Field label={t("paper.height")} value={size.height} min={10} step={0.5} onChange={(v) => applySize(size.width, Number(v))} />
                </>
              )}
            </Panel>

            <Panel title={t("panel.binding")} description={t("panel.bindingDesc")}>
              {([
                { value: "booklet", title: t("binding.booklet"), hint: t("binding.bookletHint") },
                { value: "thread", title: t("binding.thread"), hint: t("binding.threadHint") },
                { value: null, title: t("binding.none"), hint: t("binding.noneHint") },
              ] as const).map((option) => (
                <Box
                  key={option.title}
                  onClick={() => setBinding(option.value)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: "1px solid",
                    borderColor: binding === option.value ? "secondary.main" : "divider",
                    borderRadius: 1.5,
                    p: 1.5,
                    cursor: "pointer",
                    bgcolor: binding === option.value ? "rgba(192,90,58,0.08)" : "transparent",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: "medium" }}>{option.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{option.hint}</Typography>
                  </Box>
                  {binding === option.value && (
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "secondary.main" }} />
                  )}
                </Box>
              ))}
              {binding === "thread" && (
                <Field label={t("binding.sheetsPerGroup")} value={sheetsPerGroup} min={1} onChange={(v) => setSheetsPerGroup(Number(v))} />
              )}
            </Panel>

            <Panel title={t("panel.marginText")} description={t("panel.marginTextDesc")}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Button size="small" startIcon={<Upload />} disabled={running} onClick={importICS}>
                  {t("action.importIcs")}
                </Button>
                {Object.keys(holidays).length > 0 && (
                  <IconButton size="small" onClick={() => setHolidays({})} aria-label={t("action.clearHolidays")}>
                    <Delete />
                  </IconButton>
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                {t("margin.holidaysHint", { count: Object.keys(holidays).length })}
              </Typography>
              <Divider />
              <Typography variant="caption" color="text.secondary">{t("margin.font")}</Typography>
              <FontPicker
                value={String(sections[0]?.document.binding_text_font ?? String.raw`\sffamily`)}
                options={fontOptions}
                onChange={(v) =>
                  setSections((items) =>
                    items.map((s) => ({ ...s, document: { ...s.document, binding_text_font: v } })),
                  )
                }
              />
            </Panel>


            <Panel title={t("panel.status")}>
              <Box sx={{ display: "grid", gap: 0.5 }}>
                <Typography variant="body2" sx={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{t("stats.sections")}</span><span>{sections.length}</span>
                </Typography>
                <Typography variant="body2" sx={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{t("stats.totalPages")}</span><span>{totalPages}</span>
                </Typography>
              </Box>
              {status && (
                <Typography role="status" variant="body2" color="text.secondary" sx={{ bgcolor: "action.hover", borderRadius: 1, p: 1.5, wordBreak: "break-all" }}>
                  {status}
                </Typography>
              )}
              {running && latexLog && (
                <Box component="pre" sx={{ maxHeight: 256, overflow: "auto", whiteSpace: "pre-wrap", bgcolor: "action.hover", borderRadius: 1, p: 1.5, fontSize: 12 }}>
                  {latexLog}
                </Box>
              )}
            </Panel>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
