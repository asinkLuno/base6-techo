import { describe, expect, it } from "vitest";
import {
  type Band,
  clampBand,
  DEFAULT_PAGE,
  diffSectionDecorations,
  diffSectionMargins,
  hasSectionOverrides,
  newDecorations,
  resolveSectionDecorations,
  resolveSectionMargins,
  type SectionDraft,
  toSectionSpecs,
} from "./document";

const band = (overrides: Partial<Band> = {}): Band => ({
  content: { kind: "empty" },
  pageNumber: false,
  align: "center",
  style: { sizePt: 10, color: "#000000" },
  ...overrides,
});

const draft = (overrides: Partial<SectionDraft> = {}): SectionDraft => ({
  id: "s1",
  name: "",
  pages: 1,
  numbered: true,
  body: { kind: "blank" },
  margins: null,
  decorations: null,
  ...overrides,
});

describe("resolveSectionMargins", () => {
  it("null 时完整继承全书边距", () => {
    expect(resolveSectionMargins(null, DEFAULT_PAGE.margins)).toEqual(
      DEFAULT_PAGE.margins,
    );
  });

  it("0 是合法覆盖值，不被全书值顶替", () => {
    expect(
      resolveSectionMargins({ headerMm: 0 }, DEFAULT_PAGE.margins),
    ).toEqual({ ...DEFAULT_PAGE.margins, headerMm: 0 });
  });

  it("四个方向同时为 0 时全部保留", () => {
    expect(
      resolveSectionMargins(
        { headerMm: 0, footerMm: 0, innerMm: 0, outerMm: 0 },
        DEFAULT_PAGE.margins,
      ),
    ).toEqual({ headerMm: 0, footerMm: 0, innerMm: 0, outerMm: 0 });
  });
});

describe("resolveSectionDecorations", () => {
  const global = newDecorations();
  global.header.content = { kind: "text", text: "全书页头" };
  global.innerWatermark = {
    text: "全书水印",
    style: { sizePt: 10, color: "#000000" },
  };

  it("null 或空对象时完整继承全书装饰", () => {
    expect(resolveSectionDecorations(null, global)).toEqual(global);
    expect(resolveSectionDecorations({}, global)).toEqual(global);
  });

  it("自定义水印覆盖全书水印", () => {
    expect(
      resolveSectionDecorations(
        {
          innerWatermark: {
            kind: "custom",
            text: "本节水印",
            style: { sizePt: 12, color: "#112233" },
          },
        },
        global,
      ).innerWatermark,
    ).toEqual({
      text: "本节水印",
      style: { sizePt: 12, color: "#112233" },
    });
  });

  it("off 表示本节关闭全书水印", () => {
    expect(
      resolveSectionDecorations({ innerWatermark: { kind: "off" } }, global)
        .innerWatermark,
    ).toBeNull();
  });

  it("外侧水印的覆盖独立于内侧", () => {
    const resolved = resolveSectionDecorations(
      {
        outerWatermark: {
          kind: "custom",
          text: "外侧水印",
          style: { sizePt: 8, color: "#445566" },
        },
      },
      global,
    );
    expect(resolved.outerWatermark).toEqual({
      text: "外侧水印",
      style: { sizePt: 8, color: "#445566" },
    });
    expect(resolved.innerWatermark).toEqual(global.innerWatermark);
  });
});

