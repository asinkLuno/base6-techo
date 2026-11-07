/**
 * 与 src-tauri/src/templates 的 serde camelCase 形状一一对应：
 * Document/Section/BodyTemplate 都开了 deny_unknown_fields，多余字段会被 Rust 侧拒绝。
 * 非法值在入口用 clamp 修正，不往 store 里写。
 */

export interface BlankPattern {
  kind: "blank";
}

export interface LinearPattern {
  kind: "linear";
  /** 横线间距，Rust 校验 0.1–1000mm，默认 7.0 */
  spacingMm: number;
  /** 线色，#RRGGBB，默认 #9E9E9E */
  color: string;
  /** 线宽，Rust 校验 0.01–10pt，默认 0.4 */
  lineWidthPt: number;
}

export type BodyTemplate = BlankPattern | LinearPattern;

export interface SectionSpec {
  /** 1–999，且全书合计 ≤ 999（Rust MAX_PAGES，跨节校验在生成时做） */
  pages: number;
  numbered: boolean;
  body: BodyTemplate;
}

/** 编辑态在 SectionSpec 上加前端专用稳定 id（列表 key 与拖拽用），序列化前剥离。 */
export type SectionDraft = SectionSpec & { id: string };

export const PAGES_MIN = 1;
export const PAGES_MAX = 999;
export const SPACING_MM_MIN = 0.1;
export const SPACING_MM_MAX = 1000;
export const LINE_WIDTH_PT_MIN = 0.01;
export const LINE_WIDTH_PT_MAX = 10;

/** 与 Rust LinearPattern::default 一致。 */
export const DEFAULT_LINEAR: LinearPattern = {
  kind: "linear",
  spacingMm: 7,
  color: "#9E9E9E",
  lineWidthPt: 0.4,
};

export function clampNumber(
  value: number,
  min: number,
  max: number,
  fallback: number,
): number {
  return Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export const clampPages = (value: number): number =>
  Math.round(clampNumber(value, PAGES_MIN, PAGES_MAX, PAGES_MIN));

export const clampSpacingMm = (value: number): number =>
  clampNumber(value, SPACING_MM_MIN, SPACING_MM_MAX, DEFAULT_LINEAR.spacingMm);

export const clampLineWidthPt = (value: number): number =>
  clampNumber(
    value,
    LINE_WIDTH_PT_MIN,
    LINE_WIDTH_PT_MAX,
    DEFAULT_LINEAR.lineWidthPt,
  );

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const clampColor = (value: string): string =>
  HEX_COLOR.test(value) ? value : DEFAULT_LINEAR.color;

export const clampBody = (body: BodyTemplate): BodyTemplate =>
  body.kind === "linear"
    ? {
        kind: "linear",
        spacingMm: clampSpacingMm(body.spacingMm),
        color: clampColor(body.color),
        lineWidthPt: clampLineWidthPt(body.lineWidthPt),
      }
    : { kind: "blank" };

/** 剥离前端专用 id，得到可直接 invoke 的 sections 负载。 */
export const toSectionSpecs = (sections: SectionDraft[]): SectionSpec[] =>
  sections.map(({ id: _id, ...spec }) => spec);

/** 纸张尺寸，与 Rust PaperSize（内部 tagged enum）一致；预设名为小写。 */
export type PaperSize =
  | { kind: "a4" }
  | { kind: "a5" }
  | { kind: "b5" }
  | { kind: "a6" }
  | { kind: "b6" }
  | { kind: "letter" }
  | { kind: "custom"; widthMm: number; heightMm: number };

export type Binding = "left" | "right";

export interface Margins {
  headerMm: number;
  footerMm: number;
  innerMm: number;
  outerMm: number;
}

export interface PageSettings {
  paper: PaperSize;
  binding: Binding;
  margins: Margins;
}

/** 自定义纸张范围 30–1000mm（Rust validate），回落值取 A5 尺寸。 */
export const PAPER_MM_MIN = 30;
export const PAPER_MM_MAX = 1000;
export const MARGIN_MM_MIN = 0;
export const MARGIN_MM_MAX = 1000;

/** 与 Rust PageSettings::default 一致。 */
export const DEFAULT_PAGE: PageSettings = {
  paper: { kind: "a5" },
  binding: "left",
  margins: { headerMm: 16, footerMm: 16, innerMm: 18, outerMm: 18 },
};

/** 自定义纸张非法时的回落尺寸（取 A5）。 */
export const A5_DIMS = { widthMm: 148, heightMm: 210 } as const;

export const clampPaperSize = (paper: PaperSize): PaperSize =>
  paper.kind === "custom"
    ? {
        kind: "custom",
        widthMm: clampNumber(
          paper.widthMm,
          PAPER_MM_MIN,
          PAPER_MM_MAX,
          A5_DIMS.widthMm,
        ),
        heightMm: clampNumber(
          paper.heightMm,
          PAPER_MM_MIN,
          PAPER_MM_MAX,
          A5_DIMS.heightMm,
        ),
      }
    : paper;

export const clampMargins = (margins: Margins): Margins => ({
  headerMm: clampNumber(
    margins.headerMm,
    MARGIN_MM_MIN,
    MARGIN_MM_MAX,
    DEFAULT_PAGE.margins.headerMm,
  ),
  footerMm: clampNumber(
    margins.footerMm,
    MARGIN_MM_MIN,
    MARGIN_MM_MAX,
    DEFAULT_PAGE.margins.footerMm,
  ),
  innerMm: clampNumber(
    margins.innerMm,
    MARGIN_MM_MIN,
    MARGIN_MM_MAX,
    DEFAULT_PAGE.margins.innerMm,
  ),
  outerMm: clampNumber(
    margins.outerMm,
    MARGIN_MM_MIN,
    MARGIN_MM_MAX,
    DEFAULT_PAGE.margins.outerMm,
  ),
});

export const clampPageSettings = (page: PageSettings): PageSettings => ({
  paper: clampPaperSize(page.paper),
  binding: page.binding === "right" ? "right" : "left",
  margins: clampMargins(page.margins),
});

/** 拼版/装订方式，与 Rust Imposition（tag = "mode"）一致；每张纸对折提供 4 个阅读页。 */
export type Imposition =
  | { mode: "none" }
  | { mode: "booklet" }
  | { mode: "thread"; sheetsPerSignature: number };

export const SHEETS_PER_SIGNATURE_MIN = 1;
export const SHEETS_PER_SIGNATURE_MAX = 250;

/** 与 Rust default_sheets / Imposition::default 一致。 */
export const DEFAULT_SHEETS_PER_SIGNATURE = 4;
export const DEFAULT_IMPOSITION: Imposition = { mode: "none" };

export const clampImposition = (imposition: Imposition): Imposition =>
  imposition.mode === "thread"
    ? {
        mode: "thread",
        sheetsPerSignature: clampNumber(
          imposition.sheetsPerSignature,
          SHEETS_PER_SIGNATURE_MIN,
          SHEETS_PER_SIGNATURE_MAX,
          DEFAULT_SHEETS_PER_SIGNATURE,
        ),
      }
    : imposition.mode === "booklet"
      ? { mode: "booklet" }
      : { mode: "none" };
