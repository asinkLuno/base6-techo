import { createHashRouter } from "react-router";
import RootLayout from "./layouts/RootLayout";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";

// Tauri 自定义协议下 BrowserRouter 刷新子路径会 404，桌面应用统一用 hash 路由。
// 首页与 404 保持 eager（首屏与兜底），功能页走路由级代码分割，后续接入 PDF 等重组件时同样受益。
export const router = createHashRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: HomePage },
      {
        path: "settings",
        lazy: async () => ({ Component: (await import("./pages/SettingsPage")).default }),
      },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);
