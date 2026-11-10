import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation } from "react-router";
import { useSettingsSync } from "../hooks/useSettingsSync";

/** 设置入口：右上角齿轮按钮。 */
function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
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
  const onSettings = useLocation().pathname === "/settings";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="navbar bg-base-200 shadow-sm">
        <div className="navbar-start">
          <Link to="/" className="btn btn-ghost text-base font-semibold">
            {t("app.name")}
          </Link>
        </div>
        <div className="navbar-end">
          {/* 设置按钮往返：在设置页时点击回主界面 */}
          <Link
            to={onSettings ? "/" : "/settings"}
            className="btn btn-ghost btn-circle"
            aria-label={t("settings.title")}
          >
            <SettingsIcon />
          </Link>
        </div>
      </header>

      {/* 通栏铺满窗口，不再居中限宽：编辑器左列可随窗口伸展，右栏保持固定宽度。
          横向留白只由内边距提供，手机上收窄到 12px 让内容更满。 */}
      <main className="w-full flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
