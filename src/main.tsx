import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline, GlobalStyles } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useTranslation } from "react-i18next";
import "dayjs/locale/zh-cn";
import "./i18n";
import App from "./App";
import { theme } from "./theme";

// 日期选择器 locale 跟随界面语言；useTranslation 订阅 languageChanged 触发重渲染。
function AppProviders({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={i18n.language.startsWith("zh") ? "zh-cn" : "en"}>
      {children}
    </LocalizationProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={{ "@keyframes spin": { to: { transform: "rotate(360deg)" } } }} />
      <AppProviders>
        <App />
      </AppProviders>
    </ThemeProvider>
  </StrictMode>,
);
