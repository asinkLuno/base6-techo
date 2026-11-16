import { describe, expect, it } from "vitest";
import { DEFAULT_YEAR, MONTHS_MAX, type YearPattern } from "../types/document";
import {
  documentLunarLabels,
  LUNAR_LABEL_MAX,
  lunarLabels,
  yearLunarLabels,
} from "./lunar";

const year = (patch: Partial<YearPattern> = {}): YearPattern => ({
  ...DEFAULT_YEAR,
  ...patch,
});

describe("lunarLabels", () => {
  it("初一带月份名，其余带日名", async () => {
    const labels = await lunarLabels("2026-02", 1, "zh-CN");
    expect(labels["2026-02-17"]).toBe("正月");
    expect(labels["2026-02-18"]).toBe("初二");
    expect(labels["2026-02-28"]).toBe("十二");
    expect(labels["2026-02-16"]).toBe("廿九");
  });

  it("闰月带闰字，初一带月份名", async () => {
    // 2025 年闰六月：2025-07-25 是闰六月初一。
    const labels = await lunarLabels("2025-07", 1, "zh-CN");
    expect(labels["2025-07-25"]).toBe("闰六月");
    expect(labels["2025-07-26"]).toBe("初二");
  });

  it("连续月数跨年推进，键覆盖每个公历日", async () => {
    const labels = await lunarLabels("2026-12", 2, "zh-CN");
    // 2026-12 有 31 天、2027-01 有 31 天。
    expect(Object.keys(labels)).toHaveLength(62);
    expect(labels["2026-12-01"]).toBeDefined();
    expect(labels["2027-01-31"]).toBeDefined();
    expect(labels["2027-02-01"]).toBeUndefined();
  });

  it("英文用 M/LM 与日号，不再出中文字", async () => {
    const labels = await lunarLabels("2026-02", 1, "en");
    expect(labels["2026-02-17"]).toBe("M1");
    expect(labels["2026-02-18"]).toBe("2");
    const leap = await lunarLabels("2025-07", 1, "en");
    expect(leap["2025-07-25"]).toBe("LM6");
  });

  it("标签长度不超过上限，避免撑破迷你格子", async () => {
    for (const label of Object.values(
      await lunarLabels("2026-01", 12, "zh-CN"),
    )) {
      expect(label.length).toBeLessThanOrEqual(LUNAR_LABEL_MAX);
    }
    for (const label of Object.values(await lunarLabels("2026-01", 12, "en"))) {
      expect(label.length).toBeLessThanOrEqual(LUNAR_LABEL_MAX);
    }
  });

  it("非法起始月与零/负月数返回空映射，不抛错", async () => {
    expect(await lunarLabels("2026-13", 1, "zh-CN")).toEqual({});
    expect(await lunarLabels("2026-1", 1, "zh-CN")).toEqual({});
    expect(await lunarLabels("", 1, "zh-CN")).toEqual({});
    expect(await lunarLabels("2026-01", 0, "zh-CN")).toEqual({});
    expect(await lunarLabels("2026-01", -3, "zh-CN")).toEqual({});
  });

  it("月数收敛到 MONTHS_MAX，不会无限展开", async () => {
    const labels = await lunarLabels("2026-01", MONTHS_MAX + 100, "zh-CN");
    // 120 个月约 3653 天；上限内不截断，但仍要有限。
    expect(Object.keys(labels).length).toBeLessThan(3700);
    expect(Object.keys(labels).length).toBeGreaterThan(3600);
  });
});

describe("yearLunarLabels", () => {
  it("showLunar 关闭时不产生任何数据", async () => {
    expect(await yearLunarLabels(year({ showLunar: false }), "zh-CN")).toEqual(
      {},
    );
  });

  it("showLunar 开启时按模板的起始月与月数展开", async () => {
    const labels = await yearLunarLabels(
      year({ startMonth: "2027-01", months: 1, showLunar: true }),
      "zh-CN",
    );
    expect(labels["2027-01-01"]).toBeDefined();
    expect(Object.keys(labels)).toHaveLength(31);
  });
});

describe("documentLunarLabels", () => {
  it("只合并开启 showLunar 的年历 section", async () => {
    const labels = await documentLunarLabels(
      [
        year({ startMonth: "2027-01", months: 1, showLunar: true }),
        year({ startMonth: "2027-02", months: 1, showLunar: false }),
      ],
      "zh-CN",
    );
    expect(labels["2027-01-15"]).toBeDefined();
    expect(labels["2027-02-15"]).toBeUndefined();
  });

  it("多个年历重叠区间合并不冲突", async () => {
    const labels = await documentLunarLabels(
      [
        year({ startMonth: "2027-01", months: 1, showLunar: true }),
        year({ startMonth: "2027-01", months: 2, showLunar: true }),
      ],
      "zh-CN",
    );
    expect(Object.keys(labels)).toHaveLength(59);
  });
});

describe("lunarLabels 边界年份", () => {
  it("1 年与 9999 年都不抛错，只跳过无标签的日期", async () => {
    const ancient = await lunarLabels("0001-01", 1, "zh-CN");
    expect(Object.keys(ancient).length).toBeGreaterThan(0);
    const future = await lunarLabels("9999-12", 1, "zh-CN");
    expect(Object.keys(future).length).toBeGreaterThan(0);
  });

  it("1–99 年的二月天数按真实闰年算，不被当成 1900+ 年", async () => {
    // 公元 4 年是闰年（29 天），100 年不是（28 天）。Date.UTC 会把 4 当成 1904。
    expect(Object.keys(await lunarLabels("0004-02", 1, "zh-CN"))).toHaveLength(
      29,
    );
    expect(Object.keys(await lunarLabels("0100-02", 1, "zh-CN"))).toHaveLength(
      28,
    );
  });

  it("起始月贴近 9999 年 12 月时不会把年份推过 9999", async () => {
    const labels = await lunarLabels("9999-12", 3, "zh-CN");
    for (const key of Object.keys(labels)) {
      expect(key.startsWith("9999-12")).toBe(true);
    }
  });
});
