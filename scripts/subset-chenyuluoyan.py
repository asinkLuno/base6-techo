#!/usr/bin/env python3
"""重新生成展示页手写字体「辰宇落雁 Thin」的子集 woff2。

用法: python3 scripts/subset-chenyuluoyan.py <ChenYuluoyan-*.ttf>
     (venv 依赖: fonttools brotli opencc-python-reimplemented)

字符集来源（求并集）:
  - showcase/src/data/site.ts 的 HANDWRITING_SIMPLIFIED（经 opencc s2tw 转繁体，
    与运行时 vendor/opencc-cn2t.js 的 cn2t 同源）
  - showcase/src/components/Gallery.tsx 里的全部非 ASCII 字符（点阵 Daily Log、
    竖排注释等结构化文案）
  - 全套可打印 ASCII（拉丁、数字、标点也走辰宇落雁，不再回退楷体）

缺字会打印出来（浏览器将对这些字符回退楷体），并以警告码退出。
"""

import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "showcase/src/data/site.ts"
GALLERY = ROOT / "showcase/src/components/Gallery.tsx"
OUT = ROOT / "showcase/public/fonts/chenyuluoyan-thin.woff2"


def strip_comments(s: str) -> str:
    s = re.sub(r"/\*[\s\S]*?\*/", "", s)
    return "\n".join(re.sub(r"//.*$", "", ln) for ln in s.splitlines())


def main() -> int:
    if len(sys.argv) != 2:
        sys.exit(f"用法: {sys.argv[0]} <ChenYuluoyan-*.ttf>")
    ttf = pathlib.Path(sys.argv[1])

    from opencc import OpenCC
    from fontTools.ttLib import TTFont
    from fontTools.subset import Subsetter, Options

    site = strip_comments(SITE.read_text(encoding="utf-8"))
    gallery = strip_comments(GALLERY.read_text(encoding="utf-8"))

    poem_src = "".join(
        re.findall(r'"([^"]*)"', re.search(r"HANDWRITING_SIMPLIFIED = \[(.*?)\]", site, re.S).group(1))
    )
    poem = OpenCC("s2tw").convert(poem_src)

    # 横线样张《荷塘月色》选段：原文本就繁体，直接计入（不做 s2tw，保留 靑 淸 等异体原貌）
    lotus = re.search(r"HANDWRITING_LOTUS = \[(.*?)\];", site, re.S)
    lotus_text = "".join(re.findall(r'"([^"]*)"', lotus.group(1))) if lotus else ""

    # 手写覆盖层真正渲染的文案（如点阵 Daily Log 的 rows；没有则为空）。
    # 页眉/界面文字用界面字体渲染，不进子集。
    rows_m = re.search(r"const rows: Row\[\] = \[(.*?)\n  \];", gallery)
    rows = rows_m.group(1) if rows_m else ""
    structured = {ch for ch in rows if ord(ch) > 0x7F}
    structured |= {ch for ch in lotus_text if not ch.isspace()}
    ascii_set = {chr(c) for c in range(0x20, 0x7F)}
    charset = set(poem) | structured | ascii_set
    charset = {ch for ch in charset if not ch.isspace() or ch == " "}
    charset.add(" ")

    font = TTFont(ttf)
    cmap = font.getBestCmap()
    missing = sorted(ch for ch in charset if ord(ch) not in cmap)
    if missing:
        print(f"字体缺 {len(missing)} 字（将回退楷体）: {''.join(missing)}")
    charset -= set(missing)

    opts = Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.hinting = False
    opts.desubroutinize = True
    subsetter = Subsetter(options=opts)
    subsetter.populate(text="".join(charset))
    subsetter.subset(font)
    font.save(OUT)

    size = OUT.stat().st_size
    print(f"子集 {len(charset)} 字 → {OUT.relative_to(ROOT)} ({size / 1024:.0f} KB)")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
