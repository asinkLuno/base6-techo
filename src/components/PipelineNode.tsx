import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PipelineNode as PipelineNodeType, StageKind } from "../types";

const META: Record<StageKind, { icon: string; eyebrow: string }> = {
  section: { icon: "§", eyebrow: "Render" },
  pages: { icon: "+", eyebrow: "Pad" },
  bind: { icon: "⌁", eyebrow: "Impose" },
};

function summary(node: PipelineNodeType["data"]): string {
  if (node.section) return `${node.section.pattern.kind} · ${node.section.document.page_count} pages`;
  if (node.pages) return `${node.pages.leading} before · ${node.pages.trailing} after`;
  if (node.bind) return node.bind.mode ? `${node.bind.mode} · ${node.bind.sheets_per_group} sheets` : "No imposition";
  return "";
}

function PipelineNodeCard({ data, selected }: NodeProps<PipelineNodeType>) {
  const meta = META[data.kind];
  return <article className={`pipeline-card stage-${data.kind} ${selected ? "selected" : ""}`}>
    <Handle type="target" position={Position.Left} />
    <div className="card-index">{meta.icon}</div>
    <div className="card-copy"><span>{meta.eyebrow}</span><strong>{data.label}</strong><small>{summary(data)}</small></div>
    <div className="paper-notch" aria-hidden="true" />
    <Handle type="source" position={Position.Right} />
  </article>;
}

export default memo(PipelineNodeCard);
