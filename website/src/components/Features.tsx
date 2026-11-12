import {
  BookOpen,
  Eye,
  Grid3X3,
  type LucideIcon,
  Ruler,
  Share2,
  WifiOff,
} from "lucide-react";
import { m } from "motion/react";
import { reveal } from "../lib/motion";

type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const FEATURES: Feature[] = [
  {
    icon: Grid3X3,
    title: "八种页心，覆盖一本手帐",
    body: "空白、横线、点阵、方格、方眼罫、八分周视图、月历、月打卡。线距、线色、点半径与中心点都能逐项调整。",
  },
  {
    icon: Ruler,
    title: "毫米级纸张与留白",
    body: "A4 / A5 / B5 / A6 / B6 / Letter，或自定义 30–1000 mm。页头、页脚、装订侧、外侧分别设置，也能按节覆盖。",
  },
  {
    icon: BookOpen,
    title: "装订-ready 的拼版",
    body: "单页、骑马订、锁线分帖。自动补白到 4 的倍数、按帖配页，双面打印后直接叠放装订。",
  },
  {
    icon: WifiOff,
    title: "完全离线",
    body: "Tectonic 编译进应用本体，宏包缓存随安装包分发。无服务端、无账户，书稿始终留在本机。",
  },
  {
    icon: Eye,
    title: "生成后立刻确认",
    body: "内嵌 pdf.js 预览输出，页序、留白、镜像页码都能在保存前逐页核对。",
  },
  {
    icon: Share2,
    title: "配置可以带走",
    body: "整本配置支持导入 / 导出，同一套版式复用到下一本；界面提供简体中文与 English，页头页脚跟随语言。",
  },
];

export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-24"
    >
      <m.div className="max-w-xl space-y-3" {...reveal}>
        <p className="text-primary text-sm font-medium tracking-wide">
          为什么是 base6-techo
        </p>
        <h2
          id="features-title"
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          不用学排版软件，也能精确到毫米。
        </h2>
        <p className="text-base-content/65 leading-relaxed">
          把手帐最费时间的部分收进几个输入框：纸张、边距、页心、装订。所有参数最终都落到同一套
          LaTeX/TikZ 坐标里，所见即印面。
        </p>
      </m.div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }, index) => (
          <m.article
            key={title}
            className="card border-base-300 bg-base-100 border transition-shadow duration-300 hover:shadow-lg"
            {...reveal}
            transition={{ ...reveal.transition, delay: index * 0.04 }}
          >
            <div className="card-body gap-3">
              <span className="rounded-box bg-primary/10 text-primary flex size-10 items-center justify-center">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <h3 className="card-title text-base">{title}</h3>
              <p className="text-base-content/65 text-sm leading-relaxed">
                {body}
              </p>
            </div>
          </m.article>
        ))}
      </div>

      <m.div
        className="stats stats-vertical border-base-300 bg-base-100 sm:stats-horizontal mt-12 w-full border shadow-sm"
        {...reveal}
      >
        <div className="stat">
          <div className="stat-title">页心模板</div>
          <div className="stat-value text-3xl">8</div>
          <div className="stat-desc">空白到月打卡</div>
        </div>
        <div className="stat">
          <div className="stat-title">全书页数</div>
          <div className="stat-value text-3xl">1–999</div>
          <div className="stat-desc">超出时给出溢出提示</div>
        </div>
        <div className="stat">
          <div className="stat-title">自定义纸张</div>
          <div className="stat-value text-3xl">30–1000</div>
          <div className="stat-desc">毫米，宽高独立</div>
        </div>
        <div className="stat">
          <div className="stat-title">服务端</div>
          <div className="stat-value text-primary text-3xl">0</div>
          <div className="stat-desc">无账户、无上传</div>
        </div>
      </m.div>
    </section>
  );
}
