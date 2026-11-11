//! LaTeX 输出后端。数值格式与用户文字转义只在此处处理。
use super::{
    components::TextStyle,
    document::{PlannedDocument, PlannedPage},
    imposition::plan_output,
    layout::Rect,
};
use std::{collections::HashSet, fmt::Write};

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
    // -0.0 与 0.0 相等，这里统一成 0，避免输出 "-0"。
    let v = if v == 0.0 { 0.0 } else { v };
    let s = format!("{v:.6}");
    s.trim_end_matches('0').trim_end_matches('.').to_string()
}

/// pattern 名只允许字母/数字/下划线；负数与小数点转成 m/p。
fn name_part(v: f64) -> String {
    number(v).replace('-', "m").replace('.', "p")
}

/// 图案声明用的原始坐标：不受 TikZ 的 x/y 向量影响（pattern 坐标在页面空间）。
fn qpoint(x: f64, y: f64) -> String {
    format!("\\pgfqpoint{{{}mm}}{{{}mm}}", number(x), number(y))
}

/// 路径坐标：应用 TikZ 的 x=1mm / y=-1mm 向量，与页面局部坐标一致。
fn xy_point(x: f64, y: f64) -> String {
    format!("\\pgfpointxy{{{}}}{{{}}}", number(x), number(y))
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

pub(crate) struct Canvas<'a> {
    source: String,
    /// 当前阅读页所在印刷面的纸高与水平偏移（mm）。点阵 pattern 的坐标固定在
    /// 页面空间（Matrix 恒为 identity），需要据此把页面局部坐标换算成页面坐标。
    sheet_height_mm: f64,
    sheet_x_mm: f64,
    /// 文档级已声明的 pattern；同名再声明会被 PGF 判为重复定义错误。
    declared_patterns: &'a mut HashSet<String>,
}

impl<'a> Canvas<'a> {
    /// 把颜色注册为当前图形环境的 `ink`（HTML 写法不带 `#`）。
    fn define_ink(&mut self, color: &str) {
        writeln!(
            self.source,
            "\\definecolor{{ink}}{{HTML}}{{{}}}",
            &color[1..]
        )
        .unwrap();
    }

    fn new(declared_patterns: &'a mut HashSet<String>) -> Self {
        Self {
            source: String::new(),
            sheet_height_mm: 0.0,
            sheet_x_mm: 0.0,
            declared_patterns,
        }
    }

    /// pattern 声明在整本文档内只输出一次，后续页面直接复用。
    fn declare_pattern(&mut self, name: &str, declaration: &str) {
        if self.declared_patterns.insert(name.to_owned()) {
            self.source.push_str(declaration);
        }
    }

