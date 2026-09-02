export type Output = string;
/**
 * @minItems 1
 */
export type Sections = [RenderSectionRequest, ...RenderSectionRequest[]];
export type Width = number;
export type Height = number;
export type Header = number;
export type Footer = number;
export type Binding = number;
export type NonBinding = number;
export type PageNumber = boolean;
export type BindingText = string | null;
export type BindingText2 = string | null;
export type BindingTextSize = number;
export type BindingText2Size = number;
export type BindingTextSpacing = number;
export type BindingTextEdge = number | null;
export type BindingTextFont = string;
export type BindingTextColor = string;
export type NonBindingText = string | null;
export type NonBindingText2 = string | null;
export type NonBindingTextSize = number;
export type NonBindingText2Size = number;
export type NonBindingTextSpacing = number;
export type NonBindingTextEdge = number | null;
export type NonBindingTextColor = string;
export type Pattern = DotsPatternRequest | GridPatternRequest | RuledPatternRequest | SeyesPatternRequest | UsRuledPatternRequest | VerticalPatternRequest | BunkwanPatternRequest | MidoriPatternRequest | TimelinePatternRequest;
export type Kind = "dots" | "grid" | "ruled" | "seyes" | "us-ruled" | "vertical";
export type Spacing = number;
export type LineWidth = number;
export type LineColor = string;
export type LineStyle = "solid" | "dashed" | "dotted" | "dash-dot" | "double-solid";
export type DrawHlines = boolean;
export type DrawVlines = boolean;
export type DrawDots = boolean;
export type HlineTopColor = string;
export type HlineTopWidth = number;
export type HlineTopStyle = LineStyle;
export type HlineBottomColor = string;
export type HlineBottomWidth = number;
export type HlineBottomStyle = LineStyle;
export type HlineCenterColor = string;
export type HlineCenterWidth = number;
export type HlineCenterStyle = LineStyle;
export type VlineLeftColor = string;
export type VlineLeftWidth = number;
export type VlineLeftStyle = LineStyle;
export type VlineRightColor = string;
export type VlineRightWidth = number;
export type VlineRightStyle = LineStyle;
export type VlineCenterColor = string;
export type VlineCenterWidth = number;
export type VlineCenterStyle = LineStyle;
export type DotCenterColor = string | null;
export type HlineHeader = boolean;
export type HlineFooter = boolean;
export type HlineInner = boolean;
export type HlineOuter = boolean;
export type VlineHeader = boolean;
export type VlineFooter = boolean;
export type VlineInner = boolean;
export type VlineOuter = boolean;
export type DotHeader = boolean;
export type DotFooter = boolean;
export type DotInner = boolean;
export type DotOuter = boolean;
export type DotSpacing = number | null;
export type DotRadius = number;
export type VlineSpacing = number | null;
export type VlineWidth = number;
export type VlineColor = string;
export type VlineStyle = LineStyle;
export type HlineTop = number;
export type HlineBottom = number;
export type HlineLeft = number;
export type HlineRight = number;
export type VlineTop = number;
export type VlineBottom = number;
export type VlineLeft = number;
export type VlineRight = number;
export type DotTop = number;
export type DotBottom = number;
export type DotLeft = number;
export type DotRight = number;
export type Kind3 = "bunkwan";
export type FaintColor = string;
export type Kind1 = "midori";
export type Spacing1 = number;
export type Gap = number;
export type EdgeExtension = number;
export type DotFrequency = number;
export type DotRadius1 = number;
export type LineWidth1 = number;
export type LineColor1 = string;
export type DotColor = string;
export type Header1 = boolean;
export type Footer1 = boolean;
export type Inner = boolean;
export type Outer = boolean;
export type Kind2 = "timeline";
export type Start = number;
export type End = number;
export type Pages = number;
export type ColumnSpacing = number;
export type Radius = number;
export type Color = string;
export type LineColor2 = string;
export type LineWidth2 = number;
export type LabelSize = number;
export type Latitude = number | null;
export type Longitude = number | null;
export type Timezone = string | null;
export type DaylightColor = string;
export type NightColor = string;
export type StartDate = string | null;
export type EndDate = string | null;
export type Mode = ("booklet" | "thread") | null;
export type SheetsPerGroup = number;

