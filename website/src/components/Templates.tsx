import {
  CalendarDays,
  Clock3,
  Grid3X3,
  List,
  MoonStar,
  Square,
} from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";
import { reveal } from "../lib/motion";
import { BASE_URL } from "../lib/site";

const PREVIEWS = [
  {
    id: "daily",
    label: "一日时间轴",
    icon: Clock3,
    image: "daily.webp",
    width: 720,
    height: 972,
    ratio: "aspect-[210/297]",
    note: "按小时分段的一日页。点阵底纹铺满整页，时间刻度从页眉一路排到页脚。",
  },
  {
    id: "weekly",
    label: "八分周视图",
    icon: CalendarDays,
    image: "weekly.webp",
    width: 800,
    height: 1131,
    ratio: "aspect-[210/297]",
    note: "每页四格、每周两页。周与月的归属固定，跨月周不会重复出现。",
  },
  {
    id: "monthly",
    label: "月历",
    icon: Grid3X3,
    image: "monthly.webp",
    width: 1200,
    height: 846,
    ratio: "aspect-[297/210]",
    note: "横向月历整页旋转 90° 排入 PDF，每天留出书写格；可叠加月相标记。",
  },
  {
    id: "tracker",
    label: "月打卡",
    icon: MoonStar,
    image: "tracker.webp",
    width: 800,
    height: 1131,
    ratio: "aspect-[210/297]",
    note: "月历与打卡格同页，虚线分隔日期与记录区，适合习惯追踪。",
  },
  {
    id: "lined",
    label: "横线",
    icon: List,
    image: "lined.webp",
    width: 800,
    height: 1131,
    ratio: "aspect-[210/297]",
    note: "行距、线色、线宽都能调；可选一条贯穿整页的左侧竖线，做美式横线本。",
  },
];

const OTHER_TEMPLATES = ["空白页", "点阵", "方格", "方眼罫"];

export function Templates() {
  const [activeId, setActiveId] = useState(PREVIEWS[0].id);
  const active =
    PREVIEWS.find((preview) => preview.id === activeId) ?? PREVIEWS[0];
  const ActiveIcon = active.icon;

  return (
    <section
      id="templates"
      aria-labelledby="templates-title"
      className="border-base-300 bg-base-200/60 border-y"
    >
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-24">
        <m.div className="max-w-xl space-y-3" {...reveal}>
          <p className="text-primary text-sm font-medium tracking-wide">
            页心模板
          </p>
          <h2
            id="templates-title"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            一页纸，先选页心。
          </h2>
          <p className="text-base-content/65 leading-relaxed">
            模板决定格线从页心向四周扩展的方式，也决定装订侧留白。下面展示的是引擎实际生成的页面，不是示意图。
          </p>
        </m.div>

        <m.div
          className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start"
          {...reveal}
        >
          <div className="space-y-5">
            <div
              className="tabs tabs-box bg-base-100 w-full flex-wrap p-1"
              role="tablist"
              aria-label="页心模板预览"
            >
              {PREVIEWS.map((preview) => {
                const Icon = preview.icon;
                const selected = preview.id === active.id;
                return (
                  <button
                    key={preview.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls="template-panel"
                    className={`tab flex-1 gap-2 whitespace-nowrap ${selected ? "tab-active" : ""}`}
                    onClick={() => setActiveId(preview.id)}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    {preview.label}
                  </button>
                );
              })}
            </div>

            <div
              id="template-panel"
              role="tabpanel"
              aria-labelledby="templates-title"
              className="card border-base-300 bg-base-100 border"
            >
              <div className="card-body gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-box bg-primary/10 text-primary flex size-9 items-center justify-center">
                    <ActiveIcon aria-hidden="true" className="size-4" />
                  </span>
                  <h3 className="card-title text-lg">{active.label}</h3>
                </div>
                <p className="text-base-content/65 text-sm leading-relaxed">
                  {active.note}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {OTHER_TEMPLATES.map((name) => (
                    <span
                      key={name}
                      className="badge badge-outline badge-sm text-base-content/60"
                    >
                      {name}
                    </span>
                  ))}
                  <span className="badge badge-outline badge-sm text-base-content/40">
                    以及更多
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-box border-base-300 bg-base-100 text-base-content/65 flex items-start gap-3 border p-4 text-sm leading-relaxed">
              <Square
                aria-hidden="true"
                className="text-primary mt-0.5 size-4 shrink-0"
              />
              <p>
                所有模板共用同一套纸张、边距与拼版规则。换模板不会改变页序；换纸张会按谐和规则重新推导默认边距，仍可逐项覆盖。
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="rounded-box border-base-300 bg-base-100 w-full max-w-sm border p-4 shadow-sm">
              <m.figure
                key={active.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className={`${active.ratio} w-full overflow-hidden rounded-md bg-white shadow-md ring-1 ring-black/5`}
              >
                <img
                  src={`${BASE_URL}previews/${active.image}`}
                  alt={`${active.label}页面实际输出预览`}
                  width={active.width}
                  height={active.height}
                  className="size-full object-contain"
                  loading="lazy"
                />
              </m.figure>
              <p className="text-base-content/45 mt-3 text-center text-xs">
                实际输出 · A5 · 单页阅读顺序
              </p>
            </div>
          </div>
        </m.div>
      </div>
    </section>
  );
}
