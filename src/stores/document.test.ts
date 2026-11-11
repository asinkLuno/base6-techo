import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DOTS,
  DEFAULT_GRID,
  DEFAULT_HOGEN,
  DEFAULT_IMPOSITION,
  DEFAULT_LINEAR,
  DEFAULT_OCTAN_WEEK,
  DEFAULT_PAGE,
  newDecorations,
  SECTION_NAME_MAX,
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
      name: "",
      pages: 1,
      numbered: true,
      body: DEFAULT_LINEAR,
      margins: null,
      decorations: null,
    });
  });

  it("updateSection 可重命名 section：去首尾空白、超长截断，空名回到未命名", () => {
    state().addSection();
    const id = state().sections[0].id;
    state().updateSection(id, { name: "  第一章  " });
    expect(state().sections[0].name).toBe("第一章");
    state().updateSection(id, { name: "长".repeat(100) });
    expect(state().sections[0].name).toHaveLength(SECTION_NAME_MAX);
    state().updateSection(id, { name: "   " });
    expect(state().sections[0].name).toBe("");
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
      body: {
        kind: "linear",
        spacingMm: 0,
        color: "red",
        lineWidthPt: 100,
        marginLine: null,
      },
    });
    expect(state().sections[0].body).toEqual({
      kind: "linear",
      spacingMm: 0.1,
      color: "#9E9E9E",
      lineWidthPt: 10,
      marginLine: null,
    });
    state().updateSection(id, {
      body: {
        kind: "linear",
        spacingMm: 5,
        color: "#112233",
        lineWidthPt: 0.8,
        marginLine: null,
      },
    });
    expect(state().sections[0].body).toEqual({
      kind: "linear",
      spacingMm: 5,
      color: "#112233",
      lineWidthPt: 0.8,
      marginLine: null,
    });
  });

  it("updateSection clamp 左侧竖线参数，非法颜色回落默认值", () => {
    state().addSection();
    const id = state().sections[0].id;
    state().updateSection(id, {
      body: {
        ...DEFAULT_LINEAR,
        marginLine: { xMm: 5000, color: "red", widthPt: 100 },
      },
    });
    expect(state().sections[0].body).toEqual({
      ...DEFAULT_LINEAR,
      marginLine: { xMm: 1000, color: "#D96A6A", widthPt: 10 },
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

  it("updateSection clamp grid 参数到边界，非法颜色回落默认值", () => {
    state().addSection();
    const id = state().sections[0].id;
    state().updateSection(id, {
      body: {
        kind: "grid",
        spacingMm: 0,
        color: "blue",
        lineWidthPt: 100,
      },
    });
    expect(state().sections[0].body).toEqual({
      kind: "grid",
      spacingMm: 0.1,
      color: DEFAULT_GRID.color,
      lineWidthPt: 10,
    });
    state().updateSection(id, {
      body: {
        kind: "grid",
        spacingMm: 4,
        color: "#112233",
        lineWidthPt: 0.6,
      },
    });
    expect(state().sections[0].body).toEqual({
      kind: "grid",
      spacingMm: 4,
      color: "#112233",
      lineWidthPt: 0.6,
    });
  });

  it("updateSection clamp hogen 颜色，非法颜色回落默认值", () => {
    state().addSection();
    const id = state().sections[0].id;
    state().updateSection(id, { body: { kind: "hogen", color: "blue" } });
    expect(state().sections[0].body).toEqual({
      kind: "hogen",
      color: DEFAULT_HOGEN.color,
    });
    state().updateSection(id, { body: { kind: "hogen", color: "#112233" } });
    expect(state().sections[0].body).toEqual({
      kind: "hogen",
      color: "#112233",
    });
  });

  it("updateSection 在 blank、linear、dots、grid 与 hogen 间切换 body", () => {
    state().addSection();
    const id = state().sections[0].id;
    state().updateSection(id, { body: { kind: "blank" } });
    expect(state().sections[0].body).toEqual({ kind: "blank" });
    state().updateSection(id, { body: DEFAULT_LINEAR });
    expect(state().sections[0].body).toEqual(DEFAULT_LINEAR);
    state().updateSection(id, { body: DEFAULT_DOTS });
    expect(state().sections[0].body).toEqual(DEFAULT_DOTS);
    state().updateSection(id, { body: DEFAULT_GRID });
    expect(state().sections[0].body).toEqual(DEFAULT_GRID);
    state().updateSection(id, { body: DEFAULT_HOGEN });
    expect(state().sections[0].body).toEqual(DEFAULT_HOGEN);
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

  it("updateSection 覆盖装饰时 clamp 字号与颜色，null 恢复继承", () => {
    state().addSection();
    const id = state().sections[0].id;
    const custom = newDecorations();
    custom.header.content = { kind: "text", text: "本节" };
    custom.header.style = { sizePt: 100, color: "red" };
    custom.footer.pageNumber = true;
    state().updateSection(id, {
      decorations: { header: custom.header, footer: custom.footer },
    });
    // 只保留与全书不同的页头/页脚；未改的水印不落覆盖，仍实时跟随全书。
    expect(state().sections[0].decorations?.header).toEqual({
      content: { kind: "text", text: "本节" },
      pageNumber: false,
      align: "center",
      style: { sizePt: 72, color: "#000000" },
    });
    expect(state().sections[0].decorations?.footer?.pageNumber).toBe(true);
    expect(state().sections[0].decorations?.innerWatermark).toBeUndefined();
    state().updateSection(id, { decorations: null });
    expect(state().sections[0].decorations).toBeNull();
  });

  it("全局装饰变化会实时同步到 section 中未覆盖的项", () => {
    useDocumentStore.setState({
      sections: [],
      page: DEFAULT_PAGE,
      decorations: newDecorations(),
    });
    state().addSection();
    const id = state().sections[0].id;
    state().updateSection(id, { decorations: {} });

    const next = newDecorations();
    next.header.content = { kind: "text", text: "新全书页头" };
    next.footer.pageNumber = true;
    state().updateDecorations(next);
    // 自定义模式下没改过的页头仍不落覆盖。
    expect(state().sections[0].decorations).toEqual({});

    // 只覆盖页脚页码；页头继续跟随全书。
    state().updateSection(id, {
      decorations: {
        footer: { ...state().decorations.footer, pageNumber: false },
      },
    });
    expect(state().sections[0].decorations).toEqual({
      footer: { ...next.footer, pageNumber: false },
    });

    const newer = {
      ...state().decorations,
      header: {
        ...state().decorations.header,
        content: { kind: "text" as const, text: "更新后的页头" },
      },
    };
    state().updateDecorations(newer);
    const [spec] = toSectionSpecs(
      state().sections,
      state().page,
      state().decorations,
    );
    expect(spec.decorations?.header.content).toEqual({
      kind: "text",
      text: "更新后的页头",
    });
    expect(spec.decorations?.footer.pageNumber).toBe(false);
  });

  it("全局边距变化会实时同步到 section 中未覆盖的字段", () => {
    useDocumentStore.setState({
      sections: [],
      page: DEFAULT_PAGE,
      decorations: newDecorations(),
    });
    state().addSection();
    const id = state().sections[0].id;
    state().updateSection(id, { margins: { headerMm: 30 } });
    state().updatePage({
      margins: { ...DEFAULT_PAGE.margins, footerMm: 24 },
    });
    const [spec] = toSectionSpecs(
      state().sections,
      state().page,
      state().decorations,
    );
    expect(spec.margins).toEqual({
      headerMm: 30,
      footerMm: 24,
      innerMm: 18,
      outerMm: 18,
    });
  });
});

describe("decorations", () => {
  beforeEach(() =>
    useDocumentStore.setState({
      sections: [],
      decorations: newDecorations(),
    }),
  );

  it("初始全书装饰与 Rust 默认一致", () => {
    expect(state().decorations).toEqual(newDecorations());
  });

  it("updateDecorations clamp 字号、颜色与水印", () => {
    const next = newDecorations();
    next.header.content = { kind: "text", text: "手帐" };
    next.header.style = { sizePt: 0, color: "#GGGGGG" };
    next.innerWatermark = {
      text: "BASE6",
      style: { sizePt: 200, color: "blue" },
    };
    state().updateDecorations(next);
    expect(state().decorations.header).toEqual({
      content: { kind: "text", text: "手帐" },
      pageNumber: false,
      align: "center",
      style: { sizePt: 1, color: "#000000" },
    });
    expect(state().decorations.innerWatermark).toEqual({
      text: "BASE6",
      style: { sizePt: 72, color: "#000000" },
    });
    expect(state().decorations.outerWatermark).toBeNull();
  });
});

describe("toSectionSpecs", () => {
  it("剥离前端 id，得到与 Rust Document.sections 对齐的负载", () => {
    const drafts = [
      {
        id: "x",
        name: "第一章",
        pages: 2,
        numbered: true,
        body: DEFAULT_LINEAR,
        margins: null,
        decorations: null,
      },
      {
        id: "y",
        name: "",
        pages: 1,
        numbered: false,
        body: { kind: "blank" as const },
        margins: null,
        decorations: null,
      },
    ];
    expect(toSectionSpecs(drafts, DEFAULT_PAGE, newDecorations())).toEqual([
      {
        pages: 2,
        numbered: true,
        body: DEFAULT_LINEAR,
        margins: null,
        decorations: null,
      },
      {
        pages: 1,
        numbered: false,
        body: { kind: "blank" },
        margins: null,
        decorations: null,
      },
    ]);
  });

  it("只覆盖某几项时，其余项在生成前实时取全书当前值", () => {
    const decorations = newDecorations();
    decorations.header.content = { kind: "text", text: "全书页头" };
    decorations.outerWatermark = {
      text: "全书水印",
      style: { sizePt: 8, color: "#123456" },
    };
    const drafts = [
      {
        id: "x",
        name: "",
        pages: 1,
        numbered: true,
        body: { kind: "blank" as const },
        margins: { headerMm: 30 },
        decorations: {
          footer: {
            content: { kind: "empty" as const },
            pageNumber: true,
            align: "outer" as const,
            style: { sizePt: 9, color: "#000000" },
          },
        },
      },
    ];
    const [spec] = toSectionSpecs(drafts, DEFAULT_PAGE, decorations);
    expect(spec.margins).toEqual({
      ...DEFAULT_PAGE.margins,
      headerMm: 30,
    });
    expect(spec.decorations?.header).toEqual(decorations.header);
    expect(spec.decorations?.footer.pageNumber).toBe(true);
    expect(spec.decorations?.outerWatermark).toEqual(
      decorations.outerWatermark,
    );
  });
});

describe("page settings", () => {
  beforeEach(() =>
    useDocumentStore.setState({ sections: [], page: DEFAULT_PAGE }),
  );

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

  it("换小纸时压缩边距，保证页心至少 1mm", () => {
    state().updatePage({
      paper: { kind: "a6" },
      margins: { headerMm: 100, footerMm: 100, innerMm: 60, outerMm: 60 },
    });
    // A6 105×148：纵向保留 100 后页脚压到 47；横向保留 60 后外侧压到 44。
    expect(state().page.margins).toEqual({
      headerMm: 100,
      footerMm: 47,
      innerMm: 60,
      outerMm: 44,
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

describe("replaceDocument", () => {
  it("导入配置时整体替换 section、页面设置、装饰与装订方式", () => {
    state().addSection();
    state().updateImposition({ mode: "booklet" });

    const decorations = newDecorations();
    decorations.header.content = { kind: "text", text: "导入的页头" };
    const snapshot = {
      sections: [
        {
          id: "imported",
          name: "导入的节",
          pages: 4,
          numbered: false,
          body: { kind: "blank" as const },
          margins: null,
          decorations: null,
        },
      ],
      page: { ...DEFAULT_PAGE, paper: { kind: "a4" as const } },
      decorations,
      imposition: { mode: "thread" as const, sheetsPerSignature: 2 },
    };

    state().replaceDocument(snapshot);

    expect(state().sections).toEqual(snapshot.sections);
    expect(state().page).toEqual(snapshot.page);
    expect(state().decorations).toEqual(snapshot.decorations);
    expect(state().imposition).toEqual(snapshot.imposition);
  });
});

describe("octan week pages", () => {
  const octanBody = (startDate: string, endDate: string) => ({
    ...DEFAULT_OCTAN_WEEK,
    startDate,
    endDate,
  });

  it("切换模板或改日期时页数自动跟随周数", () => {
    state().addSection();
    const id = state().sections[0].id;
    state().updateSection(id, {
      body: octanBody("2026-08-03", "2026-08-09"),
    });
    expect(state().sections[0].pages).toBe(2);
    state().updateSection(id, {
      body: octanBody("2026-08-03", "2026-08-16"),
    });
    expect(state().sections[0].pages).toBe(4);
  });

  it("八分周视图的页数不能被手工改走", () => {
    state().addSection();
    const id = state().sections[0].id;
    state().updateSection(id, {
      body: octanBody("2026-08-03", "2026-08-09"),
    });
    state().updateSection(id, { pages: 99 });
    expect(state().sections[0].pages).toBe(2);
  });

  it("切回其他模板后保留当前页数", () => {
    state().addSection();
    const id = state().sections[0].id;
    state().updateSection(id, {
      body: octanBody("2026-08-03", "2026-08-16"),
    });
    state().updateSection(id, { body: { ...DEFAULT_LINEAR } });
    expect(state().sections[0].pages).toBe(4);
  });
});
