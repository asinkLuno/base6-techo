//! 横线本模板：用户参数 → TikZ LaTeX 源码。
//!
//! 版面设计（v1 固定常量，后续按需参数化）：
//! - 页边距：左右 18mm，上 16mm，下 16mm（geometry includehead/includefoot）
//! - 页眉（居中）：填空式「＿年＿月」
//! - 页脚：页码，位置可 选 靠外 / 靠内 / 居中（twoside 书籍惯例）
//! - 正文区：eso-pic + TikZ overlay，从正文区底边按间距画横线

use serde::{Deserialize, Serialize};

/// 纸张尺寸：常用预设或自定义（毫米）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum PaperSize {
    A4,
    A5,
    B5,
    A6,
    B6,
    Letter,
    Custom { width_mm: f64, height_mm: f64 },
}

impl PaperSize {
    /// 预设解析为 (宽, 高) mm。
    pub fn dims_mm(&self) -> (f64, f64) {
        match self {
            PaperSize::A4 => (210.0, 297.0),
            PaperSize::A5 => (148.0, 210.0),
            PaperSize::B5 => (176.0, 250.0),
            PaperSize::A6 => (105.0, 148.0),
            PaperSize::B6 => (128.0, 182.0),
            PaperSize::Letter => (215.9, 279.4),
            PaperSize::Custom { width_mm, height_mm } => (*width_mm, *height_mm),
        }
    }
}

/// 页码位置。靠外/靠内按书籍装订惯例随奇偶页镜像（twoside）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PageNumberPos {
    Outer,
    Inner,
    Center,
}

/// 横线本文档参数。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinedDocParams {
    pub paper: PaperSize,
    /// 横线间距（毫米）。
    pub line_spacing_mm: f64,
    pub page_number_pos: PageNumberPos,
    /// 页数，缺省 1。
    #[serde(default = "default_pages")]
    pub pages: u32,
}

fn default_pages() -> u32 {
    1
}

// ---- 版面常量（生成 LaTeX 与校验共用同一处定义）----

const MARGIN_X_MM: f64 = 18.0;
const MARGIN_TOP_MM: f64 = 16.0;
const MARGIN_BOTTOM_MM: f64 = 16.0;
const MIN_PAPER_MM: f64 = 30.0;
const MAX_PAPER_MM: f64 = 1000.0;
const MAX_PAGES: u32 = 999;

/// 边界校验：数据在此处解析一次，模板内部不再防御非法值。
pub fn validate_params(p: &LinedDocParams) -> Result<(), String> {
    let (w, h) = p.paper.dims_mm();
    for (name, v) in [("纸宽", w), ("纸高", h)] {
        if !v.is_finite() || !(MIN_PAPER_MM..=MAX_PAPER_MM).contains(&v) {
            return Err(format!("{name} {v} 超出范围（{MIN_PAPER_MM}–{MAX_PAPER_MM} mm）"));
        }
    }
    if !p.line_spacing_mm.is_finite() || p.line_spacing_mm <= 0.0 {
        return Err(format!("横线间距必须为正数，收到 {}", p.line_spacing_mm));
    }
    // 纸张必须装得下固定页边距（左右 18mm、上下 16mm），否则正文区为负。
    let body_w = w - 2.0 * MARGIN_X_MM;
    let body_h = h - MARGIN_TOP_MM - MARGIN_BOTTOM_MM;
    if body_w <= 0.0 || body_h <= 0.0 {
        return Err(format!(
            "纸张太小：扣除页边距后正文区为 {body_w:.1}×{body_h:.1} mm，须为正"
        ));
    }
    if p.pages == 0 || p.pages > MAX_PAGES {
        return Err(format!("页数须在 1–{MAX_PAGES}，收到 {}", p.pages));
    }
    Ok(())
}

/// 浮点 mm → LaTeX 数字：去掉多余的小数零（210.0 → "210"，7.5 → "7.5"）。
fn fmt_mm(v: f64) -> String {
    let s = format!("{v:.2}");
    let s = s.trim_end_matches('0').trim_end_matches('.');
    s.to_string()
}

/// 页脚页码的 fancyhdr 配置。LE/RO = 偶左奇右（外侧），RE/LO = 偶右奇左（内侧）。
fn fancy_footer(pos: PageNumberPos) -> &'static str {
    match pos {
        PageNumberPos::Outer => r"\fancyfoot[LE,RO]{\thepage}",
        PageNumberPos::Inner => r"\fancyfoot[RE,LO]{\thepage}",
        PageNumberPos::Center => r"\fancyfoot[C]{\thepage}",
    }
}

