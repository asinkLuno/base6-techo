import { describe, expect, it } from "vitest";
import {
  activeTocIndex,
  destPage,
  hasNextSpread,
  isPdfViewMode,
  type OutlineNodeLike,
  pagedStep,
  resolveOutline,
  spreadPages,
  type TocSource,
} from "./pdfView";

describe("isPdfViewMode", () => {
  it("只接受三档已知模式，其余外部值一律拒绝", () => {
    expect(isPdfViewMode("continuous")).toBe(true);
    expect(isPdfViewMode("single")).toBe(true);
    expect(isPdfViewMode("double")).toBe(true);
    expect(isPdfViewMode("booklet")).toBe(false);
    expect(isPdfViewMode(1)).toBe(false);
    expect(isPdfViewMode(undefined)).toBe(false);
  });
});

describe("pagedStep", () => {
  it("单页模式逐页步进并在边界停住", () => {
    expect(pagedStep("single", 1, 9, 1)).toBe(2);
    expect(pagedStep("single", 9, 9, 1)).toBe(9);
    expect(pagedStep("single", 1, 9, -1)).toBe(1);
    expect(pagedStep("single", 3, 9, -1)).toBe(2);
  });

  it("双页模式按对开页移动：1 → 2 → 4 → 6 …", () => {
    expect(pagedStep("double", 1, 9, 1)).toBe(2);
    expect(pagedStep("double", 2, 9, 1)).toBe(4);
    expect(pagedStep("double", 3, 9, 1)).toBe(4);
    expect(pagedStep("double", 4, 9, 1)).toBe(6);
  });

  it("双页模式向前翻落在上一组对开页的左页", () => {
    expect(pagedStep("double", 2, 9, -1)).toBe(1);
    expect(pagedStep("double", 3, 9, -1)).toBe(1);
    expect(pagedStep("double", 4, 9, -1)).toBe(2);
    expect(pagedStep("double", 5, 9, -1)).toBe(2);
  });

  it("双页模式到最后一组后停住", () => {
    // 9 页：spread 为 [1] [2,3] [4,5] [6,7] [8,9]
    expect(pagedStep("double", 8, 9, 1)).toBe(8);
    expect(pagedStep("double", 9, 9, 1)).toBe(8);
    // 6 页：最后一组是 [6] 独占
    expect(pagedStep("double", 6, 6, 1)).toBe(6);
    expect(pagedStep("double", 5, 6, 1)).toBe(6);
  });
});

describe("spreadPages", () => {
  it("第 1 页作为封面独占", () => {
    expect(spreadPages(1, 9)).toEqual([1]);
  });

  it("偶数页在左、奇数页在右", () => {
    expect(spreadPages(2, 9)).toEqual([2, 3]);
    expect(spreadPages(3, 9)).toEqual([2, 3]);
    expect(spreadPages(4, 9)).toEqual([4, 5]);
  });

  it("全书末页为奇数时右页存在，为偶数时末页独占", () => {
    expect(spreadPages(8, 9)).toEqual([8, 9]);
    expect(spreadPages(6, 6)).toEqual([6]);
  });

  it("页数不足 2 时恒为单页", () => {
    expect(spreadPages(1, 1)).toEqual([1]);
  });
});

describe("hasNextSpread", () => {
  it("最后一组对开页不再有下一组", () => {
    expect(hasNextSpread(1, 9)).toBe(true);
    expect(hasNextSpread(7, 9)).toBe(true);
    expect(hasNextSpread(8, 9)).toBe(false);
    expect(hasNextSpread(9, 9)).toBe(false);
    expect(hasNextSpread(5, 6)).toBe(true);
    expect(hasNextSpread(6, 6)).toBe(false);
    expect(hasNextSpread(1, 1)).toBe(false);
  });
});

/** 构造只含目录解析所需方法的最小文档替身。 */
function fakeDoc(
  outline: OutlineNodeLike[] | null,
  named: Record<string, unknown[]> = {},
  pageIndexByNum: Record<number, number> = {},
): TocSource {
  return {
    async getOutline() {
      return outline;
    },
    async getDestination(dest) {
      return named[dest] ?? null;
    },
    async getPageIndex(ref) {
      const num = (ref as { num: number }).num;
      if (!(num in pageIndexByNum)) throw new Error(`unknown ref ${num}`);
      return pageIndexByNum[num];
    },
  };
}

