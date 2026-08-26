import { useCallback, useMemo, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { pyInvoke } from "tauri-plugin-pytauri-api";
import type { RunPipelineRequest } from "./pipeline-request.generated";
import {
  addEdge,
  Background,
  Connection,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./App.css";

type NodeKind = "render" | "merge" | "pages" | "bind";
type PatternKind = "basic" | "midori" | "timeline";
type RunState = "idle" | "running" | "success" | "error";

type PageConfig = {
  width: number;
  height: number;
  header: number;
  footer: number;
  binding: number;
  non_binding: number;
};

type DocumentConfig = {
  page_count: number;
  show_page_number: boolean;
  binding_text: string | null;
  binding_text_2: string | null;
  binding_text_size: number;
  binding_text_2_size: number;
  binding_text_spacing: number;
  page_number_font: string;
  binding_text_font: string;
  header_date: string | null;
  header_date_format: string;
  header_date_locale: string;
  header_parity: "odd" | "even" | "both";
  header_date_size: number;
  header_date_font: string | null;
  header_date_position: "center" | "binding" | "outer";
};

type BasicPatternConfig = {
  kind: "basic";
  spacing: number;
  line_width: number;
  line_color: string;
  draw_hlines: boolean;
  draw_vlines: boolean;
  draw_dots: boolean;
  hline_edge_color: string | null;
  hline_edge_width: number | null;
  vline_edge_color: string | null;
  vline_edge_width: number | null;
  dot_center_color: string | null;
  hline_header: boolean;
  hline_footer: boolean;
  hline_inner: boolean;
  hline_outer: boolean;
  vline_header: boolean;
  vline_footer: boolean;
  vline_inner: boolean;
  vline_outer: boolean;
  dot_header: boolean;
  dot_footer: boolean;
  dot_inner: boolean;
  dot_outer: boolean;
  dot_spacing: number | null;
  dot_radius: number;
  margin_x: number | null;
  margin_color: string | null;
  vline_spacing: number | null;
};

type MidoriPatternConfig = {
  kind: "midori";
  spacing: number;
  gap: number;
  edge_extension: number;
  dot_frequency: number;
  dot_radius: number;
  line_width: number;
  line_color: string;
  dot_color: string;
  header: boolean;
  footer: boolean;
  inner: boolean;
  outer: boolean;
};

type TimelinePatternConfig = {
  kind: "timeline";
  start: number;
  end: number;
  pages: 1 | 2;
  swap: boolean;
  line_color: string;
  line_width: number;
  label_size: number;
};

type RenderConfig = {
  page: PageConfig;
  document: DocumentConfig;
  pattern: BasicPatternConfig | MidoriPatternConfig | TimelinePatternConfig;
};

type PipelineData = {
  kind: NodeKind;
  title: string;
  description: string;
  detail: string;
  status: RunState;
  accent: string;
  render?: RenderConfig;
  pages?: { leading: number; trailing: number };
  bind?: { mode: "booklet" | "thread" | null; sheets_per_group: number };
};

type PipelineNode = Node<PipelineData, "pipeline">;

const makePattern = (kind: PatternKind): RenderConfig["pattern"] => {
  if (kind === "midori") {
    return {
      kind, spacing: 5, gap: 1, edge_extension: 1.2, dot_frequency: 10,
      dot_radius: 0.4, line_width: 0.7, line_color: "#99FFFF", dot_color: "#99FFFF",
      header: false, footer: false, inner: false, outer: false,
    };
  }
  if (kind === "timeline") {
    return {
      kind, start: 0, end: 26, pages: 1, swap: false, line_color: "#7A7A7A",
      line_width: 0.4 / (25.4 / 72.27), label_size: 10.2,
    };
  }
  return {
    kind, spacing: 8, line_width: 0.2, line_color: "#B0B0B0", draw_hlines: true,
    draw_vlines: false, draw_dots: false, hline_edge_color: null, hline_edge_width: null,
    vline_edge_color: null, vline_edge_width: null, dot_center_color: null,
    hline_header: false, hline_footer: false, hline_inner: false, hline_outer: false,
    vline_header: false, vline_footer: false, vline_inner: false, vline_outer: false,
    dot_header: false, dot_footer: false, dot_inner: false, dot_outer: false,
    dot_spacing: null, dot_radius: 0.3, margin_x: null, margin_color: null,
    vline_spacing: null,
  };
};

const makeRenderConfig = (): RenderConfig => ({
  page: { width: 148, height: 210, header: 10, footer: 10, binding: 15, non_binding: 8 },
  document: {
    page_count: 32, show_page_number: true, binding_text: "base-6", binding_text_2: null,
    binding_text_size: 8, binding_text_2_size: 8, binding_text_spacing: 5,
    page_number_font: "\\sffamily", binding_text_font: "\\sffamily", header_date: null,
    header_date_format: "yyyy-MM-dd", header_date_locale: "zh_CN", header_parity: "both",
    header_date_size: 8, header_date_font: null, header_date_position: "center",
  },
  pattern: makePattern("basic"),
});

const patternLabels: Record<PatternKind, string> = {
  basic: "Basic",
  midori: "Midori",
  timeline: "Timeline",
};

function NumberField({ label, value, onChange, step, min }: { label: string; value: number; onChange: (value: number) => void; step?: number; min?: number }) {
  return <label className="field-label">{label}<input type="number" value={value} step={step} min={min} onChange={(event) => onChange(Number(event.target.value) || 0)} /></label>;
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="field-label">{label}<input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function OptionalTextField({ label, value, onChange, placeholder }: { label: string; value: string | null; onChange: (value: string | null) => void; placeholder?: string }) {
  return <label className="field-label">{label}<input value={value ?? ""} placeholder={placeholder ?? "(空)"} onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)} /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <label className="field-label">{label}<select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>;
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="field-label"><span style={{ display: "flex", alignItems: "center", gap: 6, color: "#4b5565", font: "11px 'DM Sans'", marginTop: 7 }}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</span></label>;
}

function RenderInspector({ config, onPage, onDocument, onPattern }: {
  config: RenderConfig;
  onPage: (patch: Partial<PageConfig>) => void;
  onDocument: (patch: Partial<DocumentConfig>) => void;
  onPattern: (patch: Record<string, unknown>) => void;
}) {
  const { page, document, pattern } = config;
  return (
    <>
      <div className="field-label">版式<select value={pattern.kind} onChange={(event) => onPattern({ kind: event.target.value })}>{(["basic", "midori", "timeline"] as const).map((kind) => <option key={kind} value={kind}>{patternLabels[kind]}</option>)}</select></div>
      <NumberField label="页数" value={document.page_count} min={1} onChange={(value) => onDocument({ page_count: Math.max(1, value) })} />

      <div className="field-label">纸张 (mm)</div>
      <NumberField label="宽度" value={page.width} onChange={(value) => onPage({ width: value })} />
      <NumberField label="高度" value={page.height} onChange={(value) => onPage({ height: value })} />
      <NumberField label="页眉留白" value={page.header} onChange={(value) => onPage({ header: value })} />
      <NumberField label="页脚留白" value={page.footer} onChange={(value) => onPage({ footer: value })} />
      <NumberField label="装订边留白" value={page.binding} onChange={(value) => onPage({ binding: value })} />
      <NumberField label="非装订边留白" value={page.non_binding} onChange={(value) => onPage({ non_binding: value })} />

      <div className="field-label">页眉</div>
      <OptionalTextField label="页眉日期" value={document.header_date} onChange={(value) => onDocument({ header_date: value })} placeholder="如 2025-01-01" />
      <TextField label="日期格式" value={document.header_date_format} onChange={(value) => onDocument({ header_date_format: value })} />
      <TextField label="区域" value={document.header_date_locale} onChange={(value) => onDocument({ header_date_locale: value })} />
      <SelectField label="奇偶页" value={document.header_parity} options={[["both", "全部"], ["odd", "奇数页"], ["even", "偶数页"]]} onChange={(value) => onDocument({ header_parity: value as DocumentConfig["header_parity"] })} />
      <SelectField label="日期位置" value={document.header_date_position} options={[["center", "居中"], ["binding", "装订边"], ["outer", "外侧"]]} onChange={(value) => onDocument({ header_date_position: value as DocumentConfig["header_date_position"] })} />
      <NumberField label="日期字号" value={document.header_date_size} onChange={(value) => onDocument({ header_date_size: value })} />

      <div className="field-label">页脚</div>
      <CheckboxField label="显示页码" checked={document.show_page_number} onChange={(checked) => onDocument({ show_page_number: checked })} />
      <TextField label="页码字体" value={document.page_number_font} onChange={(value) => onDocument({ page_number_font: value })} />

      <div className="field-label">装订边水印</div>
      <OptionalTextField label="第一行文字" value={document.binding_text} onChange={(value) => onDocument({ binding_text: value })} />
      <OptionalTextField label="第二行文字" value={document.binding_text_2} onChange={(value) => onDocument({ binding_text_2: value })} />
      <NumberField label="字号" value={document.binding_text_size} onChange={(value) => onDocument({ binding_text_size: value })} />
      <NumberField label="第二行字号" value={document.binding_text_2_size} onChange={(value) => onDocument({ binding_text_2_size: value })} />
      <NumberField label="行间距" value={document.binding_text_spacing} onChange={(value) => onDocument({ binding_text_spacing: value })} />
      <TextField label="字体" value={document.binding_text_font} onChange={(value) => onDocument({ binding_text_font: value })} />

      <div className="field-label">版式参数 · {patternLabels[pattern.kind]}</div>
      {pattern.kind === "basic" && <>
        <NumberField label="行距 (mm)" value={pattern.spacing} onChange={(value) => onPattern({ spacing: value })} />
        <CheckboxField label="横线" checked={pattern.draw_hlines} onChange={(checked) => onPattern({ draw_hlines: checked })} />
        <CheckboxField label="竖线" checked={pattern.draw_vlines} onChange={(checked) => onPattern({ draw_vlines: checked })} />
        <CheckboxField label="点阵" checked={pattern.draw_dots} onChange={(checked) => onPattern({ draw_dots: checked })} />
        <NumberField label="点阵间距" value={pattern.dot_spacing ?? 0} onChange={(value) => onPattern({ dot_spacing: value || null })} />
        <TextField label="线色" value={pattern.line_color} onChange={(value) => onPattern({ line_color: value })} />
        <NumberField label="线宽 (pt)" value={pattern.line_width} onChange={(value) => onPattern({ line_width: value })} />
      </>}
      {pattern.kind === "midori" && <>
        <NumberField label="网格间距" value={pattern.spacing} onChange={(value) => onPattern({ spacing: value })} />
        <NumberField label="缺口" value={pattern.gap} onChange={(value) => onPattern({ gap: value })} />
        <NumberField label="边缘延伸" value={pattern.edge_extension} onChange={(value) => onPattern({ edge_extension: value })} />
        <NumberField label="点频率" value={pattern.dot_frequency} onChange={(value) => onPattern({ dot_frequency: value })} />
        <TextField label="线色" value={pattern.line_color} onChange={(value) => onPattern({ line_color: value })} />
        <TextField label="点色" value={pattern.dot_color} onChange={(value) => onPattern({ dot_color: value })} />
      </>}
      {pattern.kind === "timeline" && <>
        <NumberField label="起始小时" value={pattern.start} onChange={(value) => onPattern({ start: value })} />
        <NumberField label="结束小时" value={pattern.end} onChange={(value) => onPattern({ end: value })} />
        <SelectField label="单页/双页" value={String(pattern.pages)} options={[["1", "单页"], ["2", "双页展开"]]} onChange={(value) => onPattern({ pages: Number(value) as 1 | 2 })} />
        <CheckboxField label="交换左右页" checked={pattern.swap} onChange={(checked) => onPattern({ swap: checked })} />
        <NumberField label="标签字号" value={pattern.label_size} onChange={(value) => onPattern({ label_size: value })} />
      </>}
    </>
  );
}

const initialNodes: PipelineNode[] = [
  {
    id: "render",
    type: "pipeline",
    position: { x: 80, y: 170 },
    data: {
      kind: "render",
      title: "Render sections",
      description: "渲染页面内容",
      detail: "Basic · 32 pages",
      status: "success",
      accent: "blue",
      render: makeRenderConfig(),
    },
  },
  {
    id: "merge",
    type: "pipeline",
    position: { x: 360, y: 170 },
    data: {
      kind: "merge",
      title: "Merge PDFs",
      description: "合并外部 PDF 文件",
      detail: "No extra files",
      status: "success",
      accent: "violet",
    },
  },
  {
    id: "pages",
    type: "pipeline",
    position: { x: 640, y: 170 },
    data: {
      kind: "pages",
      title: "Add pages",
      description: "添加空白页",
      detail: "Trailing · 2 pages",
      status: "success",
      accent: "amber",
      pages: { leading: 0, trailing: 2 },
    },
  },
  {
    id: "bind",
    type: "pipeline",
    position: { x: 920, y: 170 },
    data: {
      kind: "bind",
      title: "Bind booklet",
      description: "生成装订版 PDF",
      detail: "Booklet · 4 sheets/group",
      status: "success",
      accent: "emerald",
      bind: { mode: "booklet", sheets_per_group: 4 },
    },
  },
];

const initialEdges: Edge[] = [
  { id: "render-merge", source: "render", target: "merge", type: "smoothstep" },
  { id: "merge-pages", source: "merge", target: "pages", type: "smoothstep" },
  { id: "pages-bind", source: "pages", target: "bind", type: "smoothstep" },
];

const nodeTypes = { pipeline: PipelineNodeCard };

function PipelineNodeCard({ data, selected }: NodeProps<PipelineNode>) {
  const icons: Record<NodeKind, string> = {
    render: "▦",
    merge: "⌘",
    pages: "＋",
    bind: "⌁",
  };

  return (
    <div className={`pipeline-node ${selected ? "is-selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className={`node-icon ${data.accent}`}>{icons[data.kind]}</div>
      <div className="node-copy">
        <div className="node-title">{data.title}</div>
        <div className="node-description">{data.description}</div>
        <div className="node-detail">{data.detail}</div>
      </div>
      <span className={`node-status ${data.status}`} aria-label={data.status} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const palette = [
  ["render", "Render", "生成页面"],
  ["merge", "Merge PDFs", "合并文件"],
  ["pages", "Add pages", "添加空白页"],
  ["bind", "Bind", "装订输出"],
] as const;

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<PipelineNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState("render");
  const [runState, setRunState] = useState<RunState>("idle");
  const [outputPath, setOutputPath] = useState("");
  const selectedNode = nodes.find((node) => node.id === selectedId);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((current) => addEdge({ ...connection, type: "smoothstep" }, current)),
    [setEdges],
  );

  const addNode = (kind: NodeKind, title: string, description: string) => {
    const id = `${kind}-${Date.now()}`;
    const accent = kind === "render" ? "blue" : kind === "merge" ? "violet" : kind === "pages" ? "amber" : "emerald";
    setNodes((current) => [
      ...current,
      {
        id,
        type: "pipeline",
        position: { x: 180 + (current.length % 3) * 250, y: 390 + Math.floor(current.length / 3) * 150 },
        data: {
          kind, title, description, detail: "Configure this step", status: "idle", accent,
          ...(kind === "render" ? { render: makeRenderConfig() } : {}),
          ...(kind === "pages" ? { pages: { leading: 0, trailing: 2 } } : {}),
          ...(kind === "bind" ? { bind: { mode: "booklet" as const, sheets_per_group: 4 } } : {}),
        },
      },
    ]);
    setSelectedId(id);
  };

  const updateSelected = (patch: Partial<PipelineData>) => {
    if (!selectedId) return;
    setNodes((current) => current.map((node) => node.id === selectedId ? { ...node, data: { ...node.data, ...patch } } : node));
  };

  const updateRender = (patch: Partial<RenderConfig>) => {
    if (!selectedId) return;
    setNodes((current) => current.map((node) => node.id === selectedId && node.data.render
      ? { ...node, data: { ...node.data, render: { ...node.data.render, ...patch } } }
      : node));
  };

  const updatePattern = (patch: Record<string, unknown>) => {
    if (!selectedId) return;
    setNodes((current) => current.map((node) => node.id === selectedId && node.data.render
      ? { ...node, data: { ...node.data, render: { ...node.data.render, pattern: { ...node.data.render.pattern, ...patch } as RenderConfig["pattern"] } } }
      : node));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setNodes((current) => current.filter((node) => node.id !== selectedId));
    setEdges((current) => current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId));
    setSelectedId("");
  };

  const runPipeline = async () => {
    if (runState === "running") return;
    const output = await save({
      title: "保存生成的 PDF",
      defaultPath: "output.pdf",
      filters: [{ name: "PDF 文件", extensions: ["pdf"] }],
    });
    if (!output) return;

    setRunState("running");
    setNodes((current) => current.map((node) => ({ ...node, data: { ...node.data, status: "running" } })));
    try {
      const renderSections = nodes
        .filter((node) => node.data.kind === "render" && node.data.render)
        .map((node) => node.data.render);
      if (!renderSections.length) throw new Error("至少需要一个 Render 节点");
      const pagesNode = nodes.find((node) => node.data.kind === "pages");
      const bindNode = nodes.find((node) => node.data.kind === "bind");
      const body: RunPipelineRequest = {
        output,
        sections: renderSections as RunPipelineRequest["sections"],
        add_pages: pagesNode?.data.pages ?? { leading: 0, trailing: 0 },
        bind: bindNode?.data.bind ?? { mode: null, sheets_per_group: 4 },
      };
      const savedPath = await pyInvoke<string>("run_pipeline", body);
      setOutputPath(savedPath);
      setRunState("success");
      setNodes((current) => current.map((node) => ({ ...node, data: { ...node.data, status: "success" } })));
    } catch (error) {
      console.error("Pipeline failed", error);
      setRunState("error");
      setNodes((current) => current.map((node) => ({ ...node, data: { ...node.data, status: "idle" } })));
    }
  };

  const summary = useMemo(() => `${nodes.length} nodes · ${edges.length} connections`, [nodes.length, edges.length]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">b6</div><div><strong>base6 techo</strong><span>Pipeline studio</span></div></div>
        <div className="project-name"><span className="live-dot" />Untitled pipeline <span className="unsaved">•</span></div>
        <div className="top-actions"><button className="button primary" onClick={runPipeline}>{runState === "running" ? "运行中…" : "运行 pipeline"}<span className="shortcut">⌘ ↵</span></button></div>
      </header>

      <section className="workspace">
        <aside className="sidebar left-sidebar">
          <div className="sidebar-heading"><div><div className="eyebrow">BUILD</div><h2>节点库</h2></div><button className="icon-button" aria-label="搜索">⌕</button></div>
          <p className="sidebar-intro">点击节点，开始构建你的文档流水线。</p>
          <div className="palette-list">
            {palette.map(([kind, title, description]) => <button className="palette-item" key={kind} onClick={() => addNode(kind, title, description)}><span className={`palette-icon ${kind}`}>{kind === "render" ? "▦" : kind === "merge" ? "⌘" : kind === "pages" ? "＋" : "⌁"}</span><span><b>{title}</b><small>{description}</small></span><span className="add-sign">+</span></button>)}
          </div>
          <div className="sidebar-tip"><span>✦</span><div><b>从一个简单的 flow 开始</b><p>连接节点来定义每一步的处理顺序。</p></div></div>
          <div className="sidebar-footer"><span className="status-dot" />Local workspace <span>⌄</span></div>
        </aside>

        <section className="canvas-area">
          <div className="canvas-toolbar"><div className="breadcrumb">Pipelines <span>/</span> Untitled</div><div className="canvas-tools"><button className="tool-button">↶</button><button className="tool-button">↷</button><span className="tool-divider" /><button className="tool-button">□</button><span className="zoom">100%</span></div></div>
          <div className="flow-wrap">
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_, node) => setSelectedId(node.id)} fitView fitViewOptions={{ padding: 0.25 }} minZoom={0.35} defaultEdgeOptions={{ animated: false, style: { stroke: "#a5adbb", strokeWidth: 1.5 } }}>
              <Background color="#d9dee7" gap={20} size={1} />
              <Controls showInteractive={false} />
              <MiniMap nodeColor={(node) => node.data?.accent === "blue" ? "#5481e8" : node.data?.accent === "violet" ? "#9272dc" : node.data?.accent === "amber" ? "#dda33d" : "#4da786"} maskColor="rgba(248,249,251,.75)" />
              <Panel position="bottom-left"><div className="canvas-hint"><span className="mouse-icon">⌘</span> 拖拽节点 · <span>滚轮缩放</span></div></Panel>
            </ReactFlow>
          </div>
          <div className={`run-bar ${runState}`}><span className="run-indicator" /><span>{runState === "running" ? "Pipeline 正在运行…" : runState === "success" ? "Pipeline 运行完成" : runState === "error" ? "Pipeline 运行失败" : "Ready to run"}</span><span className="run-summary">{summary}</span>{runState === "success" && <span className="run-result">✓ {outputPath.split(/[\\/]/).pop()}</span>}</div>
        </section>

        <aside className="sidebar right-sidebar">
          <div className="sidebar-heading"><div><div className="eyebrow">CONFIGURE</div><h2>节点设置</h2></div><button className="icon-button">⋯</button></div>
          {selectedNode ? <div className="inspector">
            <div className="selected-node-title"><span className={`palette-icon ${selectedNode.data.kind}`}>{selectedNode.data.kind === "render" ? "▦" : selectedNode.data.kind === "merge" ? "⌘" : selectedNode.data.kind === "pages" ? "＋" : "⌁"}</span><div><b>{selectedNode.data.title}</b><small>{selectedNode.data.description}</small></div></div>
            <label className="field-label">节点名称<input value={selectedNode.data.title} onChange={(event) => updateSelected({ title: event.target.value })} /></label>
            {selectedNode.data.kind === "render" && <RenderInspector
              config={selectedNode.data.render!}
              onPage={(patch) => updateRender({ page: { ...selectedNode.data.render!.page, ...patch } })}
              onDocument={(patch) => updateRender({ document: { ...selectedNode.data.render!.document, ...patch } })}
              onPattern={updatePattern}
            />}
            {selectedNode.data.kind === "merge" && <div className="empty-config"><span>⌁</span><b>还没有 PDF 文件</b><p>运行前可在这里添加要合并的外部文件。</p><button className="button outline">选择文件</button></div>}
            {selectedNode.data.kind === "pages" && (() => {
              const pages = selectedNode.data.pages ?? { leading: 0, trailing: 2 };
              const position = pages.leading > 0 && pages.trailing === 0 ? "leading" : "trailing";
              const count = position === "leading" ? pages.leading : pages.trailing;
              const setCount = (n: number) => updateSelected({ pages: position === "leading" ? { leading: n, trailing: 0 } : { leading: 0, trailing: n } });
              return <><div className="field-label">添加位置<select value={position} onChange={(event) => updateSelected({ pages: event.target.value === "leading" ? { leading: count, trailing: 0 } : { leading: 0, trailing: count } })}><option value="trailing">末尾</option><option value="leading">开头</option></select></div><label className="field-label">空白页数量<input type="number" value={count} onChange={(event) => setCount(Math.max(0, Number(event.target.value) || 0))} /></label></>;
            })()}
            {selectedNode.data.kind === "bind" && <><div className="field-label">装订方式<select value={selectedNode.data.bind?.mode ?? "none"} onChange={(event) => updateSelected({ bind: { mode: event.target.value === "none" ? null : (event.target.value as "booklet" | "thread"), sheets_per_group: selectedNode.data.bind?.sheets_per_group ?? 4 } })}><option value="booklet">Booklet</option><option value="thread">Thread</option><option value="none">不装订</option></select></div><label className="field-label">每组 sheets<input type="number" value={selectedNode.data.bind?.sheets_per_group ?? 4} onChange={(event) => updateSelected({ bind: { mode: selectedNode.data.bind?.mode ?? null, sheets_per_group: Math.max(1, Number(event.target.value) || 1) } })} /></label></>}
            <div className="inspector-divider" /><div className="field-label">状态<div className="status-select"><span className={`node-status ${selectedNode.data.status}`} />{selectedNode.data.status === "success" ? "已配置" : "待配置"}<span>⌄</span></div></div>
          </div> : <div className="empty-config">选择一个节点开始配置。</div>}
          <div className="inspector-footer"><button className="delete-button" onClick={deleteSelected}>⌫ 删除节点</button></div>
        </aside>
      </section>
    </main>
  );
}

export default App;
