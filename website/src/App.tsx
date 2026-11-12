import { Code2 } from "lucide-react";
import { Brand } from "./components/Brand";
import { Downloads } from "./components/Downloads";
import { Faq } from "./components/Faq";
import { Features } from "./components/Features";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { Templates } from "./components/Templates";
import { ThemeToggle } from "./components/ThemeToggle";
import { REPOSITORY } from "./lib/site";

const NAV = [
  { href: "#features", label: "功能" },
  { href: "#templates", label: "模板" },
  { href: "#download", label: "下载" },
  { href: "#faq", label: "常见问题" },
];

export default function App() {
  return (
    <div className="bg-base-100 text-base-content min-h-screen">
      <a
        href="#main"
        className="btn btn-primary btn-sm sr-only z-50 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        跳到主要内容
      </a>

      <header className="border-base-300 bg-base-100/85 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 sm:px-8">
          <div className="navbar-start w-auto flex-1">
            <Brand />
          </div>
          <nav
            aria-label="主导航"
            className="hidden items-center gap-1 md:flex"
          >
            {NAV.map((item) => (
              <a
                key={item.href}
                className="btn btn-ghost btn-sm"
                href={item.href}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <a
              className="btn btn-ghost btn-circle hidden sm:inline-flex"
              href={REPOSITORY}
              aria-label="打开 GitHub 仓库"
            >
              <Code2 aria-hidden="true" className="size-5" />
            </a>
            <a
              className="btn btn-outline btn-sm hidden md:inline-flex"
              href={REPOSITORY}
            >
              GitHub
            </a>
            <a className="btn btn-primary btn-sm md:hidden" href="#download">
              下载
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main">
        <Hero />
        <Features />
        <Templates />
        <Downloads />
        <Faq />
      </main>

      <Footer />
    </div>
  );
}
