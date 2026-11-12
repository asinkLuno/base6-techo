import {
  EXAMPLES_URL,
  ISSUES_URL,
  RELEASE_NOTES_URL,
  RELEASES_URL,
  REPOSITORY,
} from "../lib/site";
import { BrandMark } from "./Brand";

export function Footer() {
  return (
    <footer className="border-base-300 bg-base-100 border-t">
      <div className="footer text-base-content/55 sm:footer-horizontal mx-auto max-w-6xl gap-8 px-6 py-10 text-sm sm:px-10">
        <aside className="max-w-xs space-y-3">
          <div className="text-base-content flex items-center gap-2 text-base font-semibold">
            <BrandMark className="text-primary size-6" />
            base6-techo
          </div>
          <p className="leading-relaxed">
            离线手帐 PDF 生成器。毫米级排版、按帖拼版，全部在本地完成。
          </p>
          <p className="text-base-content/35 text-xs">
            内嵌 Tectonic · React · Tauri
          </p>
        </aside>
        <nav aria-label="页脚导航" className="grid gap-2">
          <a className="link link-hover" href={REPOSITORY}>
            GitHub 仓库
          </a>
          <a className="link link-hover" href={RELEASES_URL}>
            所有版本
          </a>
          <a className="link link-hover" href={EXAMPLES_URL}>
            示例配置
          </a>
        </nav>
        <nav aria-label="支持" className="grid gap-2">
          <a className="link link-hover" href={ISSUES_URL}>
            反馈问题
          </a>
          <a className="link link-hover" href={RELEASE_NOTES_URL}>
            更新说明
          </a>
          <a className="link link-hover" href="#faq">
            常见问题
          </a>
        </nav>
      </div>
    </footer>
  );
}
