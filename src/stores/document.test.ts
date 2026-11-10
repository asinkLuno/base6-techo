import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DOTS,
  DEFAULT_IMPOSITION,
  DEFAULT_LINEAR,
  DEFAULT_PAGE,
  toSectionSpecs,
} from "../types/document";
import { useDocumentStore } from "./document";

// persist 中间件在 store 创建时就读 localStorage，vitest node 环境没有，先挂内存实现。
vi.hoisted(() => {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key),
    },
  });
});

const state = () => useDocumentStore.getState();

describe("document store", () => {
  beforeEach(() => useDocumentStore.setState({ sections: [] }));

  it("addSection 追加默认节：linear 默认参数、1 页、计入页码、id 唯一", () => {
    state().addSection();
    state().addSection();
    const { sections } = state();
    expect(sections).toHaveLength(2);
    expect(new Set(sections.map((s) => s.id)).size).toBe(2);
    expect(sections[0]).toMatchObject({
      pages: 1,
      numbered: true,
      body: DEFAULT_LINEAR,
    });
  });

  it("removeSection 只删指定 id", () => {
    state().addSection();
    state().addSection();
    const [a, b] = state().sections;
    state().removeSection(a.id);
    expect(state().sections.map((s) => s.id)).toEqual([b.id]);
  });

  it("moveSection 按 arrayMove 语义重排", () => {
    state().addSection();
    state().addSection();
    state().addSection();
    const [a, b, c] = state().sections;
    state().moveSection(a.id, c.id);
    expect(state().sections.map((s) => s.id)).toEqual([b.id, c.id, a.id]);
  });

  it("moveSection 传未知 id 或原地拖动时保持不变", () => {
    state().addSection();
    state().addSection();
    const before = state().sections;
    state().moveSection("nope", before[1].id);
    state().moveSection(before[0].id, before[0].id);
    expect(state().sections).toEqual(before);
  });

  it("updateSection 把页数 clamp 到 1–999 的整数", () => {
    state().addSection();
    const id = state().sections[0].id;
    state().updateSection(id, { pages: 0 });
    expect(state().sections[0].pages).toBe(1);
    state().updateSection(id, { pages: 1000 });
    expect(state().sections[0].pages).toBe(999);
    state().updateSection(id, { pages: 48 });
    expect(state().sections[0].pages).toBe(48);
  });

  it("updateSection clamp linear 参数到边界，非法颜色回落默认值", () => {
    state().addSection();
    const id = state().sections[0].id;
    state().updateSection(id, {
      body: { kind: "linear", spacingMm: 0, color: "red", lineWidthPt: 100 },
    });
    expect(state().sections[0].body).toEqual({
      kind: "linear",
      spacingMm: 0.1,
      color: "#9E9E9E",
      lineWidthPt: 10,
    });
    state().updateSection(id, {
      body: {
        kind: "linear",
        spacingMm: 5,
        color: "#112233",
        lineWidthPt: 0.8,
      },
    });
    expect(state().sections[0].body).toEqual({
      kind: "linear",
      spacingMm: 5,
      color: "#112233",
      lineWidthPt: 0.8,
    });
  });

  it("updateSection clamp dots 参数到边界，非法颜色回落默认值", () => {
    state().addSection();
    const id = state().sections[0].id;
    state().updateSection(id, {
      body: {
        kind: "dots",
        spacingMm: 0,
        columnSpacingMm: 5000,
        radiusMm: 100,
        color: "red",
        centerColor: "#xyz",
      },
    });
    expect(state().sections[0].body).toEqual({
      kind: "dots",
      spacingMm: 0.1,
      columnSpacingMm: 1000,
      radiusMm: 10,
      color: DEFAULT_DOTS.color,
      centerColor: DEFAULT_DOTS.centerColor,
    });
    state().updateSection(id, {
      body: {
        kind: "dots",
        spacingMm: 4,
        columnSpacingMm: 6,
        radiusMm: 0.4,
        color: "#112233",
        centerColor: "#445566",
      },
    });
    expect(state().sections[0].body).toEqual({
      kind: "dots",
      spacingMm: 4,
      columnSpacingMm: 6,
      radiusMm: 0.4,
      color: "#112233",
      centerColor: "#445566",
    });
  });

  it("updateSection 在 blank、linear 与 dots 间切换 body", () => {
    state().addSection();
    const id = state().sections[0].id;
    state().updateSection(id, { body: { kind: "blank" } });
    expect(state().sections[0].body).toEqual({ kind: "blank" });
    state().updateSection(id, { body: DEFAULT_LINEAR });
    expect(state().sections[0].body).toEqual(DEFAULT_LINEAR);
    state().updateSection(id, { body: DEFAULT_DOTS });
    expect(state().sections[0].body).toEqual(DEFAULT_DOTS);
  });

  it("updateSection 对未知 id 是 no-op，不会崩溃", () => {
    state().addSection();
    const before = state().sections;
    state().updateSection("nope", { pages: 10 });
    expect(state().sections).toEqual(before);
  });

  it("numbered 布尔开关可切换", () => {
    state().addSection();
    const id = state().sections[0].id;
    state().updateSection(id, { numbered: false });
    expect(state().sections[0].numbered).toBe(false);
  });
});

