import { Link, Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import { useSettingsSync } from "../hooks/useSettingsSync";

/** 设置入口：右上角齿轮按钮。 */
function SettingsIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function RootLayout() {
  useSettingsSync();
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="navbar bg-base-200 shadow-sm">
        <div className="navbar-start">
          <Link to="/" className="btn btn-ghost text-base font-semibold">
            {t("app.name")}
          </Link>
        </div>
        <div className="navbar-end">
          <Link
            to="/settings"
            className="btn btn-ghost btn-circle"
            aria-label={t("settings.title")}
          >
            <SettingsIcon />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="py-4 text-center text-sm opacity-60">
        {t("app.tagline")}
      </footer>
    </div>
  );
}
