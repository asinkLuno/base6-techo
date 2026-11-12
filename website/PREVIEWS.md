# 页面预览图

这些 WebP 是 `build/` 下真实编译样例的截图，用于发布页展示，不是示意图：

| 文件           | 来源                                           |
| -------------- | ---------------------------------------------- |
| `daily.webp`   | `build/after-8.png`（裁掉顶部调试页眉）        |
| `weekly.webp`  | `build/octan-week-sample.pdf` 第 1 页          |
| `monthly.webp` | `build/month-sample.pdf` 第 1 页（顺时针转正） |
| `tracker.webp` | `build/tracker-sample.pdf` 第 1 页             |
| `lined.webp`   | `build/lined-sample.pdf` 第 1 页               |

`build/` 不进版本库，因此这里只提交压缩后的展示图。重新生成时使用 `pdftoppm -r 200 -png` 渲染，再用 ImageMagick 转成 WebP。
