import type { PatternConfig, PatternKind, PipelineNodeData, SectionConfig, StageKind } from "./types";

export function makePattern(kind: PatternKind): PatternConfig {
  if (kind === "midori") return {
    kind, spacing: 5, gap: 1, edge_extension: 1.2, dot_frequency: 10,
    dot_radius: 0.4, line_width: 0.7, line_color: "#99ffff",
    dot_color: "#99ffff", header: false, footer: false, inner: false, outer: false,
  };
  if (kind === "timeline") return {
    kind, start: 0, end: 26, pages: 1, swap: false, line_color: "#7a7a7a",
    line_width: 0.4 / (25.4 / 72.27), label_size: 10.2, city_name: null,
    latitude: null, longitude: null, timezone: null,
    daylight_color: "#e5b93f", night_color: "#496a9f",
  };
  return {
    kind, spacing: 8, line_width: 0.2, line_color: "#b0b0b0",
    draw_hlines: true, draw_vlines: false, draw_dots: false,
    hline_edge_color: null, hline_edge_width: null, vline_edge_color: null,
    vline_edge_width: null, dot_center_color: null, hline_header: false,
    hline_footer: false, hline_inner: false, hline_outer: false,
    vline_header: false, vline_footer: false, vline_inner: false,
    vline_outer: false, dot_header: false, dot_footer: false,
    dot_inner: false, dot_outer: false, dot_spacing: null, dot_radius: 0.3,
    margin_x: null, margin_color: null, vline_spacing: null,
  };
}

export function makeSection(): SectionConfig {
  return {
    page: { width: 148, height: 210, header: 10, footer: 10, binding: 15, non_binding: 8 },
    document: {
      page_count: 32, show_header: true, show_page_number: true, binding_text: "base-6",
      binding_text_2: null, binding_text_size: 8, binding_text_2_size: 8,
      binding_text_spacing: 5, page_number_font: "\\sffamily",
      binding_text_font: "\\sffamily", header_date: null,
      header_date_format: "yyyy-MM-dd", header_date_locale: "zh_CN",
      header_parity: "both", header_date_size: 8, header_date_font: null,
      header_date_position: "center",
    },
    pattern: makePattern("basic"),
  };
}

export function makeNodeData(kind: StageKind): PipelineNodeData {
  if (kind === "section") return { kind, label: "Notebook section", section: makeSection() };
  if (kind === "pages") return { kind, label: "Blank pages", pages: { leading: 0, trailing: 2 } };
  return { kind, label: "Binding", bind: { mode: "booklet", sheets_per_group: 4 } };
}