describe("destPage", () => {
  it("命名目的地经 getDestination + getPageIndex 换算成 1 起页码", async () => {
    const doc = fakeDoc(null, { chap1: [{ num: 3, gen: 0 }, "XYZ"] }, { 3: 4 });
    await expect(destPage(doc, "chap1")).resolves.toBe(5);
  });

  it("显式目的地数组直接取页引用", async () => {
    const doc = fakeDoc(null, {}, { 10: 9 });
    await expect(destPage(doc, [{ num: 10, gen: 0 }])).resolves.toBe(10);
  });

  it("数字形式的页引用按 0 起页序处理", async () => {
    const doc = fakeDoc(null);
    await expect(destPage(doc, [7, { name: "Fit" }])).resolves.toBe(8);
  });

  it("未知命名目的地 / 空数组 / 解析失败返回 null", async () => {
    const doc = fakeDoc(null);
    await expect(destPage(doc, "missing")).resolves.toBeNull();
    await expect(destPage(doc, [])).resolves.toBeNull();
    await expect(destPage(doc, [{ num: 99, gen: 0 }])).resolves.toBeNull();
    await expect(destPage(doc, null)).resolves.toBeNull();
  });
});

describe("resolveOutline", () => {
  it("按阅读顺序拍平树并标出层级，同级并行解析后保持原序", async () => {
    const doc = fakeDoc(
      [
        {
          title: "Part 1",
          dest: "p1",
          items: [
            { title: "Chapter 1", dest: "c1" },
            { title: "Chapter 2", dest: [{ num: 5, gen: 0 }] },
          ],
        },
        { title: "Backmatter", dest: null },
        // 真实 pdf.js 标题恒为 string，这里故意给非字符串测兜底
        { title: 42 as unknown as string, dest: "p1" },
      ],
      { p1: [{ num: 0, gen: 0 }], c1: [{ num: 2, gen: 0 }] },
      { 0: 0, 2: 2, 5: 5 },
    );
    await expect(resolveOutline(doc)).resolves.toEqual([
      { id: 0, title: "Part 1", page: 1, depth: 0 },
      { id: 1, title: "Chapter 1", page: 3, depth: 1 },
      { id: 2, title: "Chapter 2", page: 6, depth: 1 },
      { id: 3, title: "Backmatter", page: null, depth: 0 },
      { id: 4, title: "", page: 1, depth: 0 },
    ]);
  });

  it("单子节点也会递归展开", async () => {
    const doc = fakeDoc(
      [
        {
          title: "Parent",
          dest: "p",
          items: [{ title: "Only child", dest: "c" }],
        },
      ],
      { p: [{ num: 0, gen: 0 }], c: [{ num: 1, gen: 0 }] },
      { 0: 0, 1: 1 },
    );
    await expect(resolveOutline(doc)).resolves.toEqual([
      { id: 0, title: "Parent", page: 1, depth: 0 },
      { id: 1, title: "Only child", page: 2, depth: 1 },
    ]);
  });

  it("整棵树的兄弟子树并发解析", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const pendingResolvers: (() => void)[] = [];
    const doc: TocSource = {
      async getOutline() {
        return [
          { title: "A", dest: "a", items: [{ title: "A1", dest: "a1" }] },
          { title: "B", dest: "b", items: [{ title: "B1", dest: "b1" }] },
        ];
      },
      getDestination() {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return new Promise((resolve) => {
          pendingResolvers.push(() => {
            inFlight--;
            resolve([7, { name: "Fit" }]);
          });
        });
      },
      async getPageIndex() {
        return 0;
      },
    };

    const resolved = resolveOutline(doc);
    // 等 getOutline 的 await 落地：所有目的地此时应已同时发出
    await Promise.resolve();
    expect(maxInFlight).toBe(4);
    for (const settle of pendingResolvers) settle();
    await expect(resolved).resolves.toEqual([
      { id: 0, title: "A", page: 8, depth: 0 },
      { id: 1, title: "A1", page: 8, depth: 1 },
      { id: 2, title: "B", page: 8, depth: 0 },
      { id: 3, title: "B1", page: 8, depth: 1 },
    ]);
  });

  it("无大纲 / 空大纲返回空数组", async () => {
    await expect(resolveOutline(fakeDoc(null))).resolves.toEqual([]);
    await expect(resolveOutline(fakeDoc([]))).resolves.toEqual([]);
  });
});

describe("activeTocIndex", () => {
  const entries = [
    { id: 0, title: "a", page: 1, depth: 0 },
    { id: 1, title: "b", page: 3, depth: 0 },
    { id: 2, title: "c", page: 3, depth: 1 },
    { id: 3, title: "d", page: 7, depth: 0 },
  ];

  it("取最后一个起始页不超过当前页的条目", () => {
    expect(activeTocIndex(entries, 1)).toBe(0);
    expect(activeTocIndex(entries, 2)).toBe(0);
    expect(activeTocIndex(entries, 5)).toBe(2);
    expect(activeTocIndex(entries, 9)).toBe(3);
  });

  it("尚未到达任何条目 / 无可解析条目时返回 -1", () => {
    expect(activeTocIndex(entries, 0)).toBe(-1);
    expect(
      activeTocIndex([{ id: 0, title: "x", page: null, depth: 0 }], 3),
    ).toBe(-1);
  });
});
