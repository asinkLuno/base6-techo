import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_PDF_VIEW_MODE, type PdfViewMode } from "../lib/pdfView";

/** 可选主题。须与 src/index.css 里 @plugin "daisyui" 的主题列表保持一致。 */
export type ThemeName = "light" | "dark";

/** 界面语言。nativeLabel 用语言自称，不随界面翻译。 */
export const LANGUAGES = [
  { code: "zh-CN", nativeLabel: "简体中文" },
  { code: "en", nativeLabel: "English" },
] as const;
export type Language = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: Language = "zh-CN";
export const DEFAULT_THEME: ThemeName = "light";

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
      migrate: (persisted, version) => {
        if (version >= 2) return persisted as SettingsState;
        return {
          ...(persisted as Partial<SettingsState>),
          pdfViewMode: DEFAULT_PDF_VIEW_MODE,
        } as SettingsState;
      },
    },
  ),
);
