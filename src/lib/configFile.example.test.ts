import { describe, expect, it } from "vitest";
import example from "../../examples/weekly-2027.json";
import { octanWeekPages } from "../types/document";
import { parseConfigFile } from "./configFile";

const text = JSON.stringify(example);

const addDays = (iso: string, n: number) =>
  new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000)
    .toISOString()
    .slice(0, 10);

describe("examples/weekly-2027.json", () => {
  it("能按导入格式解析，并且页数与模板一致", () => {
    const result = parseConfigFile(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { sections } = result.snapshot;
    expect(sections).toHaveLength(24);
    const total = sections.reduce((sum, section) => sum + section.pages, 0);
    expect(total).toBe(118);
    for (const section of sections) {
      if (section.body.kind === "octanWeek") {
        expect(section.pages).toBe(octanWeekPages(section.body));
      } else if (section.body.kind === "month") {
        expect(section.pages).toBe(1);
      }
    }
  });

  it("周视图首尾相接，覆盖 2027 每一天且不重复", () => {
    const result = parseConfigFile(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const weeks = result.snapshot.sections.filter(
      (section) => section.body.kind === "octanWeek",
    );
    const covers = new Map<string, number>();
    let expectedStart = "2026-12-28";
    for (const section of weeks) {
      if (section.body.kind !== "octanWeek") continue;
      expect(section.body.startDate).toBe(expectedStart);
      for (
        let day = section.body.startDate;
        day <= section.body.endDate;
        day = addDays(day, 1)
      ) {
        covers.set(day, (covers.get(day) ?? 0) + 1);
      }
      expectedStart = addDays(section.body.endDate, 1);
    }
    expect(expectedStart).toBe("2028-01-03");
    for (let day = "2027-01-01"; day <= "2027-12-31"; day = addDays(day, 1)) {
      expect(covers.get(day)).toBe(1);
    }
  });

  it("每月按「月历 → 周视图」交替排列", () => {
    const result = parseConfigFile(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.snapshot.sections.forEach((section, index) => {
      const month = `2027-${String(Math.floor(index / 2) + 1).padStart(2, "0")}`;
      if (index % 2 === 0) {
        expect(section.body.kind).toBe("month");
        if (section.body.kind === "month") {
          expect(section.body.startMonth).toBe(month);
          expect(section.body.months).toBe(1);
        }
      } else {
        expect(section.body.kind).toBe("octanWeek");
      }
    });
  });
});
