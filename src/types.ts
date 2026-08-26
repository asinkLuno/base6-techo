import type { Node } from "@xyflow/react";

export type StageKind = "section" | "pages" | "bind";
export type PatternKind = "basic" | "midori" | "timeline";

export type PageConfig = {
  width: number; height: number; header: number; footer: number;
  binding: number; non_binding: number;
};

export type DocumentConfig = {
  page_count: number; show_header: boolean; show_page_number: boolean;
  binding_text: string | null; binding_text_2: string | null;
  binding_text_size: number; binding_text_2_size: number;
  binding_text_spacing: number; page_number_font: string;
  binding_text_font: string; header_date: string | null;
  header_date_format: string; header_date_locale: string;
  header_parity: "odd" | "even" | "both"; header_date_size: number;
  header_date_font: string | null;
  header_date_position: "center" | "binding" | "outer";
};

export type BasicPattern = {
  kind: "basic"; spacing: number; line_width: number; line_color: string;
  draw_hlines: boolean; draw_vlines: boolean; draw_dots: boolean;
  hline_edge_color: string | null; hline_edge_width: number | null;
  vline_edge_color: string | null; vline_edge_width: number | null;
  dot_center_color: string | null; hline_header: boolean; hline_footer: boolean;
  hline_inner: boolean; hline_outer: boolean; vline_header: boolean;
  vline_footer: boolean; vline_inner: boolean; vline_outer: boolean;
  dot_header: boolean; dot_footer: boolean; dot_inner: boolean;
  dot_outer: boolean; dot_spacing: number | null; dot_radius: number;
  margin_x: number | null; margin_color: string | null;
  vline_spacing: number | null;
};

export type MidoriPattern = {
  kind: "midori"; spacing: number; gap: number; edge_extension: number;
  dot_frequency: number; dot_radius: number; line_width: number;
  line_color: string; dot_color: string; header: boolean; footer: boolean;
  inner: boolean; outer: boolean;
};

export type TimelinePattern = {
  kind: "timeline"; start: number; end: number; pages: 1 | 2;
  swap: boolean; line_color: string; line_width: number; label_size: number;
  city_name: string | null; latitude: number | null; longitude: number | null;
  timezone: string | null; daylight_color: string; night_color: string;
};

export type PatternConfig = BasicPattern | MidoriPattern | TimelinePattern;
export type SectionConfig = { page: PageConfig; document: DocumentConfig; pattern: PatternConfig };

export type PipelineNodeData = {
  kind: StageKind;
  label: string;
  section?: SectionConfig;
  pages?: { leading: number; trailing: number };
  bind?: { mode: "booklet" | "thread" | null; sheets_per_group: number };
};

export type PipelineNode = Node<PipelineNodeData, "pipeline">;
