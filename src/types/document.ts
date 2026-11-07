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

export function clampNumber(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export const clampPages = (value: number): number =>
  Math.round(clampNumber(value, PAGES_MIN, PAGES_MAX, PAGES_MIN));

export const clampSpacingMm = (value: number): number =>
  clampNumber(value, SPACING_MM_MIN, SPACING_MM_MAX, DEFAULT_LINEAR.spacingMm);

export const clampLineWidthPt = (value: number): number =>
  clampNumber(value, LINE_WIDTH_PT_MIN, LINE_WIDTH_PT_MAX, DEFAULT_LINEAR.lineWidthPt);

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
