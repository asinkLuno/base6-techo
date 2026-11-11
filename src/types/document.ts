/**
 * 与 src-tauri/src/templates 的 serde camelCase 形状一一对应：
 * Document/Section/BodyTemplate 都开了 deny_unknown_fields，多余字段会被 Rust 侧拒绝。
 * 非法值在入口用 clamp 修正，不往 store 里写。
 */

export interface BlankPattern {
  kind: "blank";
}

/** 美式横线本的左侧竖线：贯穿整页高度，不受页头/页脚区域限制。 */
export interface MarginLine {
  /** 距纸张左缘，Rust 校验 0–1000mm，默认 25 */
  xMm: number;
  /** 竖线颜色，#RRGGBB，默认 #D96A6A */
  color: string;
  /** 竖线宽度，Rust 校验 0.01–10pt，默认 0.4 */
  widthPt: number;
}

export interface LinearPattern {
  kind: "linear";
  /** 横线间距，Rust 校验 0.1–1000mm，默认 7.0 */
  spacingMm: number;
  /** 线色，#RRGGBB，默认 #9E9E9E */
  color: string;
  /** 线宽，Rust 校验 0.01–10pt，默认 0.4 */
  lineWidthPt: number;
  /** null = 不画左侧竖线；给出对象时画出美式横线本的边线。 */
  marginLine: MarginLine | null;
}

export interface DotsPattern {
  kind: "dots";
  /** 行距（竖向点距），Rust 校验 0.1–1000mm，默认 5.0 */
  spacingMm: number;
  /** 列距（横向点距），Rust 校验 0.1–1000mm，默认 5.0 */
  columnSpacingMm: number;
  /** 点半径，Rust 校验 0.01–10mm，默认 0.25 */
  radiusMm: number;
  /** 点色，#RRGGBB，默认 #7A7A7A */
  color: string;
  /** 中心点单独颜色，#RRGGBB，默认 #000000 */
  centerColor: string;
}

export interface GridPattern {
  kind: "grid";
  /** 方格间距，Rust 校验 0.1–1000mm，默认 5.0 */
  spacingMm: number;
  /** 线色，#RRGGBB，默认 #7A9AC9 */
  color: string;
  /** 线宽，Rust 校验 0.01–10pt，默认 0.2 */
  lineWidthPt: number;
}

/** 方眼罫（复刻 Midori）：5mm 格、断口与外伸线固定，只开放颜色。 */
export interface HogenPattern {
  kind: "hogen";
  /** 格线与标记点共用的颜色，#RRGGBB，默认 #A9D1AE */
  color: string;
}

export type BodyTemplate =
  | BlankPattern
  | LinearPattern
  | DotsPattern
  | GridPattern
  | HogenPattern;

/** 页头/页脚内容，与 Rust BandContent（tag = "kind"）一致。 */
export type BandContent =
  | { kind: "empty" }
  | { kind: "text"; text: string }
  | { kind: "date" };

/** 对齐方式；inner/outer 按物理页的装订侧解析，与 Rust Align 一致。 */
export type Align = "center" | "inner" | "outer";

export interface TextStyle {
  /** Rust 校验 1–72pt，默认 10 */
  sizePt: number;
  /** #RRGGBB，默认 #000000 */
  color: string;
}

export interface Band {
  content: BandContent;
  /** 是否在该页头/页脚显示本节页码（是否消耗页码仍由 section.numbered 决定） */
  pageNumber: boolean;
  align: Align;
  style: TextStyle;
}

export interface Watermark {
  text: string;
  style: TextStyle;
}

/** 全书默认装饰；section 未覆盖的项实时继承这份。 */
export interface Decorations {
  header: Band;
  footer: Band;
  innerWatermark: Watermark | null;
  outerWatermark: Watermark | null;
}

/** section 的边距覆盖：只存与全书不同的字段，缺省字段实时跟随全书。 */
export type SectionMarginsOverride = Partial<Margins>;

