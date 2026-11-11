/**
 * PDF 预览的视图模式、翻页步进与目录解析纯逻辑，抽出来便于单测；
 * PdfViewer 只管渲染。
 */

/** 预览视图模式：连续滚动 / 单页翻页 / 双页对开。 */
export const PDF_VIEW_MODES = ["continuous", "single", "double"] as const;
export type PdfViewMode = (typeof PDF_VIEW_MODES)[number];

export const DEFAULT_PDF_VIEW_MODE: PdfViewMode = "continuous";

/** 持久化数据是外部输入：未知模式回落到连续滚动，避免把非法值写进 store。 */
export const isPdfViewMode = (value: unknown): value is PdfViewMode =>
  typeof value === "string" &&
  (PDF_VIEW_MODES as readonly string[]).includes(value);

const clamp = (value: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, value));

/** 双页对开：第 1 页（封面）独占，之后 [2,3]、[4,5]…（偶数页在左、奇数页在右）。 */
const spreadLeft = (active: number) =>
  active <= 1 ? 1 : active % 2 === 0 ? active : active - 1;

/**
 * 翻页步进：单页 ±1；双页按 spread 移动并落在目标 spread 的左页。
 * 已到边界时原地返回（调用方可用「落点 === 当前页」判断禁用按钮）。
 */
export function pagedStep(
  mode: "single" | "double",
  active: number,
  pageCount: number,
  dir: 1 | -1,
): number {
  if (pageCount <= 0) return active;
  if (mode === "single") return clamp(active + dir, 1, pageCount);
  const spread = active <= 1 ? 0 : Math.floor(active / 2);
  const maxSpread = Math.floor(pageCount / 2);
  const next = clamp(spread + dir, 0, maxSpread);
  return next === 0 ? 1 : next * 2;
}

/** 双页模式下与 active 同屏的页（active 本身恒包含）；第 1 页作为封面独占。 */
export function spreadPages(active: number, pageCount: number): number[] {
  if (active <= 1 || pageCount <= 1) return [1];
  const left = spreadLeft(active);
  return left + 1 <= pageCount ? [left, left + 1] : [left];
}

/** 双页模式下是否还有下一组对开页（右侧页不足时最后一页独占也算末组）。 */
export function hasNextSpread(active: number, pageCount: number): boolean {
  if (pageCount <= 1) return false;
  const maxSpread = Math.floor(pageCount / 2);
  const lastLeft = maxSpread === 0 ? 1 : maxSpread * 2;
  return spreadLeft(active) < lastLeft;
}

/** 目录条目（大纲树拍平后的阅读顺序）；page 为目标页码（1 起），解析失败为 null。
 *  id 在单次 resolveOutline 内单调分配，作为 React key（书签标题可能重复）。 */
export interface TocEntry {
  id: number;
  title: string;
  page: number | null;
  depth: number;
}

/** pdf.js 大纲节点的结构化子集，避免单测里构造完整文档对象。 */
export interface OutlineNodeLike {
  title?: string | null;
  dest?: unknown;
  items?: OutlineNodeLike[];
}

/** 目录解析用到的 pdf.js 文档方法子集。 */
export interface TocSource {
  getOutline(): Promise<OutlineNodeLike[] | null>;
  getDestination(dest: string): Promise<unknown[] | null | undefined>;
  getPageIndex(ref: unknown): Promise<number>;
}

/** 把命名/显式目的地换算成 1 起页码；无法解析时返回 null（条目保留但不可点击）。 */
export async function destPage(
  doc: TocSource,
  dest: unknown,
): Promise<number | null> {
  try {
    const explicit =
      typeof dest === "string" ? await doc.getDestination(dest) : dest;
    if (!Array.isArray(explicit) || explicit.length === 0) return null;
    const ref: unknown = explicit[0];
    // 常规情况是页引用对象 { num, gen }；数字形式按 pdf.js viewer 惯例视为 0 起页序
    if (ref !== null && typeof ref === "object") {
      return (await doc.getPageIndex(ref)) + 1;
    }
    if (typeof ref === "number") return Math.floor(ref) + 1;
    return null;
  } catch {
    return null;
  }
}

/**
 * 拍平大纲树为阅读顺序条目。
 * 先同步做一次先序展开（层级与顺序在此定下），再并发解析所有目的地；
 * 旧写法逐个子树 await，兄弟节点也会串行，深层目录要等整棵树一层层解析。
 */
export async function resolveOutline(doc: TocSource): Promise<TocEntry[]> {
  const root = await doc.getOutline();
  if (!root || root.length === 0) return [];
  const flat: { title: string; dest: unknown; depth: number }[] = [];
  const collect = (nodes: OutlineNodeLike[], depth: number) => {
    for (const node of nodes) {
      flat.push({
        title: typeof node.title === "string" ? node.title : "",
        dest: node.dest,
        depth,
      });
      if (Array.isArray(node.items) && node.items.length > 0) {
        collect(node.items, depth + 1);
      }
    }
  };
  collect(root, 0);
  const pages = await Promise.all(
    flat.map((node) =>
      node.dest != null ? destPage(doc, node.dest) : Promise.resolve(null),
    ),
  );
  return flat.map((node, id) => ({
    id,
    title: node.title,
    page: pages[id],
    depth: node.depth,
  }));
}

/** 当前页对应的目录高亮条目：阅读顺序里最后一个起始页不超过 active 的条目。 */
export function activeTocIndex(entries: TocEntry[], active: number): number {
  let found = -1;
  for (let i = 0; i < entries.length; i++) {
    const page = entries[i].page;
    if (page !== null && page <= active) found = i;
  }
  return found;
}
