import { useEffect } from "react";
import i18n from "../i18n";
import { useSettingsStore } from "../stores/settings";

/** 把设置 store 同步到副作用：i18next 语言、<html> 的 data-theme 与 lang。在根布局调用一次。 */
export function useSettingsSync() {
  const language = useSettingsStore((s) => s.language);
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [language]);
}