    /// 每个 placement 绘制前由编排层更新，供 pattern 定位使用。
    pub(crate) fn set_sheet_frame(&mut self, height_mm: f64, x_mm: f64) {
        self.sheet_height_mm = height_mm;
        self.sheet_x_mm = x_mm;
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

    /// 横线：用水平条纹 pattern 一次填充页心。
    /// 逐条 `\draw` 在 0.1mm 行距的长文档里会产生百万级命令，这里与点阵一样走 pattern。
    /// `first_y` 是模板居中序列中最靠上的一条线，相位由它推算，余量上下对称。
    pub(crate) fn line_grid(
        &mut self,
        rect: Rect,
        first_y: f64,
        spacing: f64,
        width_pt: f64,
        color: &str,
    ) {
        // TeX pt（1/72.27in）换算成毫米。
        let width = width_pt * 25.4 / 72.27;
        let offset_y = (self.sheet_height_mm - first_y).rem_euclid(spacing);
        let name = format!(
            "lines_{}_{}_{}",
            name_part(spacing),
            name_part(width_pt),
            name_part(offset_y),
        );
        // 横线沿 x 方向不变，tile 取 100mm 并在两侧各多 1mm，避免平铺接缝。
        let step_x = 100.0;
        let margin = 1.0;
        let step = qpoint(step_x, spacing);
        let origin = qpoint(-margin, -width / 2.0);
        let upper = qpoint(step_x + margin, spacing + width / 2.0);
        let band = format!(
            "\\pgfpathrectangle{{{}}}{{{}}}",
            qpoint(-margin, offset_y - width / 2.0),
            qpoint(step_x + 2.0 * margin, width)
        );
        self.define_ink(color);
        let declaration = format!(
            "\\pgfdeclarepatternformonly{{{name}}}{{{origin}}}{{{upper}}}{{{step}}}{{%\n  {band}%\n  \\pgfusepath{{fill}}%\n}}\n"
        );
        self.declare_pattern(&name, &declaration);
        let right = rect.x + rect.width;
        let bottom = rect.y + rect.height;
        self.pattern_fill_rect(&name, rect.x, rect.y, right, bottom);
    }

    /// 方格：一个 tile 内同时画横线与竖线，一次填充整个方格区域。
    /// 与横线、点阵同理，逐线输出在极小间距或数百页时会撑爆 TeX。
    pub(crate) fn cross_grid(&mut self, rect: Rect, spacing: f64, line_width_pt: f64, color: &str) {
        // TeX pt（1/72.27in）换算成毫米。
        let width = line_width_pt * 25.4 / 72.27;
        let half = width / 2.0;
        // pattern 在页面空间平铺：x 与页面同向；y 向上而阅读页局部 y 向下。
        // 相位锁到方格左上角，保证边框与页心内的整数格对齐。
        let offset_x = (self.sheet_x_mm + rect.x).rem_euclid(spacing);
        let offset_y = (self.sheet_height_mm - rect.y).rem_euclid(spacing);
        let name = format!(
            "grid_{}_{}_{}_{}",
            name_part(spacing),
            name_part(line_width_pt),
            name_part(offset_x),
            name_part(offset_y),
        );
        let step = qpoint(spacing, spacing);
        // 裁剪框四周各放宽半个线宽，避免落在 tile 边界上的线条被切掉一半。
        let origin = qpoint(-half, -half);
        let upper = qpoint(spacing + half, spacing + half);
        let horizontal = format!(
            "\\pgfpathrectangle{{{}}}{{{}}}",
            qpoint(-half, offset_y - half),
            qpoint(spacing + 2.0 * half, 2.0 * half)
        );
        let vertical = format!(
            "\\pgfpathrectangle{{{}}}{{{}}}",
            qpoint(offset_x - half, -half),
            qpoint(2.0 * half, spacing + 2.0 * half)
        );
        self.define_ink(color);
        let declaration = format!(
            "\\pgfdeclarepatternformonly{{{name}}}{{{origin}}}{{{upper}}}{{{step}}}{{%\n  {horizontal}%\n  {vertical}%\n  \\pgfusepath{{fill}}%\n}}\n"
        );
        self.declare_pattern(&name, &declaration);
        // 填充范围同样外扩半个线宽；区域外的部分由页心裁剪收口。
        self.pattern_fill_rect(
            &name,
            rect.x - half,
            rect.y - half,
            rect.x + rect.width + half,
            rect.y + rect.height + half,
        );
    }

    /// 方眼罫：横线连续，竖线在每条横线下方断开 `gap`；外伸线与标记点由模板单独绘制。
    /// 与方格一样用 pattern 一次填充格线区域，相位锁到区域左上角。
    pub(crate) fn hogen_grid(
        &mut self,
        rect: Rect,
        spacing: f64,
        gap: f64,
        line_width_pt: f64,
        color: &str,
    ) {
        // TeX pt（1/72.27in）换算成毫米。
        let width = line_width_pt * 25.4 / 72.27;
        let half = width / 2.0;
        // pattern 在页面空间平铺：x 与页面同向；y 向上而阅读页局部 y 向下。
        let offset_x = (self.sheet_x_mm + rect.x).rem_euclid(spacing);
        let offset_y = (self.sheet_height_mm - rect.y).rem_euclid(spacing);
        let name = format!(
            "hogen_{}_{}_{}_{}_{}",
            name_part(spacing),
            name_part(gap),
            name_part(line_width_pt),
            name_part(offset_x),
            name_part(offset_y),
        );
        let step = qpoint(spacing, spacing);
        // 裁剪框四周各放宽半个线宽，避免 tile 边界上的线条被切掉一半。
        let origin = qpoint(-half, -half);
        let upper = qpoint(spacing + half, spacing + half);
        // 横线在整个 tile 宽度上连续。
        let mut paths = vec![format!(
            "\\pgfpathrectangle{{{}}}{{{}}}",
            qpoint(-half, offset_y - half),
            qpoint(spacing + 2.0 * half, width)
        )];
        // 竖线从横线向上延伸 spacing-gap；越过 tile 上界时拆成两段。
        let segment = spacing - gap;
        let main_height = segment.min(spacing - offset_y);
        let wrapped_height = (offset_y - gap).max(0.0);
        for (start, height) in [(offset_y, main_height), (0.0, wrapped_height)] {
            if height > 0.0 {
                paths.push(format!(
                    "\\pgfpathrectangle{{{}}}{{{}}}",
                    qpoint(offset_x - half, start),
                    qpoint(width, height)
                ));
            }
        }
        self.define_ink(color);
        let declaration = format!(
            "\\pgfdeclarepatternformonly{{{name}}}{{{origin}}}{{{upper}}}{{{step}}}{{%\n  {}%\n  \\pgfusepath{{fill}}%\n}}\n",
            paths.join("%\n  ")
        );
        self.declare_pattern(&name, &declaration);
        self.pattern_fill_rect(
            &name,
            rect.x - half,
            rect.y - half,
            rect.x + rect.width + half,
            rect.y + rect.height + half,
        );
    }

    /// 单条短线，页面局部坐标；用于方眼罫外伸线与八分周视图的格线。
    pub(crate) fn line(&mut self, x1: f64, y1: f64, x2: f64, y2: f64, width_pt: f64, color: &str) {
        self.line_styled(x1, y1, x2, y2, width_pt, color, "solid");
    }

    /// 带 TikZ 线型的单条线；`style` 取 `solid` / `dashed` / `dotted` / `dash dot`。
    /// 实线省略线型选项，保持既有输出逐字节不变。
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn line_styled(
        &mut self,
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        width_pt: f64,
        color: &str,
        style: &str,
    ) {
        let width = width_pt * 25.4 / 72.27;
        let style = if style == "solid" {
            String::new()
        } else {
            format!(",{style}")
        };
        self.define_ink(color);
        writeln!(
            self.source,
            "\\draw[ink,line width={}mm{}] ({},{}) -- ({},{});",
            number(width),
            style,
            number(x1),
            number(y1),
            number(x2),
            number(y2)
        )
        .unwrap();
    }

    /// 空心圆，页面局部坐标；用于月相轮廓。
    pub(crate) fn circle(&mut self, x: f64, y: f64, radius: f64, width_pt: f64, color: &str) {
        let width = width_pt * 25.4 / 72.27;
        self.define_ink(color);
        writeln!(
            self.source,
            "\\draw[ink,line width={}mm] ({},{}) circle ({});",
            number(width),
            number(x),
            number(y),
            number(radius)
        )
        .unwrap();
    }

    /// 用页面局部坐标填充一个闭合多边形；用于月相亮面。
    pub(crate) fn filled_path(&mut self, points: &[(f64, f64)], color: &str) {
        let Some((first_x, first_y)) = points.first() else {
            return;
        };
        self.define_ink(color);
        let mut path = format!("({},{})", number(*first_x), number(*first_y));
        for (x, y) in &points[1..] {
            path.push_str(&format!(" -- ({},{})", number(*x), number(*y)));
        }
        writeln!(self.source, "\\fill[ink] {path} -- cycle;").unwrap();
    }

    /// 带箭头的折线，页面局部坐标；用于月打卡两表之间的行连接。
    pub(crate) fn arrow_path(&mut self, points: &[(f64, f64)], width_pt: f64, color: &str) {
        let Some((first_x, first_y)) = points.first() else {
            return;
        };
        let width = width_pt * 25.4 / 72.27;
        self.define_ink(color);
        let mut path = format!("({},{})", number(*first_x), number(*first_y));
        for (x, y) in &points[1..] {
            path.push_str(&format!(" -- ({},{})", number(*x), number(*y)));
        }
        writeln!(
            self.source,
            "\\draw[->,ink,line width={}mm] {path};",
            number(width)
        )
        .unwrap();
    }

    fn pattern_fill_rect(&mut self, name: &str, left: f64, top: f64, right: f64, bottom: f64) {
        writeln!(self.source, "\\pgfsetfillpattern{{{name}}}{{ink}}").unwrap();
        writeln!(self.source, "\\pgfpathmoveto{{{}}}", xy_point(left, top)).unwrap();
        writeln!(self.source, "\\pgfpathlineto{{{}}}", xy_point(right, top)).unwrap();
        writeln!(
            self.source,
            "\\pgfpathlineto{{{}}}",
            xy_point(right, bottom)
        )
        .unwrap();
        writeln!(self.source, "\\pgfpathlineto{{{}}}", xy_point(left, bottom)).unwrap();
        self.source.push_str("\\pgfpathclose\n\\pgfusepath{fill}\n");
    }

    /// 均匀圆点阵：声明一个 pattern 并一次填充整个点阵范围。
    /// 逐点 `\fill` 在页数多时会耗尽 TeX 主内存，这里必须走 pattern。
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn dot_grid(
        &mut self,
        x_min: f64,
        y_min: f64,
        x_max: f64,
        y_max: f64,
        column_spacing: f64,
        row_spacing: f64,
        radius: f64,
        color: &str,
    ) {
        // pattern 在页面空间平铺：x 与页面同向；y 向上而阅读页局部 y 向下。
        // 横向带上印刷面偏移，纵向按纸高翻转，保证点阵仍以页心为中心。
        let offset_x = (self.sheet_x_mm + x_min).rem_euclid(column_spacing);
        let offset_y = (self.sheet_height_mm - y_min).rem_euclid(row_spacing);
        let name = format!(
            "dots_{}_{}_{}_{}_{}",
            name_part(column_spacing),
            name_part(row_spacing),
            name_part(radius),
            name_part(offset_x),
            name_part(offset_y),
        );
        let left = x_min - column_spacing / 2.0;
        let top = y_min - row_spacing / 2.0;
        let right = x_max + column_spacing / 2.0;
        let bottom = y_max + row_spacing / 2.0;
        let step = qpoint(column_spacing, row_spacing);
        // 裁剪框比 tile 四周各大一个半径：圆点落在 tile 边界时，下半不会
        // 因为超出裁剪框而被切掉（PDF 平铺图案按裁剪框裁内容）。
        let origin = qpoint(-radius, -radius);
        let upper = qpoint(column_spacing + radius, row_spacing + radius);
        let dot = qpoint(offset_x, offset_y);
        self.define_ink(color);
        let declaration = format!(
            "\\pgfdeclarepatternformonly{{{name}}}{{{origin}}}{{{upper}}}{{{step}}}{{%\n  \\pgfpathcircle{{{dot}}}{{{}mm}}%\n  \\pgfusepath{{fill}}%\n}}\n",
            number(radius)
        );
        self.declare_pattern(&name, &declaration);
        self.pattern_fill_rect(&name, left, top, right, bottom);
    }

    /// 单个实心圆点，使用页面局部坐标（TikZ 会应用 x/y 向量）。
    pub(crate) fn dot(&mut self, x: f64, y: f64, radius: f64, color: &str) {
        self.define_ink(color);
        writeln!(
            self.source,
            "\\fill[ink] ({},{}) circle ({});",
            number(x),
            number(y),
            number(radius)
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
        self.define_ink(&style.color);
        writeln!(self.source, "\\node[anchor={anchor},rotate={rotation},inner sep=0pt,text=ink,font=\\fontsize{{{}}}{{{}}}\\selectfont] at ({},{}) {{{content}}};",
            number(style.size_pt), number(style.size_pt * 1.2), number(x), number(y)).unwrap();
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
    let mut declared_patterns = HashSet::new();
    for output_page in output.pages() {
        let mut canvas = Canvas::new(&mut declared_patterns);
        for placement in &output_page.placements {
            if let Some(physical_page) = placement.physical_page {
                let page = &plan.pages()[physical_page - 1];
                canvas.set_sheet_frame(output.height_mm, placement.x_mm);
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
fn render_page(
    canvas: &mut Canvas<'_>,
    plan: &PlannedDocument<'_>,
    page: &PlannedPage<'_>,
    x_mm: f64,
) {
    writeln!(canvas.source, "\\begin{{scope}}[xshift={}mm]", number(x_mm)).unwrap();
    canvas.begin_region(page.layout.paper);
    writeln!(
        canvas.source,
        "% physical={} section={} local={} display={}",
        page.context.physical_page,
        page.context.section_index,
        page.context.local_index,
        page.context
            .display_number
            .map_or_else(|| "-".to_string(), |n| n.to_string())
    )
    .unwrap();
    if !page.section.body.is_empty() {
        canvas.begin_region(page.layout.body);
        page.section.body.draw(canvas, &page.layout, &page.context);
        canvas.end_region();
    }
    // 左侧竖线等满页元素在页心裁剪之外绘制，但仍受本文阅读页的纸张裁剪。
    page.section.body.draw_page_overlay(canvas, &page.layout);
    // 节级装饰整体覆盖全书默认；None 表示继承。
    page.section
        .decorations
        .as_ref()
        .unwrap_or(&plan.document.decorations)
        .draw(canvas, page);
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
