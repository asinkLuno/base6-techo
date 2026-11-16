/**
 * 农历副标签：把一段连续的月份展开成 `YYYY-MM-DD` → 标签的映射，交给
 * Rust 在年历日号下方绘制。纯函数，不碰文件系统。
 *
 * 历法换算交给 lunar-typescript（逐日天文推算，无硬性年份上限），
 * 词条与显示约定留在本项目：
 * - 初一显示月名（正月 / 闰六月），其余显示日名（初二 … 三十）——
 *   中国台历的通行写法，比「月 + 日」短一半，迷你月历的格子里才放得下。
 * - 英文没有对应短名，改用 `M1` / `LM6`（闰月）与纯日号，保持 4 字符以内。
 *
 * 库本身约 100KB gzip，只在用户真的开启农历并生成时才下载，所以下面的
 * 导出都是异步的：`import("lunar-typescript")` 是唯一入口，结果缓存复用。
 */

import type { Language } from "../stores/settings";
import { MONTHS_MAX, type YearPattern } from "../types/document";

/** 一条解析结果：`YYYY-MM-DD` → 标签。 */
export type LunarMap = Record<string, string>;

/** 标签最多几个字符：超出就由 Rust 侧按格宽继续缩小字号。 */
export const LUNAR_LABEL_MAX = 8;

type SolarApi = typeof import("lunar-typescript")["Solar"];

/** 动态加载结果缓存在模块里：同一次编辑的多次生成只下载一次。 */
let solar: Promise<SolarApi> | null = null;

const loadSolar = (): Promise<SolarApi> => {
  solar ??= import("lunar-typescript").then((module) => module.Solar);
  return solar;
};

const pad2 = (value: number) => String(value).padStart(2, "0");

/** 中文词条：初一带月份名，其余带日名。 */
const zhLabel = (day: number, monthName: string, dayName: string) =>
  day === 1 ? `${monthName}月` : dayName;

/** 英文词条：日号直接用数字，初一标记月序（`LM` 表示闰月）。 */
const enLabel = (month: number, day: number): string => {
  if (day !== 1) return String(day);
  return `${month < 0 ? "LM" : "M"}${Math.abs(month)}`;
};

/** 公历每月天数，下标 1–12（索引 0 占位）。 */
const MONTH_DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * 当月天数。闰年规则直接写，不用 `Date.UTC(year, month, 0)`：
 * 那个入口会把 0–99 年当成 1900+year，1–99 年的二月会算错一天。
 */
const daysInMonth = (year: number, month: number): number => {
  if (month !== 2) return MONTH_DAYS[month];
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
};

/**
 * 展开 `startMonth` 起连续 `months` 个月的农历标签。
 * 非法起始月或零月数返回空映射，不抛错——农历只是副标签，缺了不影响出图。
 */
export async function lunarLabels(
  startMonth: string,
  months: number,
  language: Language,
): Promise<LunarMap> {
  const match = /^(\d{4})-(\d{2})$/.exec(startMonth);
  if (!match) return {};
  const startYear = Number(match[1]);
  const startMonthNumber = Number(match[2]);
  if (startYear < 1 || startMonthNumber < 1 || startMonthNumber > 12) return {};
  const count = Math.min(Math.max(Math.round(months) || 0, 0), MONTHS_MAX);
  if (count === 0) return {};

  const Solar = await loadSolar();
  const out: LunarMap = {};
  for (let offset = 0; offset < count; offset += 1) {
    const year = startYear + Math.floor((startMonthNumber - 1 + offset) / 12);
    const month = ((startMonthNumber - 1 + offset) % 12) + 1;
    if (year > 9999) break;
    const days = daysInMonth(year, month);
    for (let day = 1; day <= days; day += 1) {
      const lunar = Solar.fromYmd(year, month, day).getLunar();
      const lunarMonth = lunar.getMonth();
      const lunarDay = lunar.getDay();
      const label =
        language === "zh-CN"
          ? zhLabel(
              lunarDay,
              lunar.getMonthInChinese(),
              lunar.getDayInChinese(),
            )
          : enLabel(lunarMonth, lunarDay);
      if (label === "" || label.length > LUNAR_LABEL_MAX) continue;
      out[`${year}-${pad2(month)}-${pad2(day)}`] = label;
    }
  }
  return out;
}

/** 年历模板的农历标签；未开启 `showLunar` 时返回空映射，不发多余数据，也不加载库。 */
export function yearLunarLabels(
  body: YearPattern,
  language: Language,
): Promise<LunarMap> {
  if (!body.showLunar) return Promise.resolve({});
  return lunarLabels(body.startMonth, body.months, language);
}

/** 全书合并：多个年历 section 的日期区间可能重叠，后写覆盖前写（同一日期标签相同）。 */
export async function documentLunarLabels(
  bodies: readonly YearPattern[],
  language: Language,
): Promise<LunarMap> {
  const out: LunarMap = {};
  for (const body of bodies) {
    Object.assign(out, await yearLunarLabels(body, language));
  }
  return out;
}
