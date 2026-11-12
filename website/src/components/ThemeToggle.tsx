import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "base6-techo:site-theme";

function initialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // 隐私模式禁用 localStorage 时只切换当前会话。
    }
  }, [theme]);

  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="btn btn-ghost btn-circle"
      aria-label={next === "dark" ? "切换到深色主题" : "切换到浅色主题"}
      onClick={() => setTheme(next)}
    >
      {theme === "dark" ? (
        <Sun
          aria-hidden="true"
          className="size-5 transition-transform duration-300 hover:rotate-45"
        />
      ) : (
        <Moon
          aria-hidden="true"
          className="size-5 transition-transform duration-300 hover:-rotate-12"
        />
      )}
    </button>
  );
}
