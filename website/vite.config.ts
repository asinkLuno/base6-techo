import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // 发布页部署在 GitHub Pages 的项目路径下，相对资源路径也能兼容后续自定义域名。
  base: command === "build" ? "./" : "/",
  plugins: [react(), tailwindcss()],
  build: { target: "es2022" },
}));