/** 水印覆盖：off = 本节关闭，custom = 本节自定义；缺省 = 实时继承全书。 */
export type WatermarkOverride =
  | { kind: "off" }
  | { kind: "custom"; text: string; style: TextStyle };

/** section 的装饰覆盖：只存与全书不同的部件，缺省部件实时跟随全书。 */
export interface SectionDecorationsOverride {
  header?: Band;
  footer?: Band;
  innerWatermark?: WatermarkOverride;
  outerWatermark?: WatermarkOverride;
}

/** 发送给生成接口的 section：边距与装饰已按全书设定解析为完整值。 */
export interface SectionSpec {
  /** 1–999，且全书合计 ≤ 999（Rust MAX_PAGES，跨节校验在生成时做） */
  pages: number;
  numbered: boolean;
  body: BodyTemplate;
  /** null = 继承 Document.page.margins；否则本节使用自己的四周边距。 */
  margins: Margins | null;
  /** null = 继承 Document.decorations；否则整块覆盖。 */
  decorations: Decorations | null;
}

/**
 * 编辑态 section：只存本节覆盖项，序列化前再与全书设定合并。
 * null = 完全继承；{} = 已进入自定义但尚未改动任何项。
 */
export interface SectionDraft {
  /** 前端专用稳定 id（列表 key 与拖拽用），序列化前剥离。 */
  id: string;
  pages: number;
  numbered: boolean;
  body: BodyTemplate;
  margins: SectionMarginsOverride | null;
  decorations: SectionDecorationsOverride | null;
}

export const PAGES_MIN = 1;
export const PAGES_MAX = 999;
export const SPACING_MM_MIN = 0.1;
export const SPACING_MM_MAX = 1000;
export const LINE_WIDTH_PT_MIN = 0.01;
export const LINE_WIDTH_PT_MAX = 10;
export const MARGIN_LINE_X_MM_MIN = 0;
export const MARGIN_LINE_X_MM_MAX = 1000;
export const DOT_RADIUS_MM_MIN = 0.01;
export const DOT_RADIUS_MM_MAX = 10;
export const TEXT_SIZE_PT_MIN = 1;
export const TEXT_SIZE_PT_MAX = 72;

/** 与 Rust MarginLine::default 一致。 */
export const DEFAULT_MARGIN_LINE: MarginLine = {
  xMm: 25,
  color: "#D96A6A",
  widthPt: 0.4,
};

/** 与 Rust LinearPattern::default 一致。 */
export const DEFAULT_LINEAR: LinearPattern = {
  kind: "linear",
  spacingMm: 7,
  color: "#9E9E9E",
  lineWidthPt: 0.4,
  marginLine: null,
};

/** 与 Rust DotsPattern::default 一致。 */
export const DEFAULT_DOTS: DotsPattern = {
  kind: "dots",
  spacingMm: 5,
  columnSpacingMm: 5,
  radiusMm: 0.25,
  color: "#7A7A7A",
  centerColor: "#000000",
};

/** 与 Rust GridPattern::default 一致。 */
export const DEFAULT_GRID: GridPattern = {
  kind: "grid",
  spacingMm: 5,
  color: "#7A9AC9",
  lineWidthPt: 0.2,
};

/** 与 Rust HogenPattern::default 一致。 */
export const DEFAULT_HOGEN: HogenPattern = {
  kind: "hogen",
  color: "#A9D1AE",
};

/** 与 Rust Band::default / TextStyle::default 一致的空页头。 */
const newBand = (): Band => ({
  content: { kind: "empty" },
  pageNumber: false,
  align: "center",
  style: { sizePt: 10, color: "#000000" },
});

/** 与 Rust Decorations::default 一致。 */
export const newDecorations = (): Decorations => ({
  header: newBand(),
  footer: newBand(),
  innerWatermark: null,
  outerWatermark: null,
});

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

/** 同一范围 + 回落值的数字 clamp；各模板参数只声明一次范围。 */
const clampRange =
  (min: number, max: number, fallback: number) =>
  (value: number): number =>
    clampNumber(value, min, max, fallback);

