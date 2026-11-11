import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOTS,
  DEFAULT_LINEAR,
  DEFAULT_MONTH,
  DEFAULT_OCTAN_WEEK,
  DEFAULT_PAGE,
  DEFAULT_TRACKER,
  newDecorations,
  SECTION_NAME_MAX,
  type SectionDraft,
} from "../types/document";
import {
  applySectionPatch,
  mergeDocumentState,
  migrateDocumentState,
} from "./documentState";

const section = (overrides: Partial<SectionDraft> = {}): SectionDraft => ({
  id: "s1",
  name: "",
  pages: 1,
  numbered: true,
  body: { kind: "blank" },
  margins: null,
  decorations: null,
  ...overrides,
});

const globalDecorations = () => {
  const decorations = newDecorations();
  decorations.innerWatermark = {
    text: "全书水印",
    style: { sizePt: 10, color: "#000000" },
  };
  return decorations;
};

describe("applySectionPatch", () => {
  it("只写 patch 指定字段，id 与其他字段保持不变", () => {
    const before = section({ pages: 3, margins: { outerMm: 20 } });
    const after = applySectionPatch(
      before,
      { pages: 7 },
      DEFAULT_PAGE,
      newDecorations(),
    );
    expect(after).toEqual({ ...before, pages: 7 });
  });

  it("名称写入前去掉首尾空白，超长部分截断", () => {
    const page = DEFAULT_PAGE;
    expect(
      applySectionPatch(
        section(),
        { name: "  第三章  " },
        page,
        newDecorations(),
      ).name,
    ).toBe("第三章");
    expect(
      applySectionPatch(
        section(),
        { name: "x".repeat(SECTION_NAME_MAX + 10) },
        page,
        newDecorations(),
      ).name,
    ).toHaveLength(SECTION_NAME_MAX);
  });

  it("页数与模板参数在写入前 clamp", () => {
    const page = DEFAULT_PAGE;
    expect(
      applySectionPatch(section(), { pages: 0 }, page, newDecorations()).pages,
    ).toBe(1);
    expect(
      applySectionPatch(section(), { pages: 5000 }, page, newDecorations())
        .pages,
    ).toBe(999);

    const body = applySectionPatch(
      section(),
      {
        body: {
          kind: "linear",
          spacingMm: 0,
          lineWidthPt: 999,
          color: "red",
          marginLine: null,
        },
      },
      page,
      newDecorations(),
    ).body;
    expect(body).toEqual({
      ...DEFAULT_LINEAR,
      spacingMm: 0.1,
      lineWidthPt: 10,
    });
  });

  it("margins：null 清除覆盖，与全书相同收敛为 {} 哨兵，0 是合法值", () => {
    const page = DEFAULT_PAGE;
    const decorations = newDecorations();
    expect(
      applySectionPatch(section(), { margins: null }, page, decorations)
        .margins,
    ).toBeNull();
    expect(
      applySectionPatch(
        section(),
        { margins: { ...page.margins } },
        page,
        decorations,
      ).margins,
    ).toEqual({});
    expect(
      applySectionPatch(
        section(),
        { margins: { outerMm: 30 } },
        page,
        decorations,
      ).margins,
    ).toEqual({ outerMm: 30 });
    expect(
      applySectionPatch(
        section(),
        { margins: { outerMm: 0 } },
        page,
        decorations,
      ).margins,
    ).toEqual({ outerMm: 0 });
  });

  it("margins 超出纸张可用空间时按 1mm 页心规则压缩", () => {
    const after = applySectionPatch(
      section(),
      { margins: { innerMm: 200, outerMm: 200 } },
      DEFAULT_PAGE,
      newDecorations(),
    );
    expect(after.margins).toEqual({ innerMm: 147, outerMm: 0 });
  });

  it("decorations：null 清除；自定义/关闭水印保留为最小覆盖", () => {
    const decorations = globalDecorations();
    expect(
      applySectionPatch(
        section(),
        { decorations: null },
        DEFAULT_PAGE,
        decorations,
      ).decorations,
    ).toBeNull();
    expect(
      applySectionPatch(
        section(),
        { decorations: { innerWatermark: { kind: "off" } } },
        DEFAULT_PAGE,
        decorations,
      ).decorations,
    ).toEqual({ innerWatermark: { kind: "off" } });

    expect(
      applySectionPatch(
        section(),
        {
          decorations: {
            innerWatermark: {
              kind: "custom",
              text: "本节水印",
              style: { sizePt: 12, color: "#112233" },
            },
          },
        },
        DEFAULT_PAGE,
        decorations,
      ).decorations,
    ).toEqual({
      innerWatermark: {
        kind: "custom",
        text: "本节水印",
        style: { sizePt: 12, color: "#112233" },
      },
    });
  });

  it("decorations 与全书一致时收敛为 {} 哨兵而不是 null", () => {
    const decorations = globalDecorations();
    expect(
      applySectionPatch(
        section(),
        { decorations: {} },
        DEFAULT_PAGE,
        decorations,
      ).decorations,
    ).toEqual({});
  });
});

