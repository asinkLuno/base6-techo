import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// 展示页：静态输出到 showcase/dist，nginx 以 /showcase/ 服务该目录。
//   - base 指向 /showcase/（Astro 资源 URL 的前缀）
//   - 样张图片/JSON 以绝对路径 /examples/… 提供（nginx root 下、与 showcase/ 平级）
//   - 字体在 public/fonts/，输出到 dist/fonts/，经 /showcase/fonts/ 提供
export default defineConfig({
  base: "/showcase/",
  integrations: [react()],
  outDir: "dist",
});