export const clampSpacingMm = clampRange(
  SPACING_MM_MIN,
  SPACING_MM_MAX,
  DEFAULT_LINEAR.spacingMm,
);

export const clampLineWidthPt = clampRange(
  LINE_WIDTH_PT_MIN,
  LINE_WIDTH_PT_MAX,
  DEFAULT_LINEAR.lineWidthPt,
);

export const clampMarginLineXMm = clampRange(
  MARGIN_LINE_X_MM_MIN,
  MARGIN_LINE_X_MM_MAX,
  DEFAULT_MARGIN_LINE.xMm,
);

export const clampMarginLineWidthPt = clampRange(
  LINE_WIDTH_PT_MIN,
  LINE_WIDTH_PT_MAX,
  DEFAULT_MARGIN_LINE.widthPt,
);

export const clampDotsSpacingMm = clampRange(
  SPACING_MM_MIN,
  SPACING_MM_MAX,
  DEFAULT_DOTS.spacingMm,
);

export const clampDotsColumnSpacingMm = clampRange(
  SPACING_MM_MIN,
  SPACING_MM_MAX,
  DEFAULT_DOTS.columnSpacingMm,
);

export const clampDotRadiusMm = clampRange(
  DOT_RADIUS_MM_MIN,
  DOT_RADIUS_MM_MAX,
  DEFAULT_DOTS.radiusMm,
);

export const clampGridSpacingMm = clampRange(
  SPACING_MM_MIN,
  SPACING_MM_MAX,
  DEFAULT_GRID.spacingMm,
);

export const clampGridLineWidthPt = clampRange(
  LINE_WIDTH_PT_MIN,
  LINE_WIDTH_PT_MAX,
  DEFAULT_GRID.lineWidthPt,
);

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const clampColor = (
  value: string,
  fallback: string = DEFAULT_LINEAR.color,
): string => (HEX_COLOR.test(value) ? value : fallback);

export const clampMarginLine = (line: MarginLine): MarginLine => ({
  xMm: clampMarginLineXMm(line.xMm),
  color: clampColor(line.color, DEFAULT_MARGIN_LINE.color),
  widthPt: clampMarginLineWidthPt(line.widthPt),
});

export const clampTextStyle = (style: TextStyle): TextStyle => ({
  sizePt: clampNumber(style.sizePt, TEXT_SIZE_PT_MIN, TEXT_SIZE_PT_MAX, 10),
  color: clampColor(style.color, "#000000"),
});

export const clampBand = (band: Band): Band => ({
  content:
    band.content.kind === "text"
      ? { kind: "text", text: band.content.text }
      : band.content.kind === "date"
        ? { kind: "date" }
        : { kind: "empty" },
  pageNumber: Boolean(band.pageNumber),
  align:
    band.align === "inner" || band.align === "outer" ? band.align : "center",
  style: clampTextStyle(band.style),
});

export const clampWatermark = (
  watermark: Watermark | null,
): Watermark | null =>
  watermark
    ? { text: watermark.text, style: clampTextStyle(watermark.style) }
    : null;

export const clampDecorations = (decorations: Decorations): Decorations => ({
  header: clampBand(decorations.header),
  footer: clampBand(decorations.footer),
  innerWatermark: clampWatermark(decorations.innerWatermark),
  outerWatermark: clampWatermark(decorations.outerWatermark),
});

