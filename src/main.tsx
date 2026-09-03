import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline, GlobalStyles } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import "dayjs/locale/zh-cn";
import App from "./App";
import { theme } from "./theme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={{ "@keyframes spin": { to: { transform: "rotate(360deg)" } } }} />
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="zh-cn">
        <App />
      </LocalizationProvider>
    </ThemeProvider>
  </StrictMode>,
);