/// 生成横线本 LaTeX 源码。
///
/// 几何常量在 Rust 一处定义，同时生成 `\geometry` 选项与 TikZ 画线坐标；
/// 画线用 eso-pic（原点 = 纸张左下角）+ 绝对 mm 坐标，不依赖 remember
/// picture 的两遍编译，也不依赖 extra 宏包。
pub fn generate_lined_latex(p: &LinedDocParams) -> Result<String, String> {
    validate_params(p)?;
    let (w, h) = p.paper.dims_mm();

    // 正文区：宽 = 纸宽 - 左右边距；高 = 纸高 - 上下边距（geometry
    // includehead/includefoot 语义下 \textheight 与此一致）。
    let body_w_mm = w - 2.0 * MARGIN_X_MM;
    let body_h_mm = h - MARGIN_TOP_MM - MARGIN_BOTTOM_MM;
    // 行数 = floor(正文高 / 间距)，+0.001 抵消浮点误差；
    // 行从正文区底边（i=0）向上画，剩余空隙留在顶部。
    let line_count = (body_h_mm / p.line_spacing_mm + 0.001).floor() as i64;

    let tex = format!(
        r#"% 由 base6-techo 自动生成：横线本模板
\documentclass[11pt]{{article}}
\usepackage[fontset=fandol]{{ctex}}
\usepackage{{geometry}}
\usepackage{{fancyhdr}}
\usepackage{{eso-pic}}
\usepackage{{tikz}}

\geometry{{
  paperwidth={w}mm, paperheight={h}mm, twoside,
  includehead, includefoot,
  left={mx}mm, right={mx}mm, top={mt}mm, bottom={mb}mm,
  headheight=16pt, headsep=6mm, footskip=9mm
}}

\definecolor{{ruleline}}{{gray}}{{0.62}}
\newcommand{{\lspMm}}{{{spacing}}}          % 横线间距（mm）
\newcommand{{\ruledLines}}{{{line_count}}}  % 每页横线数（正文高 / 间距 向下取整）

\pagestyle{{fancy}}
\fancyhf{{}}
\renewcommand{{\headrulewidth}}{{0pt}}
\fancyhead[C]{{\rule[0.55ex]{{2.6em}}{{0.35pt}}\hspace{{0.35em}}年\hspace{{0.35em}}\rule[0.55ex]{{2.6em}}{{0.35pt}}月}}
{footer}

% 每页背景：eso-pic 原点在纸张左下角，坐标均为毫米。
% 正文区 x ∈ [左边距, 纸宽-右边距]，y 从下边距起向上按 \lspMm 画横线。
\AddToShipoutPictureBG{{%
  \begin{{tikzpicture}}[x=1mm, y=1mm, overlay]
    \foreach \i in {{0,...,\ruledLines}}{{%
      \draw[ruleline, line width=0.4pt]
        ({lx}, {ly} + \i*\lspMm) -- ({rx}, {ly} + \i*\lspMm);%
    }}%
  \end{{tikzpicture}}%
}}

\begin{{document}}
\newcount\techoRemaining \techoRemaining={pages}
\loop
  \null\clearpage
  \advance\techoRemaining-1
\ifnum\techoRemaining>0\repeat
\end{{document}}
"#,
        w = fmt_mm(w),
        h = fmt_mm(h),
        mx = fmt_mm(MARGIN_X_MM),
        mt = fmt_mm(MARGIN_TOP_MM),
        mb = fmt_mm(MARGIN_BOTTOM_MM),
        spacing = fmt_mm(p.line_spacing_mm),
        line_count = line_count,
        lx = fmt_mm(MARGIN_X_MM),
        rx = fmt_mm(MARGIN_X_MM + body_w_mm),
        ly = fmt_mm(MARGIN_BOTTOM_MM),
        footer = fancy_footer(p.page_number_pos),
        pages = p.pages,
    );
    Ok(tex)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn params(paper: PaperSize, spacing: f64, pos: PageNumberPos) -> LinedDocParams {
        LinedDocParams {
            paper,
            line_spacing_mm: spacing,
            page_number_pos: pos,
            pages: 3,
        }
    }

    #[test]
    fn a4_geometry_and_cjk_header_present() {
        let tex = generate_lined_latex(&params(PaperSize::A4, 7.0, PageNumberPos::Outer)).unwrap();
        assert!(tex.contains("paperwidth=210mm"), "{tex}");
        assert!(tex.contains("paperheight=297mm"), "{tex}");
        assert!(tex.contains("年"), "{tex}");
        assert!(tex.contains("月"), "{tex}");
        assert!(tex.contains("tikzpicture"), "{tex}");
        assert!(tex.contains("foreach"), "{tex}");
    }

    #[test]
    fn page_number_pos_maps_to_fancyfoot() {
        let outer = generate_lined_latex(&params(PaperSize::A5, 8.0, PageNumberPos::Outer)).unwrap();
        assert!(outer.contains(r"\fancyfoot[LE,RO]{\thepage}"), "{outer}");
        let inner = generate_lined_latex(&params(PaperSize::A5, 8.0, PageNumberPos::Inner)).unwrap();
        assert!(inner.contains(r"\fancyfoot[RE,LO]{\thepage}"), "{inner}");
        let center = generate_lined_latex(&params(PaperSize::A5, 8.0, PageNumberPos::Center)).unwrap();
        assert!(center.contains(r"\fancyfoot[C]{\thepage}"), "{center}");
    }

    #[test]
    fn custom_paper_uses_given_dims() {
        let p = params(
            PaperSize::Custom { width_mm: 210.5, height_mm: 330.0 },
            6.5,
            PageNumberPos::Center,
        );
        let tex = generate_lined_latex(&p).unwrap();
        assert!(tex.contains("paperwidth=210.5mm"), "{tex}");
        assert!(tex.contains("paperheight=330mm"), "{tex}");
    }

    #[test]
    fn spacing_and_line_count_match_geometry() {
        // A4 正文区高 = 297 - 16 - 16 = 265mm；间距 7mm → floor(265/7)=37 → 画 0..37
        // 画线 x ∈ [18, 210-18]，y 从下边距 16mm 起。
        let tex = generate_lined_latex(&params(PaperSize::A4, 7.0, PageNumberPos::Outer)).unwrap();
        assert!(tex.contains(r"\newcommand{\lspMm}{7}"), "{tex}");
        assert!(tex.contains(r"\newcommand{\ruledLines}{37}"), "{tex}");
        assert!(tex.contains(r"(18, 16 + \i*\lspMm)"), "{tex}");
        assert!(tex.contains(r"(192, 16 + \i*\lspMm)"), "{tex}");
    }

    #[test]
    fn pages_emitted_into_shipout_loop() {
        let tex = generate_lined_latex(&params(PaperSize::A4, 7.0, PageNumberPos::Outer)).unwrap();
        assert!(tex.contains(r"\techoRemaining=3"), "{tex}");
    }

    #[test]
    fn serde_accepts_json_without_pages() {
        let json = r#"{
            "paper": {"kind": "b5"},
            "lineSpacingMm": 7.5,
            "pageNumberPos": "center"
        }"#;
        let p: LinedDocParams = serde_json::from_str(json).unwrap();
        assert_eq!(p.pages, 1);
        assert_eq!(p.paper, PaperSize::B5);
        assert_eq!(p.page_number_pos, PageNumberPos::Center);
    }

    #[test]
    fn rejects_invalid_params() {
        assert!(generate_lined_latex(&params(PaperSize::A4, 0.0, PageNumberPos::Outer)).is_err());
        assert!(generate_lined_latex(&params(PaperSize::A4, -3.0, PageNumberPos::Outer)).is_err());
        assert!(generate_lined_latex(&params(PaperSize::A4, f64::NAN, PageNumberPos::Outer)).is_err());
        assert!(generate_lined_latex(&params(PaperSize::A4, f64::INFINITY, PageNumberPos::Outer)).is_err());
        assert!(generate_lined_latex(&params(
            PaperSize::Custom { width_mm: 2000.0, height_mm: 297.0 },
            7.0,
            PageNumberPos::Outer,
        )).is_err());
        // 纸太小装不下页边距 → 正文区为负
        assert!(generate_lined_latex(&params(
            PaperSize::Custom { width_mm: 40.0, height_mm: 30.0 },
            7.0,
            PageNumberPos::Outer,
        )).is_err());
        let mut zero_pages = params(PaperSize::A4, 7.0, PageNumberPos::Outer);
        zero_pages.pages = 0;
        assert!(generate_lined_latex(&zero_pages).is_err());
    }
}