export const clampBody = (body: BodyTemplate): BodyTemplate => {
  switch (body.kind) {
    case "linear":
      return {
        kind: "linear",
        spacingMm: clampSpacingMm(body.spacingMm),
        color: clampColor(body.color),
        lineWidthPt: clampLineWidthPt(body.lineWidthPt),
        marginLine: body.marginLine ? clampMarginLine(body.marginLine) : null,
      };
    case "dots":
      return {
        kind: "dots",
        spacingMm: clampDotsSpacingMm(body.spacingMm),
        columnSpacingMm: clampDotsColumnSpacingMm(body.columnSpacingMm),
        radiusMm: clampDotRadiusMm(body.radiusMm),
        color: clampColor(body.color, DEFAULT_DOTS.color),
        centerColor: clampColor(body.centerColor, DEFAULT_DOTS.centerColor),
      };
    case "grid":
      return {
        kind: "grid",
        spacingMm: clampGridSpacingMm(body.spacingMm),
        color: clampColor(body.color, DEFAULT_GRID.color),
        lineWidthPt: clampGridLineWidthPt(body.lineWidthPt),
      };
    case "hogen":
      return {
        kind: "hogen",
        color: clampColor(body.color, DEFAULT_HOGEN.color),
      };
    default:
      return { kind: "blank" };
  }
};

/** 剥离前端专用 id，并把 section 覆盖项与全书设定合并成可直接 invoke 的负载。 */
export const toSectionSpecs = (
  sections: SectionDraft[],
  page: PageSettings,
  decorations: Decorations,
): SectionSpec[] =>
  sections.map(
    ({ id: _id, margins, decorations: decorationOverride, ...spec }) => ({
      ...spec,
      margins: hasSectionOverrides(margins)
        ? clampMarginsForPaper(
            resolveSectionMargins(margins, page.margins),
            page.paper,
          )
        : null,
      decorations: hasSectionOverrides(decorationOverride)
        ? clampDecorations(
            resolveSectionDecorations(decorationOverride, decorations),
          )
        : null,
    }),
  );

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

/** 预设纸张尺寸（mm），与 Rust PaperSize::dims_mm 一致。 */
const PRESET_DIMS_MM = {
  a4: { widthMm: 210, heightMm: 297 },
  a5: A5_DIMS,
  b5: { widthMm: 176, heightMm: 250 },
  a6: { widthMm: 105, heightMm: 148 },
  b6: { widthMm: 128, heightMm: 182 },
  letter: { widthMm: 215.9, heightMm: 279.4 },
} as const;

export type PaperPresetKind = Exclude<PaperSize["kind"], "custom">;

/** 预设纸张名（不含 custom），供下拉选项与外部数据校验共用。 */
export const PAPER_PRESET_KINDS = Object.keys(
  PRESET_DIMS_MM,
) as PaperPresetKind[];

export const isPaperPresetKind = (value: unknown): value is PaperPresetKind =>
  typeof value === "string" && value in PRESET_DIMS_MM;

export const paperDimsMm = (
  paper: PaperSize,
): { widthMm: number; heightMm: number } =>
  paper.kind === "custom"
    ? { widthMm: paper.widthMm, heightMm: paper.heightMm }
    : PRESET_DIMS_MM[paper.kind];

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

/** 单侧留白上限：对侧已占 opposite 时，页心仍至少留 1mm。 */
export const maxMarginMm = (dimensionMm: number, oppositeMm: number): number =>
  Math.max(MARGIN_MM_MIN, dimensionMm - oppositeMm - 1);

/** 同一方向的两段留白合计不得超过纸张尺寸减 1mm（Rust 要求页心至少 1mm）。 */
const clampMarginPair = (
  a: number,
  b: number,
  dimensionMm: number,
): [number, number] => {
  const first = Math.min(a, maxMarginMm(dimensionMm, 0));
  return [first, Math.min(b, maxMarginMm(dimensionMm, first))];
};

/** 按纸张尺寸压缩边距，保证扣除后的页心宽高仍至少 1mm。 */
export const clampMarginsForPaper = (
  margins: Margins,
  paper: PaperSize,
): Margins => {
  const clamped = clampMargins(margins);
  const dims = paperDimsMm(paper);
  const [headerMm, footerMm] = clampMarginPair(
    clamped.headerMm,
    clamped.footerMm,
    dims.heightMm,
  );
  const [innerMm, outerMm] = clampMarginPair(
    clamped.innerMm,
    clamped.outerMm,
    dims.widthMm,
  );
  return { headerMm, footerMm, innerMm, outerMm };
};

