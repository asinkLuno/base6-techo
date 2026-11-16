import { describe, expect, it } from "vitest";
import { parseIcs, parseIcsDate } from "./ics";

const event = (start: string, summary: string, end?: string): string =>
  [
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:${start}`,
    ...(end ? [`DTEND;VALUE=DATE:${end}`] : []),
    `SUMMARY:${summary}`,
    "END:VEVENT",
  ].join("\r\n");

const ics = (...events: string[]): string =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//test//test//CN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

describe("parseIcsDate", () => {
  it("accepts date-only and date-time forms and truncates the time", () => {
    expect(parseIcsDate("20270101")).toBe("2027-01-01");
    expect(parseIcsDate("20270101T090000")).toBe("2027-01-01");
    expect(parseIcsDate("20270101T090000Z")).toBe("2027-01-01");
  });

  it("rejects impossible dates and garbage", () => {
    expect(parseIcsDate("20270230")).toBeNull();
    expect(parseIcsDate("20271301")).toBeNull();
    expect(parseIcsDate("not-a-date")).toBeNull();
    expect(parseIcsDate("")).toBeNull();
  });
});

describe("parseIcs", () => {
  it("maps a single event to its start date", () => {
    expect(parseIcs(ics(event("20270101", "元旦")))).toEqual({
      "2027-01-01": "元旦",
    });
  });

  it("treats DTEND as exclusive and fills every day in the span", () => {
    expect(parseIcs(ics(event("20270101", "春节", "20270104")))).toEqual({
      "2027-01-01": "春节",
      "2027-01-02": "春节",
      "2027-01-03": "春节",
    });
  });

  it("unfolds folded summary lines", () => {
    const folded = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20270501",
      "SUMMARY:劳动",
      " 节",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(parseIcs(folded)).toEqual({ "2027-05-01": "劳动节" });
  });

  it("lets a later event win on the same date and skips nameless events", () => {
    const text = ics(
      event("20270101", "旧名"),
      event("20270101", "新名"),
      event("20270102", "   "),
    );
    expect(parseIcs(text)).toEqual({ "2027-01-01": "新名" });
  });

  it("skips events without DTSTART and ignores non-VEVENT properties", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "X-WR-CALNAME:工作日历",
      "BEGIN:VEVENT",
      "SUMMARY:无日期",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(parseIcs(text)).toEqual({});
  });

  it("keeps the last event when the file ends mid-event", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20271001",
      "SUMMARY:国庆",
    ].join("\n");
    expect(parseIcs(text)).toEqual({ "2027-10-01": "国庆" });
  });

  it("returns an empty map for empty input", () => {
    expect(parseIcs("")).toEqual({});
  });

  it("ignores properties of nested components such as VALARM", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20270101",
      "SUMMARY:元旦",
      "BEGIN:VALARM",
      "DTSTART:20271225",
      "SUMMARY:提醒",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(parseIcs(text)).toEqual({ "2027-01-01": "元旦" });
  });

  it("compares spans numerically, so a reversed DTEND keeps only the start", () => {
    expect(parseIcs(ics(event("20270105", "错序", "20270101")))).toEqual({
      "2027-01-05": "错序",
    });
  });

  it("stops at the holiday cap instead of materialising everything", () => {
    const many = Array.from({ length: 5000 }, (_, index) =>
      event("20270101", `第 ${index} 条`),
    );
    const parsed = parseIcs(ics(...many));
    expect(Object.keys(parsed)).toHaveLength(1);
    // 单日事件都落在同一天，仍只占一条；换成不同日期才会触发上限。
    const spread = Array.from({ length: 5000 }, (_, index) => {
      const date = new Date(Date.UTC(2027, 0, 1 + index));
      const pad = (value: number) => String(value).padStart(2, "0");
      const iso = `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
      return event(iso, `第 ${index} 条`);
    });
    expect(Object.keys(parseIcs(ics(...spread))).length).toBe(4096);
  });
});
