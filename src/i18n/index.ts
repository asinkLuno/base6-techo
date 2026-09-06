import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zhCN from "./zh-CN.json";
import en from "./en.json";

export const LANG_KEY = "base6.lang";
export const LANG_OPTIONS: [string, string][] = [
  ["zh-CN", "中文"],
  ["en", "English"],
];

function initialLanguage(): string {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === "zh-CN" || stored === "en") return stored;
  } catch { /* 无法读存储时退回系统语言 */ }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

void i18n.use(initReactI18next).init({
  resources: {
    "zh-CN": { translation: zhCN },
    en: { translation: en },
  },
  lng: initialLanguage(),
  fallbackLng: "zh-CN",
  returnNull: false,
  interpolation: { escapeValue: false }, // React 已做转义
});

document.documentElement.lang = i18n.language;

// 切换语言并持久化；UI 统一走这里，保证 <html lang> 与存储同步。
export function changeAppLanguage(lng: string) {
  void i18n.changeLanguage(lng);
  try {
    localStorage.setItem(LANG_KEY, lng);
  } catch { /* 隐私模式禁写时仅本次会话生效 */ }
  document.documentElement.lang = lng;
}