export const clampPageSettings = (page: PageSettings): PageSettings => {
  const paper = clampPaperSize(page.paper);
  return {
    paper,
    binding: page.binding === "right" ? "right" : "left",
    margins: clampMarginsForPaper(page.margins, paper),
  };
};

/** 把 section 的边距覆盖与全书设定合并成完整四边距。 */
export const resolveSectionMargins = (
  override: SectionMarginsOverride | null,
  global: Margins,
): Margins => ({
  headerMm: override?.headerMm ?? global.headerMm,
  footerMm: override?.footerMm ?? global.footerMm,
  innerMm: override?.innerMm ?? global.innerMm,
  outerMm: override?.outerMm ?? global.outerMm,
});

/** 只保留与全书不同的边距字段；全部相同则返回 null。 */
export const diffSectionMargins = (
  own: Margins,
  global: Margins,
): SectionMarginsOverride | null => {
  const override: SectionMarginsOverride = {};
  if (own.headerMm !== global.headerMm) override.headerMm = own.headerMm;
  if (own.footerMm !== global.footerMm) override.footerMm = own.footerMm;
  if (own.innerMm !== global.innerMm) override.innerMm = own.innerMm;
  if (own.outerMm !== global.outerMm) override.outerMm = own.outerMm;
  return hasSectionOverrides(override) ? override : null;
};

const styleEqual = (a: TextStyle, b: TextStyle): boolean =>
  a.sizePt === b.sizePt && a.color === b.color;

const contentEqual = (a: BandContent, b: BandContent): boolean =>
  a.kind === "text" && b.kind === "text"
    ? a.text === b.text
    : a.kind === b.kind;

const bandEqual = (a: Band, b: Band): boolean =>
  a.pageNumber === b.pageNumber &&
  a.align === b.align &&
  styleEqual(a.style, b.style) &&
  contentEqual(a.content, b.content);

const watermarkEqual = (a: Watermark | null, b: Watermark | null): boolean =>
  a === null || b === null
    ? a === b
    : a.text === b.text && styleEqual(a.style, b.style);

const resolveWatermark = (
  override: WatermarkOverride | undefined,
  global: Watermark | null,
): Watermark | null => {
  if (override === undefined) return global;
  return override.kind === "off"
    ? null
    : { text: override.text, style: { ...override.style } };
};

/** 把 section 的装饰覆盖与全书设定合并成完整装饰。 */
export const resolveSectionDecorations = (
  override: SectionDecorationsOverride | null,
  global: Decorations,
): Decorations => ({
  header: override?.header ?? global.header,
  footer: override?.footer ?? global.footer,
  innerWatermark: resolveWatermark(
    override?.innerWatermark,
    global.innerWatermark,
  ),
  outerWatermark: resolveWatermark(
    override?.outerWatermark,
    global.outerWatermark,
  ),
});

/** 只保留与全书不同的装饰部件；全部相同则返回 null。 */
export const diffSectionDecorations = (
  own: Decorations,
  global: Decorations,
): SectionDecorationsOverride | null => {
  const override: SectionDecorationsOverride = {};
  if (!bandEqual(own.header, global.header)) override.header = own.header;
  if (!bandEqual(own.footer, global.footer)) override.footer = own.footer;
  if (!watermarkEqual(own.innerWatermark, global.innerWatermark)) {
    override.innerWatermark =
      own.innerWatermark === null
        ? { kind: "off" }
        : { kind: "custom", ...own.innerWatermark };
  }
  if (!watermarkEqual(own.outerWatermark, global.outerWatermark)) {
    override.outerWatermark =
      own.outerWatermark === null
        ? { kind: "off" }
        : { kind: "custom", ...own.outerWatermark };
  }
  return hasSectionOverrides(override) ? override : null;
};

/** null 与空对象都表示「没有本节覆盖」，生成时回落到全书设定。 */
export const hasSectionOverrides = (
  override: SectionMarginsOverride | SectionDecorationsOverride | null,
): boolean => override !== null && Object.keys(override).length > 0;

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