describe("migrateDocumentState", () => {
  it("空值与垃圾数据回落默认快照", () => {
    const expected = {
      sections: [],
      page: DEFAULT_PAGE,
      decorations: newDecorations(),
      imposition: { mode: "none" },
    };
    expect(migrateDocumentState(null)).toEqual(expected);
    expect(
      migrateDocumentState({
        sections: "nope",
        page: 3,
        decorations: [],
        imposition: "thread",
      }),
    ).toEqual(expected);
  });

  it("旧版整块 decorations / margins 迁移成逐项覆盖", () => {
    const global = globalDecorations();
    const persisted = {
      page: DEFAULT_PAGE,
      decorations: global,
      sections: [
        {
          id: "a",
          pages: 5,
          numbered: false,
          body: DEFAULT_LINEAR,
          margins: { ...DEFAULT_PAGE.margins, outerMm: 25 },
          decorations: {
            ...newDecorations(),
            header: {
              content: { kind: "text", text: "章节" },
              pageNumber: true,
              align: "outer",
              style: { sizePt: 12, color: "#112233" },
            },
            innerWatermark: null,
            outerWatermark: {
              text: "外侧",
              style: { sizePt: 9, color: "#000000" },
            },
          },
        },
      ],
    };

    const snapshot = migrateDocumentState(persisted);
    expect(snapshot.sections[0]).toEqual({
      id: "a",
      name: "",
      pages: 5,
      numbered: false,
      body: DEFAULT_LINEAR,
      margins: { outerMm: 25 },
      decorations: {
        header: {
          content: { kind: "text", text: "章节" },
          pageNumber: true,
          align: "outer",
          style: { sizePt: 12, color: "#112233" },
        },
        innerWatermark: { kind: "off" },
        outerWatermark: {
          kind: "custom",
          text: "外侧",
          style: { sizePt: 9, color: "#000000" },
        },
      },
    });
  });

  it("新版逐项覆盖原样保留，重复迁移结果不变", () => {
    const global = globalDecorations();
    const persisted = {
      page: DEFAULT_PAGE,
      decorations: global,
      imposition: { mode: "thread", sheetsPerSignature: 3 },
      sections: [
        {
          id: "s",
          pages: 2,
          numbered: true,
          body: DEFAULT_DOTS,
          margins: { outerMm: 20 },
          decorations: { innerWatermark: { kind: "off" } },
        },
      ],
    };

    const once = migrateDocumentState(persisted);
    expect(once.sections[0].margins).toEqual({ outerMm: 20 });
    expect(once.sections[0].decorations).toEqual({
      innerWatermark: { kind: "off" },
    });
    expect(once.imposition).toEqual({
      mode: "thread",
      sheetsPerSignature: 3,
    });
    expect(migrateDocumentState(once)).toEqual(once);
  });

  it("越界页数、非法模板参数与未知纸张逐项收敛", () => {
    const snapshot = migrateDocumentState({
      page: {
        paper: { kind: "b0" },
        binding: "sideways",
        margins: { headerMm: Number.NaN, outerMm: 30 },
      },
      sections: [
        {
          id: "a",
          pages: 0,
          numbered: "yes",
          body: {
            kind: "linear",
            spacingMm: -5,
            lineWidthPt: 100,
            color: "red",
            marginLine: { xMm: -1, color: "#XYZXYZ", widthPt: 0 },
          },
        },
        {
          id: "b",
          pages: 5000,
          numbered: false,
          body: { kind: "dots", spacingMm: -5, columnSpacingMm: 0 },
        },
      ],
    });

    expect(snapshot.page.paper).toEqual(DEFAULT_PAGE.paper);
    // 装订固定为左侧，旧数据里的 binding 字段在迁移时丢弃。
    expect(snapshot.page).not.toHaveProperty("binding");
    expect(snapshot.page.margins).toEqual({
      ...DEFAULT_PAGE.margins,
      outerMm: 30,
    });
    expect(snapshot.sections[0].pages).toBe(1);
    expect(snapshot.sections[0].numbered).toBe(true);
    expect(snapshot.sections[0].body).toEqual({
      ...DEFAULT_LINEAR,
      spacingMm: 0.1,
      lineWidthPt: 10,
      marginLine: { xMm: 0, color: "#D96A6A", widthPt: 0.01 },
    });
    expect(snapshot.sections[1].pages).toBe(999);
    expect(snapshot.sections[1].body).toEqual({
      ...DEFAULT_DOTS,
      spacingMm: 0.1,
      columnSpacingMm: 0.1,
    });
  });

  it("自定义纸张宽高越界时 clamp 到允许范围", () => {
    const snapshot = migrateDocumentState({
      page: {
        paper: { kind: "custom", widthMm: 1, heightMm: 5000 },
        binding: "right",
        margins: DEFAULT_PAGE.margins,
      },
    });
    expect(snapshot.page.paper).toEqual({
      kind: "custom",
      widthMm: 30,
      heightMm: 1000,
    });
  });

  it("缺失/重复 id 用注入的工厂补齐且互不冲突", () => {
    let n = 0;
    const snapshot = migrateDocumentState(
      {
        sections: [
          { pages: 1 },
          { id: "dup", pages: 1 },
          { id: "dup", pages: 1 },
        ],
      },
      () => `generated-${++n}`,
    );
    expect(snapshot.sections.map((item) => item.id)).toEqual([
      "generated-1",
      "dup",
      "generated-2",
    ]);
  });

  it("缺失 body/pages/numbered 时用新增 section 的默认值", () => {
    const [migrated] = migrateDocumentState({
      sections: [{ id: "a" }],
    }).sections;
    expect(migrated).toMatchObject({
      name: "",
      pages: 1,
      numbered: true,
      body: DEFAULT_LINEAR,
      margins: null,
      decorations: null,
    });
  });

  it("自定义名称随持久化保留并按边界清洗，非字符串回落未命名", () => {
    const snapshot = migrateDocumentState({
      sections: [
        { id: "a", name: "  日记  " },
        { id: "b", name: 42 },
        { id: "c" },
        { id: "d", name: "x".repeat(SECTION_NAME_MAX + 10) },
      ],
    });
    expect(snapshot.sections.map((s) => s.name)).toEqual([
      "日记",
      "",
      "",
      "x".repeat(SECTION_NAME_MAX),
    ]);
  });

  it("空覆盖 {} 哨兵在迁移后保留，未改动的旧整块才回到继承", () => {
    const snapshot = migrateDocumentState({
      sections: [
        {
          id: "a",
          pages: 1,
          body: DEFAULT_LINEAR,
          margins: {},
          decorations: {},
        },
        {
          id: "b",
          pages: 1,
          body: DEFAULT_LINEAR,
          margins: { ...DEFAULT_PAGE.margins },
          decorations: { ...newDecorations() },
        },
      ],
    });
    expect(snapshot.sections[0].margins).toEqual({});
    expect(snapshot.sections[0].decorations).toEqual({});
    expect(snapshot.sections[1].margins).toBeNull();
    expect(snapshot.sections[1].decorations).toBeNull();
    // 再次迁移不应把哨兵折叠成 null
    expect(migrateDocumentState(snapshot).sections[0]).toEqual(
      snapshot.sections[0],
    );
  });

  it("有效预设纸张与非默认装订方式原样保留", () => {
    const snapshot = migrateDocumentState({
      page: { paper: { kind: "letter" } },
      imposition: { mode: "booklet" },
    });
    expect(snapshot.page.paper).toEqual({ kind: "letter" });
    expect(snapshot.imposition).toEqual({ mode: "booklet" });
    expect(
      migrateDocumentState({ imposition: { mode: "staple" } }).imposition,
    ).toEqual({ mode: "none" });
  });

  it("水印缺少样式时补默认字号与颜色", () => {
    const snapshot = migrateDocumentState({
      decorations: {
        outerWatermark: { text: "仅有文字" },
      },
    });
    expect(snapshot.decorations.outerWatermark).toEqual({
      text: "仅有文字",
      style: { sizePt: 10, color: "#000000" },
    });
  });
});

