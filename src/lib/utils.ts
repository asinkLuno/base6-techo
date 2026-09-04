import type { Section, Values } from "./schema";
import { patternNames } from "./schema";

export function stripNulls<T>(obj: T): T {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    out[k] = typeof v === "object" ? stripNulls(v) : v;
  }
  return out as T;
}

export function parseISODate(s: string): Date | undefined {
  const [y, m, d] = s.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}

// 把 "30°15′N" / "30.25" 等转成十进制，非法输入返回 null。
export function toDecimal(raw: string): number | null {
  const orig = raw.trim();
  if (!orig) return null;
  const parts = orig.replace(/[NSEWnsew]/g, "").split(/[°度′'’"″]/);
  if (parts.length === 1) {
    const v = Number(parts[0]);
    return Number.isFinite(v) ? v : null;
  }
  const [deg, min = "0", sec = "0"] = parts;
  const d = Number(deg), mi = Number(min), se = Number(sec);
  if (![d, mi, se].every(Number.isFinite)) return null;
  const negative = /[SWsw]/.test(orig) || /^-/.test(deg.trim());
  return (Math.abs(d) + mi / 60 + se / 3600) * (negative ? -1 : 1);
}

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function cleanPattern(pattern: Section["pattern"]) {
  if (pattern.kind === "timeline")
    return {
      ...pattern,
      latitude: pattern.latitude ?? null,
      longitude: pattern.longitude ?? null,
      timezone: pattern.timezone || null,
      start_date: pattern.start_date || null,
      end_date: pattern.end_date || null,
    };
  return pattern;
}

// 页数由版式真实参数决定：是多少页就算多少页。
export function effectivePages(section: Section): number {
  const p = section.pattern;
  if (p.kind === "month-tracker") return p.two_page ? 2 : 1;
  if (p.kind === "ruled" || p.kind === "dots" || p.kind === "grid" || p.kind === "us-ruled" || p.kind === "seyes" || p.kind === "timeline" || p.kind === "vertical" || p.kind === "blank")
    return Math.max(1, Number(p.pages) || 1);
  if (p.kind === "八分周视图") {
    const start = parseISODate(String(p.start_date));
    const end = parseISODate(String(p.end_date));
    if (start && end && start <= end) return (Math.floor((end.getTime() - start.getTime()) / 86400000 / 7) + 1) * 2;
  }
  if (p.kind === "hakubunkan-toyo-nikki") {
    const start = parseISODate(String(p.start_date));
    const end = parseISODate(String(p.end_date));
    if (start && end && start <= end) return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  }
  if (p.kind === "hakubunkan-kaichu-nikki") {
    const start = parseISODate(String(p.start_date));
    const end = parseISODate(String(p.end_date));
    if (start && end && start <= end) return Math.ceil((Math.round((end.getTime() - start.getTime()) / 86400000) + 1) / 2);
  }
  if (p.kind === "year") {
    const [sy, sm] = String(p.start).split("-").map(Number);
    const [ey, em] = String(p.end).split("-").map(Number);
    if (sy && sm && ey && em) {
      const months = ey * 12 + em - sy * 12 - sm + 1;
      if (months > 0) return Math.ceil(months / (Number(p.rows) * Number(p.cols) || 1));
    }
  }
  return 1;
}

// 页头/页脚参数完全一致，共用同一个带状区域请求。
export function bandRequest(values: Values, prefix: "header" | "footer", enabled: boolean, mode: "text" | "number") {
  const text = enabled && mode === "text";
  return {
    text: text ? values[`${prefix}_text`] || null : null,
    text_2: text ? values[`${prefix}_text_2`] || null : null,
    text_size: values[`${prefix}_text_size`],
    text_2_size: values[`${prefix}_text_2_size`],
    text_spacing: values[`${prefix}_text_spacing`],
    text_color: values[`${prefix}_text_color`],
    page_number: enabled && mode === "number",
  };
}

export function sectionRequest(section: Section, holidays: Record<string, string>) {
  return stripNulls({
    page: {
      ...section.page,
      header: section.headerEnabled ? section.page.header : 0,
      footer: section.footerEnabled ? section.page.footer : 0,
      binding: section.watermarkEnabled ? section.page.binding : 0,
      non_binding: section.nonBindingEnabled ? section.page.non_binding : 0,
    },
    document: {
      page_number: section.pageNumber,
      header: bandRequest(section.document, "header", section.headerEnabled, section.headerMode),
      footer: bandRequest(section.document, "footer", section.footerEnabled, section.footerMode),
      binding_text: section.watermarkEnabled ? section.document.binding_text || null : null,
      binding_text_2: section.watermarkEnabled ? section.document.binding_text_2 || null : null,
      binding_text_size: section.document.binding_text_size,
      binding_text_2_size: section.document.binding_text_2_size,
      binding_text_spacing: section.document.binding_text_spacing,
      binding_text_edge: section.document.binding_text_edge,
      binding_text_font: section.document.binding_text_font,
      binding_text_color: section.document.binding_text_color,
      non_binding_text: section.nonBindingEnabled ? section.document.non_binding_text || null : null,
      non_binding_text_2: section.nonBindingEnabled ? section.document.non_binding_text_2 || null : null,
      non_binding_text_size: section.document.non_binding_text_size,
      non_binding_text_2_size: section.document.non_binding_text_2_size,
      non_binding_text_spacing: section.document.non_binding_text_spacing,
      non_binding_text_edge: section.document.non_binding_text_edge,
      non_binding_text_color: section.document.non_binding_text_color,
    },
    title: patternNames[section.pattern.kind],
    pattern: cleanPattern(section.pattern),
    holidays,
  });
}
