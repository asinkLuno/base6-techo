import { useCallback, useMemo, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { pyInvoke } from "tauri-plugin-pytauri-api";
import {
  addEdge, Background, Controls, MarkerType, MiniMap, ReactFlow,
  useEdgesState, useNodesState, type Connection, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { RunPipelineRequest } from "./pipeline-request.generated";
import { makeNodeData } from "./defaults";
import { Inspector } from "./components/Inspector";
import PipelineNodeCard from "./components/PipelineNode";
import type { PipelineNode, StageKind } from "./types";
import "./styles.css";

const nodeTypes = { pipeline: PipelineNodeCard };
const STAGES: { kind: StageKind; title: string; note: string }[] = [
  { kind: "section", title: "Render section", note: "Pattern + page metadata" },
  { kind: "pages", title: "Blank pages", note: "Pad before or after" },
  { kind: "bind", title: "Binding", note: "Booklet or signatures" },
];

const initialNodes: PipelineNode[] = [
  { id: "section-1", type: "pipeline", position: { x: 40, y: 160 }, data: makeNodeData("section") },
  { id: "section-2", type: "pipeline", position: { x: 320, y: 160 }, data: { ...makeNodeData("section"), label: "Notes section" } },
  { id: "pages-1", type: "pipeline", position: { x: 600, y: 160 }, data: makeNodeData("pages") },
  { id: "bind-1", type: "pipeline", position: { x: 880, y: 160 }, data: makeNodeData("bind") },
];
const initialEdges: Edge[] = initialNodes.slice(0, -1).map((node, index) => ({
  id: `${node.id}-${initialNodes[index + 1].id}`,
  source: node.id,
  target: initialNodes[index + 1].id,
  markerEnd: { type: MarkerType.ArrowClosed },
}));

function orderPipeline(nodes: PipelineNode[], edges: Edge[]): PipelineNode[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) continue;
    outgoing.get(edge.source)!.push(edge.target);
    incoming.get(edge.target)!.push(edge.source);
  }
  if (nodes.some((node) => incoming.get(node.id)!.length > 1 || outgoing.get(node.id)!.length > 1)) throw new Error("Pipeline must be one line: each step can have only one input and one output.");
  const sources = nodes.filter((node) => incoming.get(node.id)!.length === 0);
  if (sources.length !== 1) throw new Error("Connect every step into one pipeline.");
  const ordered: PipelineNode[] = [];
  const visited = new Set<string>();
  let current: PipelineNode | undefined = sources[0];
  while (current && !visited.has(current.id)) {
    ordered.push(current); visited.add(current.id);
    current = nodeMap.get(outgoing.get(current.id)![0]);
  }
  if (visited.size !== nodes.length) throw new Error("Pipeline contains a cycle or disconnected step.");
  const rank: Record<StageKind, number> = { section: 0, pages: 1, bind: 2 };
  if (!ordered.some((node) => node.data.kind === "section")) throw new Error("Add at least one Render section.");
  if (ordered.some((node, index) => index > 0 && rank[node.data.kind] < rank[ordered[index - 1].data.kind])) throw new Error("Use backend order: Render → Blank pages → Binding.");
  for (const kind of ["pages", "bind"] as const) if (ordered.filter((node) => node.data.kind === kind).length > 1) throw new Error(`Only one ${kind} step is supported.`);
  return ordered;
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<PipelineNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState("section-1");
  const [status, setStatus] = useState<{ state: "idle" | "running" | "success" | "error"; message: string }>({ state: "idle", message: "Ready" });
  const selected = nodes.find((node) => node.id === selectedId);

  const connect = useCallback((connection: Connection) => setEdges((items) => addEdge({ ...connection, markerEnd: { type: MarkerType.ArrowClosed } }, items)), [setEdges]);
  const addNode = (kind: StageKind) => {
    const id = `${kind}-${crypto.randomUUID()}`;
    setNodes((items) => [...items, { id, type: "pipeline", position: { x: 160 + items.length * 70, y: 120 + items.length * 38 }, data: makeNodeData(kind) }]);
    setSelectedId(id);
  };
  const updateSelected = (patch: Partial<PipelineNode["data"]>) => setNodes((items) => items.map((node) => node.id === selectedId ? { ...node, data: { ...node.data, ...patch } } : node));
  const removeSelected = () => {
    setNodes((items) => items.filter((node) => node.id !== selectedId));
    setEdges((items) => items.filter((edge) => edge.source !== selectedId && edge.target !== selectedId));
    setSelectedId("");
  };

  const ordered = useMemo(() => { try { return orderPipeline(nodes, edges); } catch { return []; } }, [nodes, edges]);
  const run = async () => {
    if (status.state === "running") return;
    try {
      const steps = orderPipeline(nodes, edges);
      const output = await save({ title: "Export printable PDF", defaultPath: "notebook.pdf", filters: [{ name: "PDF", extensions: ["pdf"] }] });
      if (!output) return;
      const sections = steps.filter((node) => node.data.kind === "section").map((node) => node.data.section!);
      const pages = steps.find((node) => node.data.kind === "pages");
      const bind = steps.find((node) => node.data.kind === "bind");
      const body: RunPipelineRequest = {
        output, sections: [sections[0], ...sections.slice(1)] as RunPipelineRequest["sections"],
        add_pages: pages?.data.pages ?? { leading: 0, trailing: 0 },
        bind: bind?.data.bind ?? { mode: null, sheets_per_group: 4 },
      };
      setStatus({ state: "running", message: "Compiling LaTeX…" });
      const saved = await pyInvoke<string>("run_pipeline", body);
      setStatus({ state: "success", message: `Saved ${saved.split(/[\\/]/).pop()}` });
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  return <main className="studio">
    <header className="topbar"><div className="brand"><span>b6</span><div><strong>techo bindery</strong><small>LaTeX pipeline studio</small></div></div><div className={`run-status ${status.state}`}><i />{status.message}</div><button className="action-button" onClick={run} disabled={status.state === "running"}>{status.state === "running" ? "Building…" : "Build PDF"}</button></header>
    <section className="workbench">
      <nav className="stage-rail"><header><span>Pipeline</span><strong>Add a step</strong></header>{STAGES.map((stage, index) => <button key={stage.kind} onClick={() => addNode(stage.kind)}><em>0{index + 1}</em><span><b>{stage.title}</b><small>{stage.note}</small></span><i>+</i></button>)}<div className="rail-note"><b>Connection order is execution order.</b><p>Drag steps freely, then connect them from left to right.</p></div></nav>
      <section className="canvas"><div className="canvas-heading"><span>Binding table</span><b>{ordered.length ? `${ordered.length} connected steps` : "Pipeline needs attention"}</b></div><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={connect} onNodeClick={(_, node) => setSelectedId(node.id)} onPaneClick={() => setSelectedId("")} fitView minZoom={0.25} maxZoom={1.6} deleteKeyCode={["Backspace", "Delete"]}><Background gap={24} size={1} color="#33404d" /><Controls showInteractive={false} /><MiniMap pannable zoomable nodeColor={(node) => ({ section: "#f4c95d", pages: "#d58f6f", bind: "#8da7c8" }[node.data?.kind as StageKind] ?? "#aaa")} maskColor="rgba(17,24,31,.72)" /></ReactFlow></section>
      {selected ? <Inspector node={selected} update={updateSelected} remove={removeSelected} /> : <aside className="inspector empty-inspector"><span>Nothing selected</span><h2>Choose a pipeline step</h2><p>Its complete backend configuration will appear here.</p></aside>}
    </section>
  </main>;
}