describe("mergeDocumentState", () => {
  it("保留当前 state 的 action，只覆盖数据字段", () => {
    const current = {
      sections: [] as SectionDraft[],
      page: DEFAULT_PAGE,
      decorations: newDecorations(),
      imposition: { mode: "none" } as const,
      addSection: () => {},
    };
    const merged = mergeDocumentState(
      { sections: [{ id: "a", pages: 0, body: DEFAULT_LINEAR }] },
      current,
    );
    expect(merged.sections[0].pages).toBe(1);
    expect(merged.addSection).toBe(current.addSection);
  });
});

describe("octan week migration", () => {
  it("导入时按整周修正日期，并按周数重算页数", () => {
    const snapshot = migrateDocumentState({
      sections: [
        {
          pages: 1,
          body: {
            kind: "octanWeek",
            startDate: "2026-08-06",
            endDate: "2026-08-16",
            dateFormat: "%Q",
            lineWidthPt: 0,
          },
        },
      ],
    });
    const body = snapshot.sections[0].body;
    expect(body.kind).toBe("octanWeek");
    if (body.kind !== "octanWeek") return;
    expect(body.startDate).toBe("2026-08-03");
    expect(body.endDate).toBe("2026-08-16");
    expect(body.dateFormat).toBe(DEFAULT_OCTAN_WEEK.dateFormat);
    expect(body.lineWidthPt).toBe(0.01);
    expect(snapshot.sections[0].pages).toBe(4);
  });

  it("日期非法时回落到默认整周", () => {
    const snapshot = migrateDocumentState({
      sections: [
        {
          pages: 2,
          body: { kind: "octanWeek", startDate: "nope", endDate: "" },
        },
      ],
    });
    const body = snapshot.sections[0].body;
    if (body.kind !== "octanWeek") throw new Error("expected octanWeek");
    expect(body.startDate).toBe(DEFAULT_OCTAN_WEEK.startDate);
    expect(body.endDate).toBe(DEFAULT_OCTAN_WEEK.endDate);
    expect(snapshot.sections[0].pages).toBe(2);
  });
});

