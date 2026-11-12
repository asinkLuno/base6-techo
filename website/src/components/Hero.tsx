import { ArrowDownToLine, ArrowRight, Sparkles } from "lucide-react";
import { m } from "motion/react";
import { reveal } from "../lib/motion";
import { BASE_URL } from "../lib/site";

const preview = (name: string) => `${BASE_URL}previews/${name}`;

export function Hero() {
  return (
    <section
      aria-labelledby="intro-title"
      className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-10 pb-16 sm:px-10 md:grid-cols-2 md:gap-10 md:pt-16 md:pb-24"
    >
      <m.div className="space-y-7" {...reveal}>
        <span className="badge badge-outline border-primary/30 bg-primary/5 text-primary gap-1.5">
          <Sparkles aria-hidden="true" className="size-3.5" />
          本地生成 · 无需联网
        </span>
        <h1
          id="intro-title"
          className="text-4xl leading-[1.15] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
        >
          把手帐内页，
          <br />
          排成印刷级 PDF。
        </h1>
        <p className="text-base-content/70 max-w-md text-lg leading-relaxed">
          base6-techo 把 LaTeX 排版引擎装进桌面与 Android
          应用。选纸张、配页心、定装订，剩下的交给毫米级坐标——不写一行代码，也不上传任何数据。
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="#download" className="btn btn-primary gap-2 px-6">
            <ArrowDownToLine aria-hidden="true" className="size-4" />
            下载 base6-techo
          </a>
          <a href="#features" className="btn btn-ghost gap-2">
            看看能排什么
            <ArrowRight aria-hidden="true" className="size-4" />
          </a>
        </div>
        <p className="text-base-content/50 text-sm">
          Linux · Windows · macOS · Android
          <span className="mx-2 opacity-40">/</span>
          安装包均附 SHA-256 校验
        </p>
      </m.div>

      <m.div
        className="relative mx-auto h-[420px] w-full max-w-md sm:h-[520px] lg:max-w-lg"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
      >
        <figure className="bg-base-100 ring-base-300 absolute top-16 left-0 w-32 -rotate-6 overflow-hidden rounded-lg shadow-xl ring-1 transition-transform duration-500 hover:-translate-y-1 hover:rotate-0 sm:w-40">
          <img
            src={preview("weekly.webp")}
            alt="八分周视图页面，按星期与日期排成两页一周"
            width={800}
            height={1131}
            className="h-auto w-full"
            loading="lazy"
          />
        </figure>

        <figure className="bg-base-100 ring-base-300 absolute top-0 right-0 w-48 rotate-6 overflow-hidden rounded-lg shadow-xl ring-1 transition-transform duration-500 hover:-translate-y-1 hover:rotate-0 sm:w-60">
          <img
            src={preview("monthly.webp")}
            alt="月历页面，网格中标注日期与当月月相"
            width={1200}
            height={846}
            className="h-auto w-full"
            loading="lazy"
          />
        </figure>

        <figure className="bg-base-100 ring-base-300 absolute top-12 left-1/2 z-10 w-44 -translate-x-1/2 rotate-[-2deg] overflow-hidden rounded-lg shadow-2xl ring-1 transition-transform duration-500 hover:-translate-y-1.5 hover:rotate-0 sm:w-56">
          <span className="badge badge-primary badge-sm absolute top-3 left-3 z-10">
            A5 · 一日时间轴
          </span>
          <img
            src={preview("daily.webp")}
            alt="一日时间轴页面：左侧按小时分段，点阵背景铺满整页"
            width={720}
            height={972}
            className="h-auto w-full"
            fetchPriority="high"
          />
        </figure>

        <figcaption className="text-base-content/45 absolute bottom-0 left-1/2 w-full -translate-x-1/2 text-center text-xs">
          实际输出页面 · 由内嵌 Tectonic 引擎生成
        </figcaption>
      </m.div>
    </section>
  );
}