describe("toSectionSpecs", () => {
  it("剥离前端 id，得到与 Rust Document.sections 对齐的负载", () => {
    const drafts = [
      { id: "x", pages: 2, numbered: true, body: DEFAULT_LINEAR },
      { id: "y", pages: 1, numbered: false, body: { kind: "blank" as const } },
    ];
    expect(toSectionSpecs(drafts)).toEqual([
      { pages: 2, numbered: true, body: DEFAULT_LINEAR },
      { pages: 1, numbered: false, body: { kind: "blank" } },
    ]);
  });
});

describe("page settings", () => {
  beforeEach(() => useDocumentStore.setState({ sections: [] }));

  it("初始页面设置为 Rust 默认：A5、左装订、16/16/18/18", () => {
    expect(state().page).toEqual(DEFAULT_PAGE);
  });

  it("updatePage 可切换装订与预设纸张", () => {
    state().updatePage({ binding: "right", paper: { kind: "b6" } });
    expect(state().page.binding).toBe("right");
    expect(state().page.paper).toEqual({ kind: "b6" });
  });

  it("updatePage 把自定义纸张 clamp 到 30–1000mm，非法值回落 A5 尺寸", () => {
    state().updatePage({
      paper: { kind: "custom", widthMm: 5, heightMm: 5000 },
    });
    expect(state().page.paper).toEqual({
      kind: "custom",
      widthMm: 30,
      heightMm: 1000,
    });
    state().updatePage({
      paper: { kind: "custom", widthMm: Number.NaN, heightMm: 200 },
    });
    expect(state().page.paper).toEqual({
      kind: "custom",
      widthMm: 148,
      heightMm: 200,
    });
  });

  it("updatePage 把边距 clamp 到 0–1000mm", () => {
    state().updatePage({
      margins: { headerMm: -3, footerMm: 12, innerMm: 14, outerMm: 16 },
    });
    expect(state().page.margins).toEqual({
      headerMm: 0,
      footerMm: 12,
      innerMm: 14,
      outerMm: 16,
    });
  });

  it("updatePage 不认识的节不受影响，可整体换纸", () => {
    state().addSection();
    const before = state().sections;
    state().updatePage({ paper: { kind: "letter" } });
    expect(state().sections).toEqual(before);
    expect(state().page.paper).toEqual({ kind: "letter" });
  });
});

describe("imposition", () => {
  beforeEach(() => useDocumentStore.setState({ sections: [] }));

  it("初始为单页输出（Rust Imposition::None）", () => {
    expect(state().imposition).toEqual(DEFAULT_IMPOSITION);
  });

  it("可切换骑马订与锁线", () => {
    state().updateImposition({ mode: "booklet" });
    expect(state().imposition).toEqual({ mode: "booklet" });
    state().updateImposition({ mode: "thread", sheetsPerSignature: 2 });
    expect(state().imposition).toEqual({
      mode: "thread",
      sheetsPerSignature: 2,
    });
  });

  it("锁线每帖纸张数 clamp 到 1–250，非法值回落默认 4", () => {
    state().updateImposition({ mode: "thread", sheetsPerSignature: 0 });
    expect(state().imposition).toEqual({
      mode: "thread",
      sheetsPerSignature: 1,
    });
    state().updateImposition({ mode: "thread", sheetsPerSignature: 999 });
    expect(state().imposition).toEqual({
      mode: "thread",
      sheetsPerSignature: 250,
    });
    state().updateImposition({
      mode: "thread",
      sheetsPerSignature: Number.NaN,
    });
    expect(state().imposition).toEqual({
      mode: "thread",
      sheetsPerSignature: 4,
    });
  });

  it("切换到非锁线模式时不携带纸张数字段", () => {
    state().updateImposition({ mode: "thread", sheetsPerSignature: 8 });
    state().updateImposition({ mode: "booklet" });
    expect(state().imposition).toEqual({ mode: "booklet" });
  });
});
