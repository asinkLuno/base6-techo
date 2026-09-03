import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import {
  DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  AppBar, Box, Button, Card, CardContent, Divider, IconButton, Stack, Toolbar, Typography,
} from "@mui/material";
import { Add, Delete, Download, FileDownload, Refresh, Upload, Visibility } from "@mui/icons-material";
import type { Section } from "./lib/schema";
import {
  FONT_OPTIONS, PAGE_SIZE_OPTIONS, PAGE_SIZES, margins, newSection,
} from "./lib/schema";
import { effectivePages, loadJSON, sectionRequest } from "./lib/utils";
import { parseICS } from "./lib/ics-parser";
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

  const [sections, setSections] = useState<Section[]>(saved?.sections ?? [newSection()]);
  const [binding, setBinding] = useState<"booklet" | "thread" | null>(saved?.binding ?? null);
  const [size, setSize] = useState(saved?.size ?? { width: 148, height: 210 });
  const [pageSize, setPageSize] = useState(saved?.pageSize ?? "A5");
  const [holidays, setHolidays] = useState<Record<string, string>>(saved?.holidays ?? {});
  const [fontOptions, setFontOptions] = useState<[string, string][]>(FONT_OPTIONS);
  const [sheetsPerGroup, setSheetsPerGroup] = useState(saved?.sheetsPerGroup ?? 4);
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);
  const [latexLog, setLatexLog] = useState("");
  const [preview, setPreview] = useState<{ open: boolean; data: string; busy: boolean; error: string }>(
    { open: false, data: "", busy: false, error: "" },
  );

  useEffect(() => {
    invoke<string>("list_system_fonts")
      .then((json) => {
        const names = JSON.parse(json) as string[];
        if (names.length) setFontOptions((base) => [...base, ...names.map((n) => [n, n] as [string, string])]);
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
    const input = await open({ multiple: false, filters: [{ name: "JSON", extensions: ["json"] }] });
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
      if (data.size && typeof data.size === "object" && "width" in data.size && "height" in data.size)
        setSize(data.size as { width: number; height: number });
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

  function buildRequest(output: string) {
    return {
      output,
      sections: sections.map((section) => sectionRequest(section, holidays)),
      bind: { mode: binding, sheets_per_group: sheetsPerGroup },
    };
  }

  async function generate() {
    const output = await save({
      title: "生成手帐 PDF",
      defaultPath: "base6-techo.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!output) return;
    setRunning(true);
    setLatexLog("");
    setStatus("正在排版并生成 PDF…");
    try {
      const result = await invoke<string>("run_pipeline", { body: buildRequest(output) });
      setStatus(`已生成：${result}`);
    } catch (error) {
      setStatus(`生成失败：${String(error)}`);
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
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: "0.04em" }}>
              base6 <Box component="span" sx={{ color: "secondary.main" }}>techo</Box>
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", letterSpacing: "0.16em", display: { xs: "none", sm: "block" } }}>
              手帐排版工作台
            </Typography>
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={preview.busy ? <Refresh sx={{ animation: "spin 1s linear infinite" }} /> : <Visibility />}
              disabled={busy || !sections.length}
              onClick={() => previewDocument(true)}
            >
              {preview.busy ? "渲染中…" : preview.open ? "刷新预览" : "预览"}
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={running ? <Refresh sx={{ animation: "spin 1s linear infinite" }} /> : <FileDownload />}
              disabled={busy || !sections.length}
              onClick={generate}
            >
              {running ? "生成中…" : "生成 PDF"}
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
                      {latexLog || "正在启动 LaTeX…"}
                    </Box>
                    <Typography variant="body2" color="text.secondary">正在渲染整体预览…</Typography>
                  </Box>
                ) : preview.error ? (
                  <Typography color="error" sx={{ p: 3, fontSize: 12 }}>预览失败：{preview.error}</Typography>
                ) : (
                  <iframe title="整体预览" src={`data:application/pdf;base64,${preview.data}`} style={{ display: "block", width: "100%", height: "72vh", border: 0 }} />
                )}
              </Box>
            )}

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Stack spacing={0.25}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>版面</Typography>
                <Typography variant="caption" color="text.secondary">
                  {sections.length} 个 Section · 成品 {totalPages} 页
                </Typography>
              </Stack>
              <Button
                startIcon={<Add />}
                onClick={() => startTransition(() => setSections((items) => [...items, newSection(size.width, size.height)]))}
              >
                添加 Section
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
                <Typography color="text.secondary">至少添加一个 Section。</Typography>
              </Box>
            )}
          </Box>

          {/* 侧栏：分组的设置面板 */}
          <Box sx={{ display: "grid", gap: 2.5, position: { lg: "sticky" }, top: 80 }}>
            <Panel title="纸张" description="页面的物理尺寸">
              <SelectField
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
            </Panel>

            <Panel title="装订" description="决定页码如何拼版">
              {([
                { value: "booklet", title: "骑马钉", hint: "整本按 4 页补齐并拼版" },
                { value: "thread", title: "锁线分册", hint: "按每帖纸张数分组拼版" },
                { value: null, title: "不拼版", hint: "保持页面顺序输出" },
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
                <Field label="每帖纸张数" value={sheetsPerGroup} min={1} onChange={(v) => setSheetsPerGroup(Number(v))} />
              )}
            </Panel>

            <Panel title="边距文字" description="页缘文字与正文字体">
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Button size="small" startIcon={<Upload />} disabled={running} onClick={importICS}>
                  导入 ICS 日历
                </Button>
                {Object.keys(holidays).length > 0 && (
                  <IconButton size="small" onClick={() => setHolidays({})} aria-label="清除节日">
                    <Delete />
                  </IconButton>
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                页缘文字可标注节日；已导入 {Object.keys(holidays).length} 个日期。
              </Typography>
              <Divider />
              <Typography variant="caption" color="text.secondary">正文 / 页缘字体</Typography>
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

            <Panel title="预设" description="保存或载入整套设置">
              <Stack direction="row" spacing={1}>
                <Button size="small" startIcon={<Download />} sx={{ flex: 1 }} onClick={exportPreset}>导出预设</Button>
                <Button size="small" startIcon={<Upload />} sx={{ flex: 1 }} onClick={importPreset}>导入预设</Button>
              </Stack>
            </Panel>

            <Panel title="状态">
              <Box sx={{ display: "grid", gap: 0.5 }}>
                <Typography variant="body2" sx={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Section</span><span>{sections.length}</span>
                </Typography>
                <Typography variant="body2" sx={{ display: "flex", justifyContent: "space-between" }}>
                  <span>成品页数</span><span>{totalPages}</span>
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
