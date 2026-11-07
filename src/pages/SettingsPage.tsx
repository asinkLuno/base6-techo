import { useTranslation } from "react-i18next";
import { LANGUAGES, THEMES, useSettingsStore } from "../stores/settings";

export default function SettingsPage() {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <p className="opacity-70">{t("settings.description")}</p>
      </header>

      <div className="card bg-base-100 shadow-md">
        <div className="card-body gap-4">
          <h2 className="card-title">{t("settings.appearance")}</h2>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">{t("settings.language")}</legend>
            <select
              className="select w-full max-w-xs"
              value={language}
              onChange={(e) => setLanguage(e.target.value as typeof language)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeLabel}
                </option>
              ))}
            </select>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">{t("settings.theme")}</legend>
            <select
              className="select w-full max-w-xs"
              value={theme}
              onChange={(e) => setTheme(e.target.value as typeof theme)}
            >
              {THEMES.map((name) => (
                <option key={name} value={name}>
                  {t(`settings.themes.${name}`)}
                </option>
              ))}
            </select>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
