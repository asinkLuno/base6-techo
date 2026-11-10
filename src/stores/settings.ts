import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_PDF_VIEW_MODE,
  isPdfViewMode,
  type PdfViewMode,
} from "../lib/pdfView";

/** 可选主题。须与 src/index.css 里 @plugin "daisyui" 的主题列表保持一致。 */
export const THEMES = ["light", "dark"] as const;
export type ThemeName = (typeof THEMES)[number];

/** 界面语言。nativeLabel 用语言自称，不随界面翻译。 */
export const LANGUAGES = [
  { code: "zh-CN", nativeLabel: "简体中文" },
  { code: "en", nativeLabel: "English" },
] as const;
export type Language = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: Language = "zh-CN";
export const DEFAULT_THEME: ThemeName = "light";

export const isLanguage = (value: unknown): value is Language =>
  LANGUAGES.some((language) => language.code === value);

export const isThemeName = (value: unknown): value is ThemeName =>
  (THEMES as readonly string[]).includes(value as string);

/** 持久化偏好是外部输入：逐项校验，非法值回落默认，不让坏数据污染 store。 */
export interface SettingsData {
  language: Language;
  theme: ThemeName;
  pdfViewMode: PdfViewMode;
}

export function normalizeSettingsData(value: unknown): SettingsData {
  const data =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  return {
    language: isLanguage(data.language) ? data.language : DEFAULT_LANGUAGE,
    theme: isThemeName(data.theme) ? data.theme : DEFAULT_THEME,
    pdfViewMode: isPdfViewMode(data.pdfViewMode)
      ? data.pdfViewMode
      : DEFAULT_PDF_VIEW_MODE,
  };
}

/** 水合合并：当前 state（含 action）打底，持久化数据只覆盖三个偏好字段。 */
export function mergeSettingsData<T extends SettingsData>(
  persisted: unknown,
  current: T,
): T {
  return { ...current, ...normalizeSettingsData(persisted) };
}

interface SettingsState {
  language: Language;
  theme: ThemeName;
  /** PDF 预览的视图模式（连续滚动 / 单页 / 双页对开）。 */
  pdfViewMode: PdfViewMode;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemeName) => void;
  setPdfViewMode: (mode: PdfViewMode) => void;
}

/** 用户偏好（持久化到 localStorage，key: base6-techo:settings）。 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: DEFAULT_LANGUAGE,
      theme: DEFAULT_THEME,
      pdfViewMode: DEFAULT_PDF_VIEW_MODE,
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setPdfViewMode: (pdfViewMode) => set({ pdfViewMode }),
    }),
    {
      name: "base6-techo:settings",
      // schema 变更时递增 version 并在 migrate 里处理旧数据（index.html 的首帧脚本同步改）。
      // v1 与 v0 结构相同，透传即可；不提供 migrate 时版本不匹配会整体丢弃已存状态。
      // v2 新增 pdfViewMode，旧数据补默认值。
      version: 2,
      // 旧版本缺的字段由 merge 里的逐项校验补默认；migrate 只负责跨过版本门槛。
      migrate: (persisted) => persisted as SettingsState,
      // 水合时始终过一遍边界校验：同版本数据也可能被手改成非法值。
      merge: mergeSettingsData,
    },
  ),
);
