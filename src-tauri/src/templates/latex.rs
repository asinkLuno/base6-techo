//! LaTeX 输出后端。数值格式与用户文字转义只在此处处理。
use super::{
    components::TextStyle,
    document::{PlannedDocument, PlannedPage},
    imposition::plan_output,
    layout::Rect,
};
use std::fmt::Write;

pub(crate) fn validate_color(color: &str) -> Result<(), String> {
    if color.len() != 7
        || !color.starts_with('#')
        || !color[1..].bytes().all(|b| b.is_ascii_hexdigit())
    {
        return Err(format!("颜色必须为 #RRGGBB，收到 {color}"));
    }
    Ok(())
}

fn number(v: f64) -> String {
    let s = format!("{v:.6}");
    s.trim_end_matches('0').trim_end_matches('.').to_string()
}

/// 普通文字不是 LaTeX 代码。逐字符转换，避免二次转义。
fn escape_text(text: &str) -> String {
    const ESCAPES: &[(char, &str)] = &[
        ('\\', r"\textbackslash{}"),
        ('{', r"\{"),
        ('}', r"\}"),
        ('%', r"\%"),
        ('$', r"\$"),
        ('&', r"\&"),
        ('#', r"\#"),
        ('_', r"\_"),
        ('^', r"\textasciicircum{}"),
        ('~', r"\textasciitilde{}"),
        ('\n', " "),
        ('\r', " "),
        ('\t', " "),
    ];
    let mut out = String::new();
    for c in text.chars() {
        if let Some((_, replacement)) = ESCAPES.iter().find(|(special, _)| *special == c) {
            out.push_str(replacement);
        } else {
            out.push(c);
        }
    }
    out
}

pub(crate) struct Canvas {
    source: String,
}

impl Canvas {
    fn new() -> Self {
        Self {
            source: String::new(),
        }
    }

    pub(crate) fn begin_region(&mut self, rect: Rect) {
        writeln!(
            self.source,
            "\\begin{{scope}}\n\\clip ({},{}) rectangle ({},{});",
            number(rect.x),
            number(rect.y),
            number(rect.x + rect.width),
            number(rect.y + rect.height)
        )
        .unwrap();
    }

    pub(crate) fn end_region(&mut self) {
        self.source.push_str("\\end{scope}\n");
    }

    pub(crate) fn line(&mut self, x1: f64, y1: f64, x2: f64, y2: f64, color: &str, width: f64) {
        writeln!(
            self.source,
            "\\definecolor{{ink}}{{HTML}}{{{}}}\n\\draw[ink,line width={}pt] ({},{}) -- ({},{});",
            &color[1..],
            number(width),
            number(x1),
            number(y1),
            number(x2),
            number(y2)
        )
        .unwrap();
    }

    pub(crate) fn text(
        &mut self,
        x: f64,
        y: f64,
        text: &str,
        style: &TextStyle,
        anchor: &str,
        rotation: i32,
    ) {
        self.node(x, y, &escape_text(text), style, anchor, rotation);
    }

    pub(crate) fn date(&mut self, x: f64, y: f64, style: &TextStyle, anchor: &str) {
        self.node(x, y, r"\rule[0.55ex]{2.6em}{0.35pt}\hspace{0.35em}年\hspace{0.35em}\rule[0.55ex]{2.6em}{0.35pt}月", style, anchor, 0);
    }

    fn node(
        &mut self,
        x: f64,
        y: f64,
        content: &str,
        style: &TextStyle,
        anchor: &str,
        rotation: i32,
    ) {
        writeln!(self.source, "\\definecolor{{ink}}{{HTML}}{{{}}}\n\\node[anchor={anchor},rotate={rotation},inner sep=0pt,text=ink,font=\\fontsize{{{}}}{{{}}}\\selectfont] at ({},{}) {{{content}}};",
            &style.color[1..], number(style.size_pt), number(style.size_pt * 1.2), number(x), number(y)).unwrap();
    }
}

pub(crate) fn render(plan: &PlannedDocument<'_>) -> String {
    let output = plan_output(plan);
    let mut tex = format!(
        r"% 由 base6-techo 自动生成：整本布局框架
\documentclass[11pt]{{article}}
\usepackage[fontset=fandol]{{ctex}}
\usepackage{{geometry}}
\usepackage{{eso-pic}}
\usepackage{{tikz}}
\geometry{{paperwidth={}mm,paperheight={}mm,margin=0pt}}
\pagestyle{{empty}}
\setlength{{\parindent}}{{0pt}}
\begin{{document}}
",
        number(output.width_mm),
        number(output.height_mm)
    );
    for output_page in output.pages() {
        let mut canvas = Canvas::new();
        for placement in &output_page.placements {
            if let Some(physical_page) = placement.physical_page {
                let page = &plan.pages()[physical_page - 1];
                render_page(&mut canvas, plan, page, placement.x_mm);
            }
        }
        tex.push_str("\\AddToShipoutPictureBG*{%\n\\AtPageUpperLeft{%\n\\begin{tikzpicture}[overlay,x=1mm,y=-1mm]\n");
        tex.push_str(&canvas.source);
        tex.push_str("\\end{tikzpicture}%\n}%\n}\n\\null\\clearpage\n");
    }
    tex.push_str("\\end{document}\n");
    tex
}

/// 页内坐标不变；仅把整张阅读页平移到印刷面的对应半边。
fn render_page(canvas: &mut Canvas, plan: &PlannedDocument<'_>, page: &PlannedPage<'_>, x_mm: f64) {
    writeln!(canvas.source, "\\begin{{scope}}[xshift={}mm]", number(x_mm)).unwrap();
    canvas.begin_region(page.layout.paper);
    writeln!(
        canvas.source,
        "% physical={} section={} local={} display={:?}",
        page.context.physical_page,
        page.context.section_index,
        page.context.local_index,
        page.context.display_number
    )
    .unwrap();
    canvas.begin_region(page.layout.body);
    page.section.body.draw(canvas, &page.layout, &page.context);
    canvas.end_region();
    plan.document.decorations.draw(canvas, page);
    canvas.end_region();
    canvas.end_region();
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn plain_text_escapes_every_tex_metacharacter_once() {
        assert_eq!(
            escape_text("\\{}%$&#_^~\n\r\t中"),
            r"\textbackslash{}\{\}\%\$\&\#\_\textasciicircum{}\textasciitilde{}   中"
        );
    }
    #[test]
    fn small_valid_spacing_survives_number_formatting() {
        assert_eq!(number(0.1), "0.1");
        assert_eq!(number(210.0), "210");
        assert_eq!(number(7.123456), "7.123456");
    }
}
