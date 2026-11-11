/**
 * 文档 store 的纯逻辑：section 补丁写入与持久化数据迁移。
 * 抽成纯函数后可以在不碰 zustand / localStorage 的情况下测边界与幂等性。
 */

import {
  A5_DIMS,
  type Band,
  type BandContent,
  clampBand,
  clampBody,
  clampDecorations,
  clampImposition,
  clampMargins,
  clampMarginsForPaper,
  clampPageSettings,
  clampPages,
  clampPaperSize,
  clampSectionName,
  clampTextStyle,
  DEFAULT_IMPOSITION,
  DEFAULT_LINEAR,
  DEFAULT_PAGE,
  DEFAULT_SHEETS_PER_SIGNATURE,
  type Decorations,
  diffSectionDecorations,
  diffSectionMargins,
  hasSectionOverrides,
  type Imposition,
  isPaperPresetKind,
  type Margins,
  newDecorations,
  type PageSettings,
  type PaperSize,
  resolveSectionDecorations,
  resolveSectionMargins,
  type SectionDecorationsOverride,
  type SectionDraft,
  type SectionMarginsOverride,
  type Watermark,
  type WatermarkOverride,
} from "../types/document";

/** 持久化快照的数据部分（不含 action）。 */
export interface DocumentSnapshot {
  sections: SectionDraft[];
  page: PageSettings;
  decorations: Decorations;
  imposition: Imposition;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isEmptyRecord = (value: unknown): boolean =>
  isRecord(value) && Object.keys(value).length === 0;

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const toTextStyle = (value: unknown): { sizePt: number; color: string } => {
  const data = isRecord(value) ? value : {};
  return clampTextStyle({
    sizePt: finiteOr(data.sizePt, 10),
    color: typeof data.color === "string" ? data.color : "",
  });
};

const toBandContent = (value: unknown): BandContent => {
  if (!isRecord(value)) return { kind: "empty" };
  if (value.kind === "text") {
    return {
      kind: "text",
      text: typeof value.text === "string" ? value.text : "",
    };
  }
  return value.kind === "date" ? { kind: "date" } : { kind: "empty" };
};

const toBand = (value: unknown): Band =>
  isRecord(value)
    ? clampBand({
        content: toBandContent(value.content),
        pageNumber: Boolean(value.pageNumber),
        align:
          value.align === "inner" || value.align === "outer"
            ? value.align
            : "center",
        style: toTextStyle(value.style),
      })
    : newDecorations().header;

const toWatermark = (value: unknown): Watermark | null =>
  isRecord(value)
    ? {
        text: typeof value.text === "string" ? value.text : "",
        style: toTextStyle(value.style),
      }
    : null;

const toPaper = (value: unknown): PaperSize => {
  if (!isRecord(value)) return DEFAULT_PAGE.paper;
  if (value.kind === "custom") {
    return clampPaperSize({
      kind: "custom",
      widthMm: finiteOr(value.widthMm, A5_DIMS.widthMm),
      heightMm: finiteOr(value.heightMm, A5_DIMS.heightMm),
    });
  }
  return isPaperPresetKind(value.kind)
    ? { kind: value.kind }
    : DEFAULT_PAGE.paper;
};

const toMargins = (value: unknown): Margins => {
  const data = isRecord(value) ? value : {};
  return clampMargins({
    headerMm: finiteOr(data.headerMm, DEFAULT_PAGE.margins.headerMm),
    footerMm: finiteOr(data.footerMm, DEFAULT_PAGE.margins.footerMm),
    innerMm: finiteOr(data.innerMm, DEFAULT_PAGE.margins.innerMm),
    outerMm: finiteOr(data.outerMm, DEFAULT_PAGE.margins.outerMm),
  });
};

const toPageSettings = (value: unknown): PageSettings => {
  const data = isRecord(value) ? value : {};
  return clampPageSettings({
    paper: toPaper(data.paper),
    binding: data.binding === "right" ? "right" : "left",
    margins: toMargins(data.margins),
  });
};

const toDecorations = (value: unknown): Decorations => {
  const data = isRecord(value) ? value : {};
  return clampDecorations({
    header: toBand(data.header),
    footer: toBand(data.footer),
    innerWatermark: toWatermark(data.innerWatermark),
    outerWatermark: toWatermark(data.outerWatermark),
  });
};

/** 旧版 section.decorations 是整块 Decorations，新版是逐项覆盖；两种形状都收敛成覆盖值。 */
const toDecorationsOverride = (
  value: unknown,
): SectionDecorationsOverride | null => {
  if (!isRecord(value)) return null;
  const override: SectionDecorationsOverride = {};
  if (isRecord(value.header)) override.header = toBand(value.header);
  if (isRecord(value.footer)) override.footer = toBand(value.footer);
  const inner = toWatermarkOverride(value.innerWatermark);
  if (inner) override.innerWatermark = inner;
  const outer = toWatermarkOverride(value.outerWatermark);
  if (outer) override.outerWatermark = outer;
  return hasSectionOverrides(override) ? override : null;
};

const toWatermarkOverride = (value: unknown): WatermarkOverride | undefined => {
  // 旧版整块 decorations 里 null 表示「本节没有水印」，即关闭继承来的全书水印。
  if (value === null) return { kind: "off" };
  if (!isRecord(value)) return undefined;
  if (value.kind === "off") return { kind: "off" };
  if (typeof value.text !== "string") return undefined;
  return {
    kind: "custom",
    text: value.text,
    style: toTextStyle(value.style),
  };
};

const toMarginsOverride = (value: unknown): SectionMarginsOverride | null => {
  if (!isRecord(value)) return null;
  const override: SectionMarginsOverride = {};
  for (const key of ["headerMm", "footerMm", "innerMm", "outerMm"] as const) {
    const field = value[key];
    if (typeof field === "number" && Number.isFinite(field)) {
      override[key] = field;
    }
  }
  return hasSectionOverrides(override) ? override : null;
};

const toImposition = (value: unknown): Imposition => {
  if (!isRecord(value)) return DEFAULT_IMPOSITION;
  if (value.mode === "thread") {
    return clampImposition({
      mode: "thread",
      sheetsPerSignature: finiteOr(
        value.sheetsPerSignature,
        DEFAULT_SHEETS_PER_SIGNATURE,
      ),
    });
  }
  return { mode: value.mode === "booklet" ? "booklet" : "none" };
};

/** 覆盖项收敛成与全书 diff 后的最小集合；全部相同则 null。 */
const minimalMargins = (
  override: SectionMarginsOverride,
  page: PageSettings,
): SectionMarginsOverride | null =>
  diffSectionMargins(
    clampMarginsForPaper(
      resolveSectionMargins(override, page.margins),
      page.paper,
    ),
    page.margins,
  );

const minimalDecorations = (
  override: SectionDecorationsOverride,
  global: Decorations,
): SectionDecorationsOverride | null =>
  diffSectionDecorations(
    clampDecorations(resolveSectionDecorations(override, global)),
    global,
  );

/** null = 清除覆盖；否则收敛为最小覆盖，空集合保留 {} 哨兵（已进入自定义）。 */
const patchMargins = (
  value: SectionMarginsOverride | null,
  page: PageSettings,
): SectionMarginsOverride | null =>
  value === null ? null : (minimalMargins(value, page) ?? {});

const patchDecorations = (
  value: SectionDecorationsOverride | null,
  global: Decorations,
): SectionDecorationsOverride | null =>
  value === null ? null : (minimalDecorations(value, global) ?? {});

/** 把补丁合并进一个 section，写入前 clamp；覆盖项统一收敛成与全书 diff 后的最小集合。 */
export function applySectionPatch(
  section: SectionDraft,
  patch: Partial<Omit<SectionDraft, "id">>,
  page: PageSettings,
  globalDecorations: Decorations,
): SectionDraft {
  return {
    ...section,
    ...(patch.name !== undefined && { name: clampSectionName(patch.name) }),
    ...(patch.pages !== undefined && { pages: clampPages(patch.pages) }),
    ...(patch.numbered !== undefined && { numbered: patch.numbered }),
    ...(patch.body !== undefined && { body: clampBody(patch.body) }),
    ...(patch.margins !== undefined && {
      margins: patchMargins(patch.margins, page),
    }),
    ...(patch.decorations !== undefined && {
      decorations: patchDecorations(patch.decorations, globalDecorations),
    }),
  };
}

/** 空 `{}` 是「已进入自定义但尚未改动」的哨兵，迁移时必须保留，否则继承开关会自行弹回。 */
const migrateMargins = (
  raw: unknown,
  page: PageSettings,
): SectionMarginsOverride | null => {
  const override = toMarginsOverride(raw);
  if (override) return minimalMargins(override, page) ?? null;
  return isEmptyRecord(raw) ? {} : null;
};

const migrateDecorations = (
  raw: unknown,
  decorations: Decorations,
): SectionDecorationsOverride | null => {
  const override = toDecorationsOverride(raw);
  if (override) return minimalDecorations(override, decorations) ?? null;
  return isEmptyRecord(raw) ? {} : null;
};

const migrateSection = (
  raw: Record<string, unknown>,
  id: string,
  page: PageSettings,
  decorations: Decorations,
): SectionDraft => {
  return {
    id,
    name: typeof raw.name === "string" ? clampSectionName(raw.name) : "",
    pages: clampPages(finiteOr(raw.pages, 1)),
    numbered: typeof raw.numbered === "boolean" ? raw.numbered : true,
    body: isRecord(raw.body)
      ? clampBody(raw.body as unknown as SectionDraft["body"])
      : { ...DEFAULT_LINEAR },
    margins: migrateMargins(raw.margins, page),
    decorations: migrateDecorations(raw.decorations, decorations),
  };
};

/**
 * 迁移持久化数据：所有外部输入在这里校验并 clamp，坏字段回落默认而不是整份丢弃。
 * nextId 可注入，便于测试与保证重复 id 被替换成唯一值。
 */
export function migrateDocumentState(
  persisted: unknown,
  nextId: () => string = () => crypto.randomUUID(),
): DocumentSnapshot {
  const state = isRecord(persisted) ? persisted : {};
  const page = toPageSettings(state.page);
  const decorations = toDecorations(state.decorations);
  const rawSections = Array.isArray(state.sections) ? state.sections : [];
  const usedIds = new Set<string>();

  const sections: SectionDraft[] = [];
  for (const raw of rawSections) {
    if (!isRecord(raw)) continue;
    let id = typeof raw.id === "string" && raw.id !== "" ? raw.id : nextId();
    while (usedIds.has(id)) id = nextId();
    usedIds.add(id);
    sections.push(migrateSection(raw, id, page, decorations));
  }

  return {
    sections,
    page,
    decorations,
    imposition: toImposition(state.imposition),
  };
}

/** 水合合并：当前 state（含 action）打底，持久化数据经迁移校验后覆盖数据字段。 */
export function mergeDocumentState<T extends DocumentSnapshot>(
  persisted: unknown,
  current: T,
): T {
  return { ...current, ...migrateDocumentState(persisted) };
}