describe("diffSectionDecorations", () => {
  it("自定义水印与关闭水印都落为覆盖", () => {
    const global = newDecorations();
    global.innerWatermark = {
      text: "全书水印",
      style: { sizePt: 10, color: "#000000" },
    };

    expect(
      diffSectionDecorations(
        {
          ...global,
          innerWatermark: {
            text: "本节水印",
            style: { sizePt: 12, color: "#112233" },
          },
        },
        global,
      ),
    ).toEqual({
      innerWatermark: {
        kind: "custom",
        text: "本节水印",
        style: { sizePt: 12, color: "#112233" },
      },
    });

    expect(
      diffSectionDecorations({ ...global, innerWatermark: null }, global),
    ).toEqual({ innerWatermark: { kind: "off" } });
  });

  it("只有颜色不同也算页头覆盖", () => {
    const global = newDecorations();
    const own = {
      ...global,
      header: {
        ...global.header,
        style: { sizePt: 10, color: "#112233" },
      },
    };
    expect(diffSectionDecorations(own, global)).toEqual({ header: own.header });
  });

  it("内容类型不同也算页头覆盖", () => {
    const global = newDecorations();
    const own = {
      ...global,
      header: { ...global.header, content: { kind: "date" as const } },
    };
    expect(diffSectionDecorations(own, global)).toEqual({ header: own.header });
  });

  it("与全书完全一致时返回 null", () => {
    expect(
      diffSectionDecorations(newDecorations(), newDecorations()),
    ).toBeNull();
  });

  it("外侧水印也按自定义/关闭两种方式落为覆盖", () => {
    const global = newDecorations();
    global.outerWatermark = {
      text: "全书外侧",
      style: { sizePt: 10, color: "#000000" },
    };

    expect(
      diffSectionDecorations(
        {
          ...global,
          outerWatermark: {
            text: "本节外侧",
            style: { sizePt: 12, color: "#112233" },
          },
        },
        global,
      ),
    ).toEqual({
      outerWatermark: {
        kind: "custom",
        text: "本节外侧",
        style: { sizePt: 12, color: "#112233" },
      },
    });

    expect(
      diffSectionDecorations({ ...global, outerWatermark: null }, global),
    ).toEqual({ outerWatermark: { kind: "off" } });
  });

  it("同文同色水印视为一致，字号或颜色不同才算覆盖", () => {
    const global = newDecorations();
    global.innerWatermark = {
      text: "全书水印",
      style: { sizePt: 10, color: "#000000" },
    };

    expect(
      diffSectionDecorations(
        {
          ...global,
          innerWatermark: {
            text: "全书水印",
            style: { sizePt: 10, color: "#000000" },
          },
        },
        global,
      ),
    ).toBeNull();

    expect(
      diffSectionDecorations(
        {
          ...global,
          innerWatermark: {
            text: "全书水印",
            style: { sizePt: 12, color: "#000000" },
          },
        },
        global,
      ),
    ).toEqual({
      innerWatermark: {
        kind: "custom",
        text: "全书水印",
        style: { sizePt: 12, color: "#000000" },
      },
    });

    expect(
      diffSectionDecorations(
        {
          ...global,
          innerWatermark: {
            text: "全书水印",
            style: { sizePt: 10, color: "#112233" },
          },
        },
        global,
      ),
    ).toEqual({
      innerWatermark: {
        kind: "custom",
        text: "全书水印",
        style: { sizePt: 10, color: "#112233" },
      },
    });
  });

  it("页头文案相同时不算覆盖，文案不同才算", () => {
    const global = newDecorations();
    global.header.content = { kind: "text", text: "书名" };

    expect(
      diffSectionDecorations(
        {
          ...global,
          header: {
            ...global.header,
            content: { kind: "text", text: "书名" },
          },
        },
        global,
      ),
    ).toBeNull();

    const own = {
      ...global,
      header: {
        ...global.header,
        content: { kind: "text" as const, text: "章节名" },
      },
    };
    expect(diffSectionDecorations(own, global)).toEqual({ header: own.header });
  });
});

describe("clampBand", () => {
  it("text 内容保留，date 内容只留类型，其余收敛为空", () => {
    expect(
      clampBand(band({ content: { kind: "text", text: "页眉" } })).content,
    ).toEqual({ kind: "text", text: "页眉" });
    expect(clampBand(band({ content: { kind: "date" } })).content).toEqual({
      kind: "date",
    });
    expect(
      clampBand(
        band({ content: { kind: "bogus" } as unknown as Band["content"] }),
      ).content,
    ).toEqual({ kind: "empty" });
  });

  it("对齐只接受 inner/outer，其余回落到 center", () => {
    expect(clampBand(band({ align: "inner" })).align).toBe("inner");
    expect(clampBand(band({ align: "outer" })).align).toBe("outer");
    expect(
      clampBand(band({ align: "left" as unknown as Band["align"] })).align,
    ).toBe("center");
  });
});

describe("diffSectionMargins", () => {
  it("只保留与全书不同的字段", () => {
    expect(
      diffSectionMargins(
        { ...DEFAULT_PAGE.margins, outerMm: 30 },
        DEFAULT_PAGE.margins,
      ),
    ).toEqual({ outerMm: 30 });
  });
});

describe("hasSectionOverrides", () => {
  it("null 与空对象都不算覆盖", () => {
    expect(hasSectionOverrides(null)).toBe(false);
    expect(hasSectionOverrides({})).toBe(false);
    expect(hasSectionOverrides({ headerMm: 30 })).toBe(true);
  });
});

describe("toSectionSpecs", () => {
  it("空覆盖对象在生成时回落为继承，而不是输出空块", () => {
    const [spec] = toSectionSpecs(
      [draft({ margins: {}, decorations: {} })],
      DEFAULT_PAGE,
      newDecorations(),
    );
    expect(spec.margins).toBeNull();
    expect(spec.decorations).toBeNull();
  });
});
