/**
 * iCalendar（.ics）假日导入：只取 VEVENT 的日期与标题。
 * 纯函数，不碰文件系统；返回值直接交给 clampHolidays 收敛。
 *
 * 支持范围与 archive 分支一致：展开折行、DTSTART/DTEND/SUMMARY，
 * DTEND 为开区间（末日不算），缺 DTEND 按单日；时间与时区一律截掉只用日期。
 * 不处理 RRULE（重复事件只落首个 DTSTART）、EXDATE 与 ICS 转义序列。
 */

import { HOLIDAYS_MAX } from "../types/document";

/** 一条解析结果：`YYYY-MM-DD` → 名称；同名日期后者覆盖前者。 */
export type HolidayMap = Record<string, string>;

/** ICS 日期时间：`20270101` 或 `20270101T090000[Z]`；只取开头 8 位。 */
const ICS_DATE = /^(\d{4})(\d{2})(\d{2})/;

/** 单次事件最多跨 366 天，防止损坏文件里的超长区间把内存打满。 */
const EVENT_DAYS_MAX = 366;

/** 解析成 `YYYY-MM-DD`；非法日期（含 2 月 30 日）返回 null。 */
export function parseIcsDate(value: string): string | null {
  const match = ICS_DATE.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // 回读校验：Date 会把 2 月 30 日滚到 3 月，日期不一致即非法。
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** 日期序号（UTC 天），用于比较与推进；跨 9999 年也不会退化成字符串比较。 */
function toOrdinal(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** 序号换成 `YYYY-MM-DD`。 */
function fromOrdinal(ordinal: number): string {
  const date = new Date(ordinal * 86_400_000);
  const pad = (value: number, width: number) =>
    String(value).padStart(width, "0");
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

/** 日期减一天，用于把开区间的 DTEND 折成闭区间末日。 */
function previousDay(iso: string): string {
  return fromOrdinal(toOrdinal(iso) - 1);
}

/** 逐日列出 `[start, end]`（闭区间）内的日期，上限 366 天。 */
function eachDay(start: string, end: string): string[] {
  const last = toOrdinal(end);
  const first = toOrdinal(start);
  const days: string[] = [];
  for (let i = 0; i < EVENT_DAYS_MAX && first + i <= last; i++) {
    days.push(fromOrdinal(first + i));
  }
  return days;
}

/** 展开 RFC 5545 折行：以空格或制表符开头的续行接到上一行。 */
function unfold(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.split(/\r\n|\r|\n/)) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += raw.slice(1);
      continue;
    }
    lines.push(raw);
  }
  return lines;
}

/** 取 `KEY;PARAM=x:VALUE` 的键名（大写）与值。 */
function splitProperty(line: string): { name: string; value: string } | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const name = head.split(";")[0].trim().toUpperCase();
  return name === "" ? null : { name, value: line.slice(colon + 1) };
}

/**
 * 解析 .ics 文本，返回日期 → 名称。
 * 无 DTSTART 或无 SUMMARY 的事件跳过；跨日事件把每一天都写进映射。
 * 结果最多 `HOLIDAYS_MAX` 条：超出后不再写入，避免 8 MB 日历把界面卡死。
 */
export function parseIcs(text: string): HolidayMap {
  const holidays: HolidayMap = {};
  let count = 0;
  let start: string | null = null;
  let end: string | null = null;
  let summary = "";
  // 只认最外层 VEVENT 的属性：VALARM 里的 SUMMARY/DTSTART 不能覆盖事件本身。
  let depth = 0;

  const reset = () => {
    start = null;
    end = null;
    summary = "";
  };

  const flush = () => {
    if (start && summary.trim() !== "") {
      const name = summary.trim();
      const last =
        end && toOrdinal(end) > toOrdinal(start) ? previousDay(end) : start;
      for (const day of eachDay(start, last)) {
        if (!(day in holidays)) {
          if (count >= HOLIDAYS_MAX) break;
          count += 1;
        }
        holidays[day] = name;
      }
    }
    reset();
  };

  for (const line of unfold(text)) {
    const upper = line.trim().toUpperCase();
    if (upper.startsWith("BEGIN:")) {
      depth += 1;
      if (upper === "BEGIN:VEVENT") {
        // 缺 END:VEVENT 的残文件：新事件开始前先把上一条收尾。
        flush();
      }
      continue;
    }
    if (upper.startsWith("END:")) {
      if (upper === "END:VEVENT") flush();
      depth = Math.max(0, depth - 1);
      continue;
    }
    // 只认 VEVENT 自身的属性：VCALENDAR 层与 VALARM 等嵌套组件都跳过。
    if (depth !== 2) continue;
    const property = splitProperty(line);
    if (!property) continue;
    if (property.name === "DTSTART") {
      start = parseIcsDate(property.value);
    } else if (property.name === "DTEND") {
      end = parseIcsDate(property.value);
    } else if (property.name === "SUMMARY") {
      summary = property.value;
    }
  }
  // 文件在事件中途结束时仍有有效数据，收尾一次避免丢最后一条。
  flush();
  return holidays;
}
