import { useTranslation } from "react-i18next";
import { LANGUAGES, useSettingsStore } from "../stores/settings";

export default function SettingsPage() {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
      </header>

      <div className="card bg-base-100 shadow-md">
        <div className="card-body gap-4">
          <fieldset className="fieldset">
            <legend className="fieldset-legend">
              {t("settings.language")}
            </legend>
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
        </div>
      </div>
    </div>
  );
}
