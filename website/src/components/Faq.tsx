import { m } from "motion/react";
import { reveal } from "../lib/motion";

const FAQ = [
  {
    question: "需要联网吗？",
    answer:
      "正常使用不需要。安装包内含 LaTeX 宏包离线缓存，首次启动会解压到应用私有目录。只有遇到缓存未覆盖的宏包时才会联网补齐；书稿内容始终留在本机。",
  },
  {
    question: "PDF 应该怎么打印？",
    answer:
      "按原尺寸、每张纸 1 个 PDF 页面、双面打印。骑马订用短边翻转；自定义纵向输出用长边翻转。不要启用打印驱动自带的小册子或配页功能——拼版已经在应用内完成，并保留空白面。",
  },
  {
    question: "Android 版能生成 PDF 吗？",
    answer:
      "能。Android 版内置同一套 Tectonic 引擎，只提供 arm64-v8a（64 位）安装包，需要 Android 7.0（API 24）及以上。生成与保存都通过系统文件选择器完成。",
  },
  {
    question: "为什么不提供网页版生成？",
    answer:
      "浏览器里可以看界面，但生成需要本地 LaTeX 引擎。纯网页形态没有引擎，点击生成会提示使用桌面或 Android 应用。",
  },
  {
    question: "macOS 提示无法验证开发者怎么办？",
    answer:
      "在 Finder 中右键应用 → 打开；或在“系统设置 → 隐私与安全性”中允许。构建若未做 Apple 签名与公证，系统会给出这类提示，这不代表文件损坏。",
  },
  {
    question: "安装包怎么校验？",
    answer:
      "每个安装包旁都有同名 .sha256 文件。Linux / macOS 运行 sha256sum -c 文件名.sha256；Windows 运行 Get-FileHash 文件名 -Algorithm SHA256，对比下载页显示的摘要。",
  },
  {
    question: "配置能分享给朋友吗？",
    answer:
      "能。主界面右栏支持导入 / 导出 base6-techo/config JSON，整本版式、页心参数与装订方式都会一起带走。仓库 examples/ 里有可直接导入的整本手帐案例。",
  },
];

export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="border-base-300 bg-base-200/60 border-t"
    >
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-10 sm:py-24">
        <m.div className="max-w-xl space-y-3" {...reveal}>
          <p className="text-primary text-sm font-medium tracking-wide">
            常见问题
          </p>
          <h2
            id="faq-title"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            打印之前，先看这几条。
          </h2>
          <p className="text-base-content/65 leading-relaxed">
            这里的答案对应实际输出行为；如果还有疑问，欢迎在 GitHub 上开 issue。
          </p>
        </m.div>

        <m.div className="mt-8 space-y-3" {...reveal}>
          {FAQ.map((item) => (
            <details
              key={item.question}
              className="collapse-arrow border-base-300 bg-base-100 collapse border"
            >
              <summary className="collapse-title font-medium">
                {item.question}
              </summary>
              <div className="collapse-content text-base-content/65 text-sm leading-relaxed">
                <p>{item.answer}</p>
              </div>
            </details>
          ))}
        </m.div>
      </div>
    </section>
  );
}