export interface RunPipelineRequest {
  output: Output;
  sections: Sections;
  bind?: BindRequest;
}
export interface RenderSectionRequest {
  page?: PageRequest;
  document?: DocumentRequest;
  pattern: Pattern;
  holidays?: Record<string, string>;
  title?: string;
}
export interface PageRequest {
  width?: Width;
  height?: Height;
  header?: Header;
  footer?: Footer;
  binding?: Binding;
  non_binding?: NonBinding;
}
export interface DocumentRequest {
  page_number?: PageNumber;
  header?: BandRequest;
  footer?: BandRequest;
  binding_text?: BindingText;
  binding_text_2?: BindingText2;
  binding_text_size?: BindingTextSize;
  binding_text_2_size?: BindingText2Size;
  binding_text_spacing?: BindingTextSpacing;
  binding_text_edge?: BindingTextEdge;
  binding_text_font?: BindingTextFont;
  binding_text_color?: BindingTextColor;
  non_binding_text?: NonBindingText;
  non_binding_text_2?: NonBindingText2;
  non_binding_text_size?: NonBindingTextSize;
  non_binding_text_2_size?: NonBindingText2Size;
  non_binding_text_spacing?: NonBindingTextSpacing;
  non_binding_text_edge?: NonBindingTextEdge;
  non_binding_text_color?: NonBindingTextColor;
}
export interface BandRequest {
  text?: BindingText;
  text_2?: BindingText2;
  text_size?: BindingTextSize;
  text_2_size?: BindingText2Size;
  text_spacing?: BindingTextSpacing;
  text_color?: BindingTextColor;
  page_number?: PageNumber;
}
export interface DotsPatternRequest {
  kind?: Kind;
  pages?: Pages;
  spacing?: Spacing;
  column_spacing?: ColumnSpacing;
  radius?: Radius;
  color?: Color;
  center_color?: Color;
}
export interface GridPatternRequest {
  kind?: Kind;
  pages?: Pages;
  spacing?: Spacing;
  color?: Color;
  width?: Width;
}
export interface RuledPatternRequest {
  kind?: Kind;
  pages?: Pages;
  spacing?: Spacing;
  color?: Color;
  width?: Width;
}export interface SeyesPatternRequest {
  kind?: Kind;
  pages?: Pages;
  spacing?: Spacing;
  margin_line?: number;
  main_color?: Color;
  main_width?: Width;
  fine_color?: Color;
  fine_width?: Width;
  vline_color?: Color;
  vline_width?: Width;
  margin_color?: Color;
  margin_width?: Width;
}
export interface VerticalPatternRequest {
  kind?: Kind;
  pages?: Pages;
  spacing?: Spacing;
  color?: Color;
  frame_outer_width?: number;
  frame_inner_width?: number;
  frame_gap?: number;
}
export interface UsRuledPatternRequest {
  kind?: Kind;
  pages?: Pages;
  spacing?: Spacing;
  rule_color?: Color;
  rule_width?: Width;
  margin_x?: number;
  margin_color?: Color;
  margin_width?: Width;
}
export interface MidoriPatternRequest {
  kind?: Kind1;
  spacing?: Spacing1;
  gap?: Gap;
  edge_extension?: EdgeExtension;
  dot_frequency?: DotFrequency;
  dot_radius?: DotRadius1;
  line_width?: LineWidth1;
  line_color?: LineColor1;
  dot_color?: DotColor;
  header?: Header1;
  footer?: Footer1;
  inner?: Inner;
  outer?: Outer;
}
export interface BunkwanPatternRequest {
  kind?: Kind3;
  line_color?: LineColor;
  faint_color?: FaintColor;
  line_width?: LineWidth;
}
export interface TimelinePatternRequest {
  kind?: Kind2;
  start?: Start;
  end?: End;
  pages?: Pages;
  start_date?: StartDate;
  end_date?: EndDate;
  title_format?: string;
  line_color?: LineColor2;
  line_width?: LineWidth2;
  label_size?: LabelSize;
  latitude?: Latitude,
  longitude?: Longitude;
  timezone?: Timezone;
  daylight_color?: DaylightColor;
  night_color?: NightColor;
}
export interface BindRequest {
  mode?: Mode;
  sheets_per_group?: SheetsPerGroup;
}
