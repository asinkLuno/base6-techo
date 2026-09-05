import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// 展示页：静态输出到 showcase/dist，nginx 以 /showcase/ 服务该目录。
//   - base 指向 /showcase/（Astro 资源 URL 的前缀）
//   - 样张图片/JSON 以绝对路径 /examples/… 提供（nginx root 下、与 showcase/ 平级）
//   - 字体在 public/fonts/，输出到 dist/fonts/，经 /showcase/fonts/ 提供

// 仅 dev：把仓库根的 examples/ 映射到 /examples/（生产由 nginx 从 html root 提供）
const MIME = { ".png": "image/png", ".json": "application/json", ".pdf": "application/pdf" };
function serveExamples() {
  const root = resolve(import.meta.dirname, "../examples");
  return {
    name: "dev-examples",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/examples", (req, res, next) => {
        const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
        const file = normalize(join(root, rel));
        if (!file.startsWith(root + "/") || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  base: "/showcase/",
  integrations: [react()],
  outDir: "dist",
  vite: { plugins: [serveExamples()] },
});
