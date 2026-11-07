import { Link, NavLink, Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { useSettingsStore } from "../stores/settings";
import { useSettingsSync } from "../hooks/useSettingsSync";

const NAV_ITEMS = [
  { to: "/", key: "nav.home", end: true },
  { to: "/settings", key: "nav.settings" },
] as const;

function SunIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

/** 明暗快速切换：非 light/dark 主题一律视为亮色系。 */
function ThemeToggle() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="btn btn-ghost btn-circle"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "light" : "dark"}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
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
        <nav className="navbar-center">
          <ul className="menu menu-horizontal gap-2">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={"end" in item && item.end}
                  className={({ isActive }) => clsx(isActive && "menu-active")}
                >
                  {t(item.key)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="navbar-end">
          <ThemeToggle />
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
