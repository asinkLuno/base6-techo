import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { useSettingsStore } from "../stores/settings";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";

export const resources = {
  "zh-CN": { translation: zhCN },
  en: { translation: en },
} as const;

// 内联资源、无异步后端，init 同步完成；初始语言取自设置 store（localStorage）。
void i18n.use(initReactI18next).init({
  resources,
  lng: useSettingsStore.getState().language,
  fallbackLng: "zh-CN",
  interpolation: { escapeValue: false },
});

export default i18n;