describe("month calendar migration", () => {
  it("导入时收敛非法月份与月数，并按月份数重算页数", () => {
    const snapshot = migrateDocumentState({
      sections: [
        {
          pages: 1,
          body: {
            kind: "month",
            startMonth: "2026-13",
            months: 0,
            titleFormat: "%Q",
            lineWidthPt: 0,
          },
        },
      ],
    });
    const body = snapshot.sections[0].body;
    if (body.kind !== "month") throw new Error("expected month");
    expect(body.startMonth).toBe(DEFAULT_MONTH.startMonth);
    expect(body.months).toBe(1);
    expect(body.titleFormat).toBe(DEFAULT_MONTH.titleFormat);
    expect(body.lineWidthPt).toBe(0.01);
    expect(snapshot.sections[0].pages).toBe(1);
  });

  it("合法月份保留并同步页数", () => {
    const snapshot = migrateDocumentState({
      sections: [
        {
          pages: 99,
          body: { kind: "month", startMonth: "2027-01", months: 6 },
        },
      ],
    });
    const body = snapshot.sections[0].body;
    if (body.kind !== "month") throw new Error("expected month");
    expect(body.startMonth).toBe("2027-01");
    expect(snapshot.sections[0].pages).toBe(6);
  });
});

describe("tracker migration", () => {
  it("导入时收敛非法月份、月数与打卡项数，并按月份数重算页数", () => {
    const snapshot = migrateDocumentState({
      sections: [
        {
          pages: 1,
          body: {
            kind: "tracker",
            startMonth: "2026-13",
            months: 0,
            items: 99,
            lineWidthPt: 0,
          },
        },
      ],
    });
    const body = snapshot.sections[0].body;
    if (body.kind !== "tracker") throw new Error("expected tracker");
    expect(body.startMonth).toBe(DEFAULT_TRACKER.startMonth);
    expect(body.months).toBe(1);
    expect(body.items).toBe(30);
    expect(body.lineWidthPt).toBe(0.01);
    expect(snapshot.sections[0].pages).toBe(1);
  });

  it("合法月份保留并同步页数", () => {
    const snapshot = migrateDocumentState({
      sections: [
        {
          pages: 99,
          body: { kind: "tracker", startMonth: "2027-01", months: 4 },
        },
      ],
    });
    const body = snapshot.sections[0].body;
    if (body.kind !== "tracker") throw new Error("expected tracker");
    expect(body.startMonth).toBe("2027-01");
    expect(snapshot.sections[0].pages).toBe(4);
  });
});
