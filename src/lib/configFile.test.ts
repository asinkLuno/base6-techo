import { describe, expect, it } from "vitest";
import type { DocumentSnapshot } from "../stores/documentState";
import {
  DEFAULT_DOTS,
  DEFAULT_IMPOSITION,
  DEFAULT_LINEAR,
  DEFAULT_OCTAN_WEEK,
  DEFAULT_PAGE,
  newDecorations,
} from "../types/document";
import {
  CONFIG_FORMAT,
  CONFIG_VERSION,
  parseConfigFile,
  serializeConfig,
  suggestConfigName,
} from "./configFile";

const snapshot = (): DocumentSnapshot => {
  const decorations = newDecorations();
  decorations.header.content = { kind: "text", text: "手帐" };
  decorations.innerWatermark = {
    text: "BASE6",
    style: { sizePt: 8, color: "#123456" },
  };
  return {
    sections: [
      {
        id: "a",
        name: "第一章",
        pages: 2,
        numbered: true,
        body: DEFAULT_LINEAR,
        margins: { headerMm: 30 },
        decorations: null,
      },
      {
        id: "b",
        name: "",
        pages: 3,
        numbered: false,
        body: DEFAULT_DOTS,
        margins: null,
        decorations: {
          footer: {
            content: { kind: "empty" },
            pageNumber: true,
            align: "outer",
            style: { sizePt: 9, color: "#000000" },
          },
        },
      },
    ],
    page: {
      paper: { kind: "b6" },
      margins: { headerMm: 12, footerMm: 14, innerMm: 16, outerMm: 18 },
    },
    decorations,
    imposition: { mode: "thread", sheetsPerSignature: 4 },
  };
};

const withoutIds = (sections: DocumentSnapshot["sections"]) =>
  sections.map(({ id: _id, ...section }) => section);

describe("serializeConfig", () => {
  it("写入格式标记、版本与导出时间，section 不携带内部 id", () => {
    const text = serializeConfig(snapshot(), new Date("2026-11-11T08:00:00Z"));
    const file = JSON.parse(text) as Record<string, unknown>;
    expect(file.format).toBe(CONFIG_FORMAT);
    expect(file.version).toBe(CONFIG_VERSION);
    expect(file.exportedAt).toBe("2026-11-11T08:00:00.000Z");
    const sections = file.sections as Record<string, unknown>[];
    expect(sections).toHaveLength(2);
    expect(sections[0]).not.toHaveProperty("id");
    expect(sections[0]).toMatchObject({ name: "第一章", pages: 2 });
    // 装订只有左侧，不写进导出文件。
    expect(file.page).not.toHaveProperty("binding");
  });
});

describe("parseConfigFile", () => {
  it("序列化后重新解析可完整还原文档数据", () => {
    const before = snapshot();
    const result = parseConfigFile(serializeConfig(before));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // id 在导入时重新生成，比较其余字段
    expect(withoutIds(result.snapshot.sections)).toEqual(
      withoutIds(before.sections),
    );
    expect(result.snapshot.page).toEqual(before.page);
    expect(result.snapshot.decorations).toEqual(before.decorations);
    expect(result.snapshot.imposition).toEqual(before.imposition);
  });

  it("导入的 section 重新生成互不重复的 id", () => {
    const result = parseConfigFile(
      JSON.stringify({
        format: CONFIG_FORMAT,
        version: 1,
        sections: [
          {
            id: "same",
            name: "A",
            pages: 1,
            numbered: true,
            body: { kind: "blank" },
          },
          {
            id: "same",
            name: "B",
            pages: 1,
            numbered: true,
            body: { kind: "blank" },
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.snapshot.sections.map((section) => section.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("非法字段按边界收敛：页数、颜色、未知模板", () => {
    const result = parseConfigFile(
      JSON.stringify({
        format: CONFIG_FORMAT,
        version: 1,
        sections: [
          {
            pages: 0,
            numbered: true,
            body: {
              kind: "linear",
              spacingMm: 0,
              color: "red",
              lineWidthPt: 100,
              marginLine: null,
            },
          },
          {
            pages: 5,
            numbered: false,
            body: { kind: "unknown" },
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [first, second] = result.snapshot.sections;
    expect(first.pages).toBe(1);
    expect(first.body).toEqual({
      kind: "linear",
      spacingMm: 0.1,
      color: "#9E9E9E",
      lineWidthPt: 10,
      marginLine: null,
    });
    expect(second.body).toEqual({ kind: "blank" });
    expect(second.numbered).toBe(false);
  });

  it("缺少页面设置与装饰时回落默认值", () => {
    const result = parseConfigFile(
      JSON.stringify({
        format: CONFIG_FORMAT,
        version: 1,
        sections: [],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.sections).toEqual([]);
    expect(result.snapshot.page).toEqual(DEFAULT_PAGE);
    expect(result.snapshot.decorations).toEqual(newDecorations());
    expect(result.snapshot.imposition).toEqual(DEFAULT_IMPOSITION);
  });

  it("JSON 语法错误返回 invalidJson", () => {
    expect(parseConfigFile("{oops")).toEqual({
      ok: false,
      error: "invalidJson",
    });
  });

  it("缺少格式标记或 sections 时返回 notConfig", () => {
    expect(parseConfigFile("[]")).toEqual({ ok: false, error: "notConfig" });
    expect(parseConfigFile("null")).toEqual({ ok: false, error: "notConfig" });
    expect(
      parseConfigFile(JSON.stringify({ format: "other", sections: [] })),
    ).toEqual({ ok: false, error: "notConfig" });
    expect(
      parseConfigFile(JSON.stringify({ format: CONFIG_FORMAT, version: 1 })),
    ).toEqual({ ok: false, error: "notConfig" });
  });

  it("版本号非法返回 notConfig，高于当前版本返回 unsupportedVersion", () => {
    expect(
      parseConfigFile(
        JSON.stringify({ format: CONFIG_FORMAT, version: 0, sections: [] }),
      ),
    ).toEqual({ ok: false, error: "notConfig" });
    expect(
      parseConfigFile(
        JSON.stringify({
          format: CONFIG_FORMAT,
          version: CONFIG_VERSION + 1,
          sections: [],
        }),
      ),
    ).toEqual({ ok: false, error: "unsupportedVersion" });
  });
});

describe("suggestConfigName", () => {
  it("按 base6-techo-config-YYYYMMDD-HHmm.json 生成，补零", () => {
    expect(suggestConfigName(new Date(2026, 10, 7, 9, 5))).toBe(
      "base6-techo-config-20261107-0905.json",
    );
  });
});

describe("octan week round trip", () => {
  it("导入导出保留八分周视图参数，并按周数校正页数", () => {
    const before: DocumentSnapshot = {
      sections: [
        {
          id: "octan",
          name: "周视图",
          pages: 4,
          numbered: true,
          body: {
            ...DEFAULT_OCTAN_WEEK,
            startDate: "2026-08-03",
            endDate: "2026-08-16",
          },
          margins: null,
          decorations: null,
        },
      ],
      page: DEFAULT_PAGE,
      decorations: newDecorations(),
      imposition: DEFAULT_IMPOSITION,
    };
    const result = parseConfigFile(serializeConfig(before));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.sections[0].pages).toBe(4);
    expect(result.snapshot.sections[0].body).toEqual(before.sections[0].body);
  });
});
