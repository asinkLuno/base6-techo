import { useCallback, useMemo, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { pyInvoke } from "tauri-plugin-pytauri-api";
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
type RunState = "idle" | "running" | "success" | "error";

type PipelineData = {
  kind: NodeKind;
  title: string;
  description: string;
  detail: string;
  status: RunState;
  accent: string;
};

type PipelineNode = Node<PipelineData, "pipeline">;

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
        data: { kind, title, description, detail: "Configure this step", status: "idle", accent },
      },
    ]);
    setSelectedId(id);
  };

  const updateSelected = (patch: Partial<PipelineData>) => {
    if (!selectedId) return;
    setNodes((current) => current.map((node) => node.id === selectedId ? { ...node, data: { ...node.data, ...patch } } : node));
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
      const savedPath = await pyInvoke<string>("run_pipeline", output);
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
            {selectedNode.data.kind === "render" && <><div className="field-label">Pattern<select defaultValue="Basic"><option>Basic</option><option>Midori</option><option>Timeline</option></select></div><label className="field-label">页数<input type="number" defaultValue="32" /></label></>}
            {selectedNode.data.kind === "merge" && <div className="empty-config"><span>⌁</span><b>还没有 PDF 文件</b><p>运行前可在这里添加要合并的外部文件。</p><button className="button outline">选择文件</button></div>}
            {selectedNode.data.kind === "pages" && <><div className="field-label">添加位置<select defaultValue="trailing"><option value="trailing">末尾</option><option value="leading">开头</option></select></div><label className="field-label">空白页数量<input type="number" defaultValue="2" /></label></>}
            {selectedNode.data.kind === "bind" && <><div className="field-label">装订方式<select defaultValue="booklet"><option value="booklet">Booklet</option><option value="thread">Thread</option></select></div><label className="field-label">每组 sheets<input type="number" defaultValue="4" /></label></>}
            <div className="inspector-divider" /><div className="field-label">状态<div className="status-select"><span className={`node-status ${selectedNode.data.status}`} />{selectedNode.data.status === "success" ? "已配置" : "待配置"}<span>⌄</span></div></div>
          </div> : <div className="empty-config">选择一个节点开始配置。</div>}
          <div className="inspector-footer"><button className="delete-button" onClick={deleteSelected}>⌫ 删除节点</button></div>
        </aside>
      </section>
    </main>
  );
}

export default App;
