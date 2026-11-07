import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemeName) => void;
}

/** 用户偏好（持久化到 localStorage，key: base6-techo:settings）。 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: DEFAULT_LANGUAGE,
      theme: DEFAULT_THEME,
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "base6-techo:settings",
      // schema 变更时递增 version 并在 migrate 里处理旧数据（index.html 的首帧脚本同步改）。
      // v1 与 v0 结构相同，透传即可；不提供 migrate 时版本不匹配会整体丢弃已存状态。
      version: 1,
      migrate: (persisted) => persisted as SettingsState,
    },
  ),
);
