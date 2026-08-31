use std::{
    collections::{BTreeMap, BTreeSet, HashMap},
    fs,
    path::{Path, PathBuf},
    process::Command,
};

use base64::{Engine, engine::general_purpose::STANDARD};
mod basic;
mod bunkwan;
mod eight;
mod midori;
mod month;
mod timeline;
mod year;

use basic::{BasicPattern, draw_basic};
use bunkwan::{BunkwanPattern, draw_bunkwan, lunar_date};
use chrono::{
    Locale, NaiveDate,
    format::{Item, StrftimeItems},
};
use eight::{EightPattern, draw_eight};
use midori::{MidoriPattern, draw_midori};
use month::{MonthPattern, TrackerPattern, draw_month, draw_tracker};
use serde::Deserialize;
use tauri::Manager;
use timeline::{TimelinePattern, draw_timeline};
use year::{YearPattern, draw_year};

const PAGE_NUMBER_COLOR: &str = "#666666";
const MM_PER_PT: f64 = 25.4 / 72.27;

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct PageSettings {
    width: f64,
    height: f64,
    header: f64,
    footer: f64,
    binding: f64,
    non_binding: f64,
}

impl Default for PageSettings {
    fn default() -> Self {
        Self {
            width: 148.0,
            height: 210.0,
            header: 10.0,
            footer: 10.0,
            binding: 15.0,
            non_binding: 8.0,
        }
    }
}

impl PageSettings {
    fn validate(&self) -> Result<(), String> {
        if self.width <= 0.0 || self.height <= 0.0 {
            return Err("width and height must be > 0".into());
        }
        if [self.header, self.footer, self.binding, self.non_binding]
            .into_iter()
            .any(|v| v < 0.0)
        {
            return Err("page margins must be >= 0".into());
        }
        if self.binding + self.non_binding >= self.width {
            return Err("binding + non_binding must be < width".into());
        }
        if self.header + self.footer >= self.height {
            return Err("header + footer must be < height".into());
        }
        Ok(())
    }
}

/// 页头/页脚共用的带状区域参数（文字或页码）。
#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct BandSettings {
    text: Option<String>,
    text_2: Option<String>,
    text_size: f64,
    text_2_size: f64,
    text_spacing: f64,
    text_color: String,
    page_number: bool,
}

impl Default for BandSettings {
    fn default() -> Self {
        Self {
            text: None,
            text_2: None,
            text_size: 8.0,
            text_2_size: 8.0,
            text_spacing: 5.0,
            text_color: "#7a7a7a".into(),
            page_number: false,
        }
    }
}

impl BandSettings {
    fn validate(&self) -> Result<(), String> {
        if self.text_size <= 0.0 || self.text_2_size <= 0.0 {
            return Err("text sizes must be > 0".into());
        }
        if self.text_spacing < 0.0 {
            return Err("text spacing must be >= 0".into());
        }
        validate_color(&self.text_color)
    }
}

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct DocumentSettings {
    page_number: bool,
    header: BandSettings,
    footer: BandSettings,
    binding_text: Option<String>,
    binding_text_2: Option<String>,
    binding_text_size: f64,
    binding_text_2_size: f64,
    binding_text_spacing: f64,
    binding_text_edge: Option<f64>,
    binding_text_font: String,
    binding_text_color: String,
    pub(crate) lunar: bool,
    non_binding_text: Option<String>,
    non_binding_text_2: Option<String>,
    non_binding_text_size: f64,
    non_binding_text_2_size: f64,
    non_binding_text_spacing: f64,
    non_binding_text_edge: Option<f64>,
    non_binding_text_color: String,
}

impl Default for DocumentSettings {
    fn default() -> Self {
        Self {
            page_number: true,
            header: BandSettings::default(),
            footer: BandSettings::default(),
            binding_text: None,
            binding_text_2: None,
            binding_text_size: 8.0,
            binding_text_2_size: 8.0,
            binding_text_spacing: 5.0,
            binding_text_edge: None,
            binding_text_font: r"\sffamily".into(),
            binding_text_color: "#7a7a7a".into(),
            lunar: false,
            non_binding_text: None,
            non_binding_text_2: None,
            non_binding_text_size: 8.0,
            non_binding_text_2_size: 8.0,
            non_binding_text_spacing: 5.0,
            non_binding_text_edge: None,
            non_binding_text_color: "#7a7a7a".into(),
        }
    }
}

impl DocumentSettings {
    fn validate(&self, page: &PageSettings) -> Result<(), String> {
        self.header.validate()?;
        self.footer.validate()?;
        let sizes = [
            self.binding_text_size,
            self.binding_text_2_size,
            self.non_binding_text_size,
            self.non_binding_text_2_size,
        ];
        if sizes.into_iter().any(|v| v <= 0.0) {
            return Err("text sizes must be > 0".into());
        }
        if [self.binding_text_spacing, self.non_binding_text_spacing]
            .into_iter()
            .any(|v| v < 0.0)
        {
            return Err("text spacing must be >= 0".into());
        }
        if [self.binding_text_edge, self.non_binding_text_edge]
            .into_iter()
            .flatten()
            .any(|v| v < 0.0)
        {
            return Err("text edge distance must be >= 0".into());
        }
        if self.binding_text_font.trim().is_empty() {
            return Err("binding_text_font must not be empty".into());
        }
        for color in [&self.binding_text_color, &self.non_binding_text_color] {
            validate_color(color)?;
        }
        if (self.footer.text.as_deref().is_some_and(|s| !s.is_empty())
            || self.footer.text_2.as_deref().is_some_and(|s| !s.is_empty())
            || self.footer.page_number)
            && page.footer < 5.0
        {
            return Err(format!(
                "页脚高度不足（{}mm < 5mm），无法打印页脚文字",
                page.footer
            ));
        }
        Ok(())
    }
}

#[derive(Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum Pattern {
    Basic(Box<BasicPattern>),
    Bunkwan(BunkwanPattern),
    Eight(EightPattern),
    Midori(MidoriPattern),
    Month(MonthPattern),
    Timeline(TimelinePattern),
    Tracker(TrackerPattern),
    Year(YearPattern),
}

/// 迷你月历/月历的星期表头语言。
#[derive(Clone, Copy, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub(crate) enum WeekdayLang {
    #[default]
    Zh,
    En,
    Ja,
}

pub(crate) fn weekday_headers(lang: WeekdayLang) -> [&'static str; 7] {
    match lang {
        WeekdayLang::Zh => ["一", "二", "三", "四", "五", "六", "日"],
        WeekdayLang::En => ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
        WeekdayLang::Ja => ["月", "火", "水", "木", "金", "土", "日"],
    }
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, Ord, PartialEq, PartialOrd)]
#[serde(rename_all = "kebab-case")]
enum LineStyle {
    #[default]
    Solid,
    Dashed,
    Dotted,
    DashDot,
    DoubleSolid,
}

impl LineStyle {
    fn tikz(self) -> &'static str {
        match self {
            Self::Solid => "solid",
            Self::Dashed => "dashed",
            Self::Dotted => "dotted",
            Self::DashDot => "dash dot",
            Self::DoubleSolid => "double",
        }
    }
}

impl Pattern {
    /// section 的页数由版式自身参数决定：是多少页就是多少页。
    fn page_count(&self) -> usize {
        match self {
            Self::Basic(p) => p.pages,
            Self::Bunkwan(_) | Self::Midori(_) | Self::Month(_) | Self::Tracker(_) => 1,
            Self::Eight(p) => p.weeks().len() * 2,
            Self::Timeline(p) => p.pages as usize,
            Self::Year(p) => p.page_count(),
        }
    }

    fn line_color(&self) -> &str {
        match self {
            Self::Basic(p) => &p.line_color,
            Self::Bunkwan(p) => &p.line_color,
            Self::Eight(p) => &p.line_color,
            Self::Midori(p) => &p.line_color,
            Self::Month(p) => &p.line_color,
            Self::Timeline(p) => &p.line_color,
            Self::Tracker(p) => &p.line_color,
            // 年历只用文字（黑/红固定色），无线条；不会走到该默认值。
            Self::Year(_) => "#000000",
        }
    }
    fn line_width(&self) -> f64 {
        match self {
            Self::Basic(p) => p.line_width,
            Self::Bunkwan(p) => p.line_width,
            Self::Eight(p) => p.line_width,
            Self::Midori(p) => p.line_width,
            Self::Month(p) => p.line_width,
            Self::Timeline(p) => p.line_width,
            Self::Tracker(p) => p.line_width,
            Self::Year(_) => 0.0,
        }
    }
    fn validate(&self) -> Result<(), String> {
        match self {
            Self::Basic(p) => p.validate(),
            Self::Bunkwan(p) => p.validate(),
            Self::Eight(p) => p.validate(),
            Self::Midori(p) => p.validate(),
            Self::Month(p) => p.validate(),
            Self::Timeline(p) => p.validate(),
            Self::Tracker(p) => p.validate(),
            Self::Year(p) => p.validate(),
        }
    }
}

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct RenderSectionRequest {
    #[serde(default)]
    page: PageSettings,
    #[serde(default)]
    document: DocumentSettings,
    pattern: Pattern,
    #[serde(default)]
    holidays: Option<HashMap<String, String>>,
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
enum BindingMode {
    Booklet,
    Thread,
}

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct BindRequest {
    mode: Option<BindingMode>,
    sheets_per_group: usize,
}
impl Default for BindRequest {
    fn default() -> Self {
        Self {
            mode: Some(BindingMode::Booklet),
            sheets_per_group: 4,
        }
    }
}

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct RunPipelineRequest {
    output: String,
    sections: Vec<RenderSectionRequest>,
    #[serde(default)]
    bind: BindRequest,
}

#[derive(Clone, Copy)]
struct Rect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}
#[derive(Clone, Copy, PartialEq)]
enum Side {
    Left,
    Right,
}
#[derive(Clone, Copy)]
struct Geometry {
    page: Rect,
    content: Rect,
    binding_side: Side,
}
#[derive(Clone)]
struct Line {
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    color: Option<String>,
    width: Option<f64>,
    style: LineStyle,
}
#[derive(Clone)]
struct Dot {
    x: f64,
    y: f64,
    radius: f64,
    color: Option<String>,
    square: bool,
}
#[derive(Clone)]
struct Text {
    x: f64,
    y: f64,
    content: String,
    size: f64,
    color: String,
    rotation: i32,
    font: String,
    anchor: &'static str,
}
#[derive(Clone)]
struct Poly {
    points: Vec<(f64, f64)>,
    color: String,
    fill: bool,
    arrow: bool,
}
#[derive(Clone, Default)]
struct PageDraw {
    lines: Vec<Line>,
    texts: Vec<Text>,
    dots: Vec<Dot>,
    paths: Vec<Poly>,
}
#[derive(Clone)]
struct Placement {
    dx: f64,
    draw: PageDraw,
}
#[derive(Clone)]
struct OutputPage {
    width: f64,
    height: f64,
    placements: Vec<Placement>,
}

fn validate_color(color: &str) -> Result<(), String> {
    if color.len() == 7
        && color.starts_with('#')
        && color[1..].bytes().all(|b| b.is_ascii_hexdigit())
    {
        Ok(())
    } else {
        Err(format!("{color} must be #RRGGBB"))
    }
}

fn geometry_for(page: &PageSettings, number: usize) -> Geometry {
    let side = if number % 2 == 1 {
        Side::Left
    } else {
        Side::Right
    };
    let left = if side == Side::Left {
        page.binding
    } else {
        page.non_binding
    };
    Geometry {
        page: Rect {
            x: 0.0,
            y: 0.0,
            width: page.width,
            height: page.height,
        },
        content: Rect {
            x: left,
            y: page.header,
            width: page.width - page.binding - page.non_binding,
            height: page.height - page.header - page.footer,
        },
        binding_side: side,
    }
}

fn centered(start: f64, length: f64, spacing: f64) -> Vec<f64> {
    let center = start + length / 2.0;
    let k = ((length / 2.0 / spacing) + 1e-9).floor() as i32;
    (-k..=k).map(|i| center + f64::from(i) * spacing).collect()
}

fn region(geo: Geometry, header: bool, footer: bool, inner: bool, outer: bool) -> Rect {
    let binding_left = geo.binding_side == Side::Left;
    let left = if if binding_left { inner } else { outer } {
        0.0
    } else {
        geo.content.x
    };
    let right = if if binding_left { outer } else { inner } {
        geo.page.width
    } else {
        geo.content.x + geo.content.width
    };
    let top = if header { 0.0 } else { geo.content.y };
    let bottom = if footer {
        geo.page.height
    } else {
        geo.content.y + geo.content.height
    };
    Rect {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
    }
}

fn inset(rect: Rect, top: f64, bottom: f64, left: f64, right: f64) -> Rect {
    let left = left.min(rect.width);
    let top = top.min(rect.height);
    Rect {
        x: rect.x + left,
        y: rect.y + top,
        width: (rect.width - left - right).max(0.0),
        height: (rect.height - top - bottom).max(0.0),
    }
}

#[allow(clippy::too_many_arguments)]
fn add_text_block(
    out: &mut Vec<Text>,
    font: &str,
    values: [(&Option<String>, f64); 2],
    spacing: f64,
    x: f64,
    y: f64,
    color: &str,
    rotation: i32,
    direction: f64,
    stack_x: bool,
) {
    let visible: Vec<_> = values
        .into_iter()
        .filter_map(|(text, size)| text.as_ref().filter(|s| !s.is_empty()).map(|s| (s, size)))
        .collect();
    let offset = (visible.len().saturating_sub(1)) as f64 * spacing / 2.0;
    for (i, (content, size)) in visible.into_iter().enumerate() {
        let d = direction * (i as f64 * spacing - offset);
        out.push(Text {
            x: if stack_x { x + d } else { x },
            y: if stack_x { y } else { y + d },
            content: content.clone(),
            size,
            color: color.into(),
            rotation,
            font: font.into(),
            anchor: "center",
        });
    }
}

fn date_locale(locale: &str) -> Option<Locale> {
    match locale.replace('_', "-").as_str() {
        "zh-CN" => Some(Locale::zh_CN),
        "en-US" => Some(Locale::en_US),
        _ => None,
    }
}

fn validate_date_format(format: &str, locale: &str) -> Result<(), String> {
    let format = chrono_format(format);
    if format.is_empty() || StrftimeItems::new(&format).any(|item| item == Item::Error) {
        return Err(format!("invalid date format: {format}"));
    }
    date_locale(locale).ok_or_else(|| format!("unsupported locale: {locale}"))?;
    Ok(())
}

fn format_date(date: NaiveDate, format: &str, locale: &str) -> String {
    let formatted = date
        .format_localized(
            &chrono_format(format),
            date_locale(locale).expect("validated locale"),
        )
        .to_string();
    if formatted.contains('\u{e000}') {
        formatted.replace('\u{e000}', &lunar_date(date).expect("validated lunar date"))
    } else {
        formatted
    }
}

fn chrono_format(format: &str) -> String {
    let mut out = String::with_capacity(format.len());
    let mut rest = format;
    while let Some(percent) = rest.find('%') {
        out.push_str(&rest[..percent]);
        rest = &rest[percent..];
        if rest.starts_with("%%") {
            out.push_str("%%");
            rest = &rest[2..];
        } else if rest.starts_with("%cccc") {
            out.push('\u{e000}');
            rest = &rest[5..];
        } else {
            out.push('%');
            rest = &rest[1..];
        }
    }
    out.push_str(rest);
    out
}

fn render_page(
    page: &PageSettings,
    pattern: &Pattern,
    number: usize,
    doc: &DocumentSettings,
    index: usize,
    shown_number: Option<usize>,
    holidays: &Option<HashMap<String, String>>,
    lunar: bool,
) -> PageDraw {
    let geo = geometry_for(page, number);
    let (lines, dots, paths, mut texts) = match pattern {
        Pattern::Basic(p) => {
            let (l, d) = draw_basic(geo, p);
            (l, d, vec![], vec![])
        }
        Pattern::Bunkwan(p) => (draw_bunkwan(geo, p), vec![], vec![], vec![]),
        Pattern::Midori(p) => {
            let (l, d) = draw_midori(geo, p);
            (l, d, vec![], vec![])
        }
        Pattern::Eight(p) => {
            let (l, d, pa, t) = draw_eight(geo, p, index, &doc.binding_text_font, holidays, lunar);
            (l, d, pa, t)
        }
        Pattern::Timeline(p) => {
            let (l, d, t) = draw_timeline(geo, p, &doc.binding_text_font);
            (l, d, vec![], t)
        }
        Pattern::Month(p) => {
            let (l, pa, t) = draw_month(geo, p, index, &doc.binding_text_font, holidays, lunar);
            (l, vec![], pa, t)
        }
        Pattern::Tracker(p) => {
            let (l, pa, t) = draw_tracker(geo, p, index, &doc.binding_text_font, holidays);
            (l, vec![], pa, t)
        }
        Pattern::Year(p) => {
            let t = draw_year(geo, p, index, &doc.binding_text_font, holidays, lunar);
            (vec![], vec![], vec![], t)
        }
    };
    let binding_x = if geo.binding_side == Side::Left {
        doc.binding_text_edge.unwrap_or(page.binding / 2.0)
    } else {
        page.width - doc.binding_text_edge.unwrap_or(page.binding / 2.0)
    };
    add_text_block(
        &mut texts,
        &doc.binding_text_font,
        [
            (&doc.binding_text, doc.binding_text_size),
            (&doc.binding_text_2, doc.binding_text_2_size),
        ],
        doc.binding_text_spacing,
        binding_x,
        page.height / 2.0,
        &doc.binding_text_color,
        90,
        if geo.binding_side == Side::Left {
            1.0
        } else {
            -1.0
        },
        true,
    );
    let outer_x = if geo.binding_side == Side::Left {
        doc.non_binding_text_edge.unwrap_or(page.non_binding / 2.0)
    } else {
        page.width - doc.non_binding_text_edge.unwrap_or(page.non_binding / 2.0)
    };
    add_text_block(
        &mut texts,
        &doc.binding_text_font,
        [
            (&doc.non_binding_text, doc.non_binding_text_size),
            (&doc.non_binding_text_2, doc.non_binding_text_2_size),
        ],
        doc.non_binding_text_spacing,
        outer_x,
        page.height / 2.0,
        &doc.non_binding_text_color,
        90,
        if geo.binding_side == Side::Left {
            -1.0
        } else {
            1.0
        },
        true,
    );
    let shown = shown_number.map(|n| n.to_string());
    // 页头/页脚参数完全一致，同一循环处理：文字 + 页码，都居中在内容区。
    for (band, y) in [
        (&doc.header, page.header / 2.0),
        (&doc.footer, page.height - page.footer / 2.0),
    ] {
        add_text_block(
            &mut texts,
            &doc.binding_text_font,
            [
                (&band.text, band.text_size),
                (&band.text_2, band.text_2_size),
            ],
            band.text_spacing,
            geo.content.x + geo.content.width / 2.0,
            y,
            &band.text_color,
            0,
            1.0,
            false,
        );
        if band.page_number
            && let Some(content) = &shown
        {
            texts.push(Text {
                x: geo.content.x + geo.content.width / 2.0,
                y,
                content: content.clone(),
                size: band.text_size,
                color: band.text_color.clone(),
                rotation: 0,
                font: doc.binding_text_font.clone(),
                anchor: "center",
            });
        }
    }
    PageDraw {
        lines,
        dots,
        paths,
        texts,
    }
}

fn normal_output(
    section: &RenderSectionRequest,
    start: usize,
    pages: usize,
    number_start: usize,
    holidays: &Option<HashMap<String, String>>,
    lunar: bool,
) -> Vec<OutputPage> {
    (0..pages)
        .map(|i| {
            let shown = section.document.page_number.then_some(number_start + i);
            let mut draw = render_page(
                &section.page,
                &section.pattern,
                start + i,
                &section.document,
                i,
                shown,
                holidays,
                lunar,
            );
            for line in &mut draw.lines {
                line.color
                    .get_or_insert_with(|| section.pattern.line_color().into());
                line.width.get_or_insert(section.pattern.line_width());
            }
            for dot in &mut draw.dots {
                dot.color
                    .get_or_insert_with(|| section.pattern.line_color().into());
            }
            OutputPage {
                width: section.page.width,
                height: section.page.height,
                placements: vec![Placement { dx: 0.0, draw }],
            }
        })
        .collect()
}

fn impose(
    mut pages: Vec<OutputPage>,
    mode: BindingMode,
    sheets_per_group: usize,
) -> Result<(Vec<OutputPage>, usize), String> {
    if pages.is_empty() {
        return Ok((vec![], 0));
    }
    let width = pages[0].width;
    let height = pages[0].height;
    if pages.iter().any(|p| p.width != width || p.height != height) {
        return Err("all pages must use the same physical page size".into());
    }
    let stride = match mode {
        BindingMode::Booklet => pages.len().div_ceil(4) * 4,
        BindingMode::Thread => sheets_per_group
            .checked_mul(4)
            .filter(|v| *v > 0)
            .ok_or("sheets_per_group must be >= 1")?,
    };
    let original = pages.len();
    pages.resize_with(original.div_ceil(stride) * stride, || OutputPage {
        width,
        height,
        placements: vec![],
    });
    let sheets = pages.len() / 4;
    let mut out = Vec::new();
    for start in (0..pages.len()).step_by(stride) {
        let end = start + stride - 1;
        for sheet in 0..stride / 4 {
            for (a, b) in [
                (end - sheet * 2, start + sheet * 2),
                (start + sheet * 2 + 1, end - sheet * 2 - 1),
            ] {
                let mut placements = pages[a].placements.clone();
                placements.extend(pages[b].placements.iter().cloned().map(|mut p| {
                    p.dx += width;
                    p
                }));
                out.push(OutputPage {
                    width: width * 2.0,
                    height,
                    placements,
                });
            }
        }
    }
    Ok((out, sheets))
}

fn tex_escape(text: &str) -> String {
    text.chars()
        .map(|c| match c {
            '\\' => r"\textbackslash{}".into(),
            '&' => r"\&".into(),
            '%' => r"\%".into(),
            '#' => r"\#".into(),
            '$' => r"\$".into(),
            '_' => r"\_".into(),
            '{' => r"\{".into(),
            '}' => r"\}".into(),
            '^' => r"\textasciicircum{}".into(),
            '~' => r"\textasciitilde{}".into(),
            _ => c.to_string(),
        })
        .collect()
}
fn color_name(color: &str) -> String {
    format!("c{}", color.trim_start_matches('#'))
}
fn font_command(font: &str) -> String {
    if font.trim_start().starts_with('\\') {
        font.into()
    } else {
        let path = Path::new(font);
        if path.extension().is_some_and(|e| {
            matches!(
                e.to_str().map(str::to_ascii_lowercase).as_deref(),
                Some("otf" | "ttf" | "ttc")
            )
        }) {
            format!(
                r"\fontspec[Path={}]{{{}}}",
                tex_escape(&format!(
                    "{}/",
                    path.parent().unwrap_or(Path::new(".")).display()
                )),
                tex_escape(&path.file_name().unwrap_or_default().to_string_lossy())
            )
        } else {
            format!(r"\fontspec{{{}}}", tex_escape(font))
        }
    }
}

fn render_latex(pages: &[OutputPage]) -> String {
    let mut colors = BTreeMap::from([("pnumcolor".to_string(), PAGE_NUMBER_COLOR.to_string())]);
    let mut bodies = Vec::new();
    let mut uses_font = false;
    for page in pages {
        let mut parts = vec![format!(
            r"\useasboundingbox (0,0) rectangle ({},{});",
            page.width, page.height
        )];
        let mut line_groups: BTreeMap<(String, String, LineStyle), Vec<String>> = BTreeMap::new();
        let mut dot_groups: BTreeMap<String, Vec<String>> = BTreeMap::new();
        let mut path_groups: BTreeMap<(String, bool, bool), Vec<String>> = BTreeMap::new();
        for placement in &page.placements {
            for line in &placement.draw.lines {
                let raw = line.color.as_deref().unwrap_or("#000000");
                let color = color_name(raw);
                colors.insert(color.clone(), raw.into());
                line_groups
                    .entry((color, line.width.unwrap_or(0.2).to_string(), line.style))
                    .or_default()
                    .push(format!(
                        r"  \draw ({},{}) -- ({},{});",
                        placement.dx + line.x1,
                        line.y1,
                        placement.dx + line.x2,
                        line.y2
                    ));
            }
            for poly in &placement.draw.paths {
                let color = color_name(&poly.color);
                colors.insert(color.clone(), poly.color.clone());
                let points = poly
                    .points
                    .iter()
                    .map(|(x, y)| format!("({},{})", placement.dx + x, y))
                    .collect::<Vec<_>>()
                    .join(" -- ");
                let (cmd, tail) = if poly.fill {
                    ("fill", " -- cycle")
                } else if poly.arrow {
                    ("draw[->]", "")
                } else {
                    ("draw", " -- cycle")
                };
                path_groups
                    .entry((color, poly.fill, poly.arrow))
                    .or_default()
                    .push(format!("  \\{cmd} {points}{tail};"));
            }
            for dot in &placement.draw.dots {
                let raw = dot.color.as_deref().unwrap_or("#000000");
                let color = color_name(raw);
                colors.insert(color.clone(), raw.into());
                dot_groups.entry(color).or_default().push(if dot.square {
                    format!(
                        r"  \fill ({},{}) rectangle ({},{});",
                        placement.dx + dot.x - dot.radius,
                        dot.y - dot.radius,
                        placement.dx + dot.x + dot.radius,
                        dot.y + dot.radius
                    )
                } else {
                    format!(
                        r"  \fill ({},{}) circle ({});",
                        placement.dx + dot.x,
                        dot.y,
                        dot.radius
                    )
                });
            }
        }
        for ((color, width, style), commands) in line_groups {
            parts.push(format!(
                "\\begin{{scope}}[{color}, line width={width}pt, {}]\n{}\n\\end{{scope}}",
                style.tikz(),
                commands.join("\n")
            ));
        }
        for (color, commands) in dot_groups {
            parts.push(format!(
                "\\begin{{scope}}[{color}]\n{}\n\\end{{scope}}",
                commands.join("\n")
            ));
        }
        for ((color, _, _), commands) in path_groups {
            parts.push(format!(
                "\\begin{{scope}}[{color}]\n{}\n\\end{{scope}}",
                commands.join("\n")
            ));
        }
        for placement in &page.placements {
            for text in &placement.draw.texts {
                let color = if text.color == PAGE_NUMBER_COLOR {
                    "pnumcolor".into()
                } else {
                    let name = color_name(&text.color);
                    colors.insert(name.clone(), text.color.clone());
                    name
                };
                uses_font |= !text.font.trim_start().starts_with('\\');
                parts.push(format!(r"\node[{color}, rotate={}, anchor={}, font={{{}\fontsize{{{}}}{{{}}}\selectfont}}] at ({},{}) {{{}}};", text.rotation, text.anchor, font_command(&text.font), text.size, text.size * 1.2, placement.dx + text.x, text.y, tex_escape(&text.content)));
            }
        }
        bodies.push(format!(
            "\\begin{{tikzpicture}}[x=1mm, y=-1mm]\n{}\n\\end{{tikzpicture}}",
            parts.join("\n")
        ));
    }
    let definitions = colors
        .into_iter()
        .map(|(name, color)| {
            format!(
                r"\definecolor{{{name}}}{{HTML}}{{{}}}",
                color.trim_start_matches('#').to_ascii_uppercase()
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "\\documentclass[multi=tikzpicture]{{standalone}}\n{}\n\\usepackage{{tikz}}\n{}\n\\begin{{document}}\n{}\n\\end{{document}}\n",
        if uses_font {
            r"\usepackage{fontspec}"
        } else {
            ""
        },
        definitions,
        bodies.join("\n\n")
    )
}

fn compile(tex: &Path, resource_dir: Option<&Path>) -> Result<PathBuf, String> {
    let bundled = resource_dir
        .map(|dir| {
            dir.join(if cfg!(windows) {
                "tectonic.exe"
            } else {
                "tectonic"
            })
        })
        .filter(|p| p.is_file())
        .or_else(|| {
            std::env::current_exe().ok().and_then(|p| {
                p.parent().map(|p| {
                    p.join(if cfg!(windows) {
                        "tectonic.exe"
                    } else {
                        "tectonic"
                    })
                })
            })
        })
        .filter(|p| p.is_file());
    let engine = bundled.or_else(|| {
        ["tectonic", "xelatex", "pdflatex"]
            .into_iter()
            .find_map(which)
    });
    let engine = engine.ok_or("no LaTeX engine found: tectonic/xelatex/pdflatex")?;
    let mut command = Command::new(&engine);
    if engine.file_stem().is_some_and(|s| s == "tectonic") {
        command.arg(tex.file_name().unwrap_or_default());
    } else {
        command
            .args(["-interaction=nonstopmode", "-halt-on-error"])
            .arg(tex.file_name().unwrap_or_default());
    }
    let output = command
        .current_dir(tex.parent().unwrap_or(Path::new(".")))
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        let mut details = String::from_utf8_lossy(&output.stdout).into_owned();
        details.push_str(&String::from_utf8_lossy(&output.stderr));
        return Err(format!(
            "{} failed:\n{}",
            engine.display(),
            details
                .chars()
                .rev()
                .take(2000)
                .collect::<String>()
                .chars()
                .rev()
                .collect::<String>()
        ));
    }
    let pdf = tex.with_extension("pdf");
    if !pdf.is_file() {
        return Err(format!("{} did not produce PDF", engine.display()));
    }
    Ok(pdf)
}

fn which(name: &str) -> Option<PathBuf> {
    std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths)
            .map(|p| p.join(name))
            .find(|p| p.is_file())
    })
}

fn generate(
    body: RunPipelineRequest,
    preview: bool,
    resource_dir: Option<&Path>,
) -> Result<(PathBuf, Vec<u8>), String> {
    if body.sections.is_empty() {
        return Err("sections must not be empty".into());
    }
    if body.bind.sheets_per_group == 0 {
        return Err("sheets_per_group must be >= 1".into());
    }
    for section in &body.sections {
        section.page.validate()?;
        section.document.validate(&section.page)?;
        section.pattern.validate()?;
    }
    let mut generated = Vec::new();
    let mut number = 1;
    let mut page_number = 1;
    for section in body.sections {
        // 预览最多渲 2 页。
        let pages = section.pattern.page_count();
        let pages = if preview { pages.min(2) } else { pages };
        generated.extend(normal_output(
            &section,
            number,
            pages,
            page_number,
            &section.holidays,
            section.document.lunar,
        ));
        number += pages;
        if section.document.page_number {
            page_number += pages;
        }
        if preview {
            break;
        }
    }
    if let Some(mode) = body.bind.mode {
        generated = impose(generated, mode, body.bind.sheets_per_group)?.0;
    }
    let temp = std::env::temp_dir().join(format!(
        "base6-techo-{}-{}",
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
    ));
    fs::create_dir_all(&temp).map_err(|e| e.to_string())?;
    let tex = temp.join("document.tex");
    fs::write(&tex, render_latex(&generated)).map_err(|e| e.to_string())?;
    let pdf = compile(&tex, resource_dir)?;
    let bytes = fs::read(&pdf).map_err(|e| e.to_string())?;
    let output = PathBuf::from(body.output);
    if !preview {
        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&output, &bytes).map_err(|e| e.to_string())?;
    }
    let _ = fs::remove_dir_all(temp);
    Ok((output, bytes))
}

#[tauri::command]
pub(crate) fn list_system_fonts() -> Result<String, String> {
    let output = Command::new("fc-list")
        .args([":", "family"])
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Ok("[]".into());
    }
    let mut names = BTreeSet::new();
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        for name in line
            .split(':')
            .next()
            .unwrap_or("")
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            names.insert(name.to_owned());
        }
    }
    serde_json::to_string(&names).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn write_text_file(path: String, content: String) -> Result<String, String> {
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path)
}

#[tauri::command]
pub(crate) fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) async fn run_pipeline(
    app: tauri::AppHandle,
    body: RunPipelineRequest,
) -> Result<String, String> {
    let resource_dir = app.path().resource_dir().ok();
    tauri::async_runtime::spawn_blocking(move || {
        generate(body, false, resource_dir.as_deref()).map(|(path, _)| path.display().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) async fn preview_section(
    app: tauri::AppHandle,
    body: RenderSectionRequest,
) -> Result<String, String> {
    let request = RunPipelineRequest {
        output: String::new(),
        sections: vec![body],
        bind: BindRequest {
            mode: None,
            sheets_per_group: 4,
        },
    };
    let resource_dir = app.path().resource_dir().ok();
    tauri::async_runtime::spawn_blocking(move || {
        generate(request, true, resource_dir.as_deref()).map(|(_, bytes)| STANDARD.encode(bytes))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::timeline::timeline_color;
    use super::*;
    use chrono::Utc;

    /// 手工样张：cargo test render_cross_month_week_sample -- --ignored --nocapture
    #[test]
    #[ignore]
    fn render_cross_month_week_sample() {
        let body: RunPipelineRequest = serde_json::from_str(
            r#"{
                "output": "/tmp/week-2026-08-31.pdf",
                "sections": [{
                    "pattern": {
                        "kind": "eight",
                        "start_date": "2026-08-31",
                        "end_date": "2026-09-06",
                        "weekday_lang": "ja"
                    },
                    "document": {
                        "binding_text_font": "Sarasa UI SC"
                    }
                }]
            }"#,
        )
        .unwrap();
        let (path, _) = generate(body, false, None).unwrap();
        println!("PDF: {}", path.display());
        let year: RunPipelineRequest = serde_json::from_str(
            r#"{
                "output": "/tmp/year-2026.pdf",
                "sections": [{
                    "pattern": {
                        "kind": "year",
                        "start": "2026-01",
                        "end": "2026-12",
                        "rows": 2,
                        "cols": 2
                    },
                    "document": {
                        "binding_text_font": "Sarasa UI SC"
                    },
                    "holidays": {
                        "2026-01-01": "元旦",
                        "2026-01-02": "元旦",
                        "2026-01-03": "元旦",
                        "2026-01-04": "上班(补元旦假期)",
                        "2026-02-14": "上班(补春节假期)",
                        "2026-02-15": "春节",
                        "2026-02-16": "春节",
                        "2026-02-17": "春节",
                        "2026-02-18": "春节",
                        "2026-02-19": "春节",
                        "2026-02-20": "春节",
                        "2026-02-21": "春节",
                        "2026-02-22": "春节",
                        "2026-02-23": "春节",
                        "2026-02-28": "上班(补春节假期)",
                        "2026-04-04": "清明节",
                        "2026-04-05": "清明节",
                        "2026-04-06": "清明节",
                        "2026-05-01": "劳动节",
                        "2026-05-02": "劳动节",
                        "2026-05-03": "劳动节",
                        "2026-05-04": "劳动节",
                        "2026-05-05": "劳动节",
                        "2026-05-09": "上班(补劳动节假期)",
                        "2026-06-19": "端午节",
                        "2026-06-20": "端午节",
                        "2026-06-21": "端午节",
                        "2026-09-20": "上班(补国庆节假期)",
                        "2026-09-25": "中秋节",
                        "2026-09-26": "中秋节",
                        "2026-09-27": "中秋节",
                        "2026-10-01": "国庆节",
                        "2026-10-02": "国庆节",
                        "2026-10-03": "国庆节",
                        "2026-10-04": "国庆节",
                        "2026-10-05": "国庆节",
                        "2026-10-06": "国庆节",
                        "2026-10-07": "国庆节",
                        "2026-10-10": "上班(补国庆节假期)"
                    }
                }]
            }"#,
        )
        .unwrap();
        let (year_path, _) = generate(year, false, None).unwrap();
        println!("PDF: {}", year_path.display());
    }

    #[test]
    fn test_lunar_date() {
        use super::lunar_date;
        use chrono::NaiveDate;
        let d = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        let lunar = lunar_date(d);
        println!("2026-01-01 lunar: {:?}", lunar);
        assert!(lunar.is_some(), "lunar date should exist");
    }

    #[test]
    fn render_lunar_calendar() {
        let year: RunPipelineRequest = serde_json::from_str(
            r#"{
                "output": "/tmp/year-2026-lunar.pdf",
                "sections": [{
                    "pattern": {
                        "kind": "year",
                        "start": "2026-01",
                        "end": "2026-12",
                        "rows": 2,
                        "cols": 2
                    },
                    "document": {
                        "binding_text_font": "Sarasa UI SC",
                        "lunar": true
                    },
                    "holidays": {
                        "2026-01-01": "元旦",
                        "2026-01-02": "元旦",
                        "2026-01-03": "元旦",
                        "2026-01-04": "上班(补元旦假期)",
                        "2026-02-14": "上班(补春节假期)",
                        "2026-02-15": "春节",
                        "2026-02-16": "春节",
                        "2026-02-17": "春节",
                        "2026-02-18": "春节",
                        "2026-02-19": "春节",
                        "2026-02-20": "春节",
                        "2026-02-21": "春节",
                        "2026-02-22": "春节",
                        "2026-02-23": "春节",
                        "2026-02-28": "上班(补春节假期)",
                        "2026-04-04": "清明节",
                        "2026-04-05": "清明节",
                        "2026-04-06": "清明节",
                        "2026-05-01": "劳动节",
                        "2026-05-02": "劳动节",
                        "2026-05-03": "劳动节",
                        "2026-05-04": "劳动节",
                        "2026-05-05": "劳动节",
                        "2026-05-09": "上班(补劳动节假期)",
                        "2026-06-19": "端午节",
                        "2026-06-20": "端午节",
                        "2026-06-21": "端午节",
                        "2026-09-20": "上班(补国庆节假期)",
                        "2026-09-25": "中秋节",
                        "2026-09-26": "中秋节",
                        "2026-09-27": "中秋节",
                        "2026-10-01": "国庆节",
                        "2026-10-02": "国庆节",
                        "2026-10-03": "国庆节",
                        "2026-10-04": "国庆节",
                        "2026-10-05": "国庆节",
                        "2026-10-06": "国庆节",
                        "2026-10-07": "国庆节",
                        "2026-10-10": "上班(补国庆节假期)"
                    }
                }]
            }"#,
        )
        .unwrap();
        let (lunar_path, _) = generate(year, false, None).unwrap();
        println!("Lunar PDF: {}", lunar_path.display());
        // Debug: check if lunar texts exist
        let year2: RunPipelineRequest = serde_json::from_str(
            r#"{
                "output": "/tmp/year-2026-lunar2.pdf",
                "sections": [{
                    "pattern": {
                        "kind": "year",
                        "start": "2026-01",
                        "end": "2026-12",
                        "rows": 2,
                        "cols": 2
                    },
                    "document": {
                        "binding_text_font": "Sarasa UI SC",
                        "lunar": true
                    }
                }]
            }"#,
        )
        .unwrap();
        let (lunar_path2, _) = generate(year2, false, None).unwrap();
        println!("Generated: {}", lunar_path2.display());
    }
    #[test]
    fn render_month_with_holidays_and_lunar() {
        let body: RunPipelineRequest = serde_json::from_str(
            r#"{
                "output": "/tmp/month-2026-01.pdf",
                "sections": [{
                    "pattern": {
                        "kind": "month",
                        "year": 2026,
                        "month": 1
                    },
                    "document": {
                        "binding_text_font": "Sarasa UI SC",
                        "lunar": true
                    },
                    "holidays": {
                        "2026-01-01": "元旦",
                        "2026-01-02": "元旦",
                        "2026-01-03": "元旦",
                        "2026-01-04": "上班(补元旦假期)"
                    }
                }]
            }"#,
        )
        .unwrap();
        let (path, _) = generate(body, false, None).unwrap();
        println!("Month PDF: {}", path.display());
    }

    #[test]
    fn render_eight_with_holidays_and_lunar() {
        let body: RunPipelineRequest = serde_json::from_str(
            r#"{
                "output": "/tmp/eight-2026-01.pdf",
                "sections": [{
                    "pattern": {
                        "kind": "eight",
                        "start_date": "2026-01-05",
                        "end_date": "2026-01-11",
                        "weekday_lang": "zh"
                    },
                    "document": {
                        "binding_text_font": "Sarasa UI SC",
                        "lunar": true
                    },
                    "holidays": {
                        "2026-01-01": "元旦",
                        "2026-01-02": "元旦",
                        "2026-01-03": "元旦",
                        "2026-01-04": "上班(补元旦假期)"
                    }
                }]
            }"#,
        )
        .unwrap();
        let (path, _) = generate(body, false, None).unwrap();
        println!("Eight PDF: {}", path.display());
    }

    #[test]
    fn booklet_uses_one_signature() {
        let pages = (1..=8)
            .map(|n| OutputPage {
                width: 1.0,
                height: 1.0,
                placements: vec![Placement {
                    dx: 0.0,
                    draw: PageDraw {
                        texts: vec![Text {
                            x: 0.0,
                            y: 0.0,
                            content: n.to_string(),
                            size: 8.0,
                            color: PAGE_NUMBER_COLOR.into(),
                            rotation: 0,
                            font: r"\sffamily".into(),
                            anchor: "center",
                        }],
                        ..Default::default()
                    },
                }],
            })
            .collect();
        let (spreads, sheets) = impose(pages, BindingMode::Booklet, 4).unwrap();
        assert_eq!(sheets, 2);
        assert_eq!(
            spreads
                .iter()
                .map(|p| p
                    .placements
                    .iter()
                    .map(|x| x.draw.texts[0].content.as_str())
                    .collect::<Vec<_>>())
                .collect::<Vec<_>>(),
            [["8", "1"], ["2", "7"], ["6", "3"], ["4", "5"]]
        );
    }

    #[test]
    fn layout_and_line_styles_match_existing_geometry() {
        let page = PageSettings::default();
        assert_eq!(geometry_for(&page, 1).content.x, 15.0);
        assert_eq!(geometry_for(&page, 2).content.x, 8.0);
        let pattern = BasicPattern {
            draw_hlines: true,
            line_width: 0.3,
            line_color: "#333333".into(),
            line_style: LineStyle::DoubleSolid,
            hline_top_width: 0.5,
            hline_top_color: "#111111".into(),
            hline_top_style: LineStyle::Dashed,
            hline_bottom_width: 0.6,
            hline_bottom_color: "#121212".into(),
            hline_bottom_style: LineStyle::Dotted,
            hline_center_width: 0.7,
            hline_center_color: "#222222".into(),
            hline_center_style: LineStyle::DashDot,
            vline_spacing: Some(8.0),
            vline_width: 0.4,
            vline_color: "#123456".into(),
            vline_style: LineStyle::DoubleSolid,
            vline_left_width: 0.6,
            vline_left_color: "#345678".into(),
            vline_left_style: LineStyle::Dashed,
            vline_right_width: 0.7,
            vline_right_color: "#456789".into(),
            vline_right_style: LineStyle::Dotted,
            vline_center_width: 0.8,
            vline_center_color: "#567890".into(),
            vline_center_style: LineStyle::DashDot,
            draw_vlines: true,
            ..Default::default()
        };
        let (lines, _) = draw_basic(geometry_for(&page, 1), &pattern);
        let hlines = lines
            .iter()
            .filter(|line| line.y1 == line.y2)
            .collect::<Vec<_>>();
        let vlines = lines
            .iter()
            .filter(|line| line.x1 == line.x2)
            .collect::<Vec<_>>();
        assert_eq!(
            vlines
                .iter()
                .take(4)
                .map(|line| line.x1)
                .collect::<Vec<_>>(),
            [21.5, 29.5, 37.5, 45.5]
        );
        let assert_line = |line: &Line, color, width, style| {
            assert_eq!(line.color.as_deref(), Some(color));
            assert_eq!(line.width, Some(width));
            assert_eq!(line.style, style);
        };
        assert_line(hlines[0], "#111111", 0.5, LineStyle::Dashed);
        assert_line(hlines[1], "#333333", 0.3, LineStyle::DoubleSolid);
        assert_line(hlines[hlines.len() / 2], "#222222", 0.7, LineStyle::DashDot);
        assert_line(hlines.last().unwrap(), "#121212", 0.6, LineStyle::Dotted);
        assert_line(vlines[0], "#345678", 0.6, LineStyle::Dashed);
        assert_line(vlines[1], "#123456", 0.4, LineStyle::DoubleSolid);
        assert_line(vlines[vlines.len() / 2], "#567890", 0.8, LineStyle::DashDot);
        assert_line(vlines.last().unwrap(), "#456789", 0.7, LineStyle::Dotted);
    }

    #[test]
    fn basic_patterns_apply_independent_edge_distances() {
        let page = PageSettings::default();
        let pattern = BasicPattern {
            draw_hlines: true,
            draw_vlines: true,
            draw_dots: true,
            vline_spacing: Some(8.0),
            dot_spacing: Some(8.0),
            hline_top: 2.0,
            hline_bottom: 3.0,
            hline_left: 4.0,
            hline_right: 5.0,
            vline_top: 6.0,
            vline_bottom: 7.0,
            vline_left: 8.0,
            vline_right: 9.0,
            dot_top: 10.0,
            dot_bottom: 11.0,
            dot_left: 12.0,
            dot_right: 13.0,
            ..Default::default()
        };
        let (lines, dots) = draw_basic(geometry_for(&page, 1), &pattern);
        let hline = lines.iter().find(|line| line.y1 == line.y2).unwrap();
        let vline = lines.iter().find(|line| line.x1 == line.x2).unwrap();
        assert_eq!((hline.x1, hline.x2), (19.0, 135.0));
        assert_eq!((vline.y1, vline.y2), (16.0, 193.0));
        assert!(dots.iter().all(|dot| (27.0..=127.0).contains(&dot.x)));
        assert!(dots.iter().all(|dot| (20.0..=189.0).contains(&dot.y)));
    }

    #[test]
    fn headers_center_between_binding_and_outer_margins() {
        let page = PageSettings::default();
        let document = DocumentSettings {
            header: BandSettings {
                text: Some("header".into()),
                ..Default::default()
            },
            ..Default::default()
        };
        let pattern = Pattern::Basic(Box::default());
        for (number, expected_x) in [(1, 77.5), (2, 70.5)] {
            let draw = render_page(&page, &pattern, number, &document, 0, None, &None, false);
            assert!(draw.texts.iter().all(|text| text.x == expected_x));
        }
    }

    #[test]
    fn page_numbers_render_in_header_and_footer() {
        let page = PageSettings::default();
        let document = DocumentSettings {
            header: BandSettings {
                page_number: true,
                ..Default::default()
            },
            footer: BandSettings {
                page_number: true,
                ..Default::default()
            },
            ..Default::default()
        };
        let pattern = Pattern::Basic(Box::default());
        // 参与页码：页码显示在页头/页脚中心，用各自的颜色。
        let draw = render_page(&page, &pattern, 1, &document, 0, Some(7), &None, false);
        let number = |y: f64, color: &str| {
            draw.texts
                .iter()
                .any(|t| t.content == "7" && t.y == y && t.color == color)
        };
        assert!(number(page.header / 2.0, &document.header.text_color));
        assert!(number(
            page.height - page.footer / 2.0,
            &document.footer.text_color
        ));
        // 不参与页码：不显示。
        let draw = render_page(&page, &pattern, 1, &document, 0, None, &None, false);
        assert!(draw.texts.iter().all(|t| t.content != "7"));
    }

    #[test]
    fn bunkwan_uses_content_range_and_shared_header() {
        let page = PageSettings::default();
        let document = DocumentSettings {
            header: BandSettings {
                text: Some("header".into()),
                ..Default::default()
            },
            ..Default::default()
        };
        let pattern = Pattern::Bunkwan(BunkwanPattern::default());
        let draw = render_page(&page, &pattern, 1, &document, 0, None, &None, false);
        let content = geometry_for(&page, 1).content;
        assert_eq!((draw.lines[0].x1, draw.lines[0].y1), (content.x, content.y));
        assert!(draw.texts.iter().any(|text| text.content == "header"));
    }

    #[test]
    fn chrono_formats_localized_dates_with_weekdays() {
        let date = NaiveDate::from_ymd_opt(2025, 9, 8).unwrap();
        assert_eq!(format_date(date, "[%a. %m/%d]", "zh-CN"), "[一. 09/08]");
        assert_eq!(format_date(date, "[%a. %m/%d]", "en-US"), "[Mon. 09/08]");
        let date = NaiveDate::from_ymd_opt(2026, 8, 1).unwrap();
        assert_eq!(format_date(date, "%Y年 %cccc", "zh-CN"), "2026年 六月十九");
        assert_eq!(format_date(date, "%%cccc", "zh-CN"), "%cccc");
        assert!(validate_date_format("%Y年 %cccc", "zh-CN").is_ok());
        assert!(validate_date_format("%Q", "zh-CN").is_err());
        assert!(validate_date_format("%Y-%m-%d", "fr-FR").is_err());
    }

    #[test]
    fn timeline_crosses_midnight() {
        let p = TimelinePattern {
            latitude: Some(31.23),
            longitude: Some(121.47),
            timezone: Some("Asia/Shanghai".into()),
            ..Default::default()
        };
        let date = NaiveDate::from_ymd_opt(2025, 6, 21).unwrap();
        assert_eq!(
            timeline_color(&p, Some(date), 28 * 60).as_deref(),
            Some("#0047ab")
        );
        assert_eq!(
            timeline_color(&p, Some(date), 29 * 60).as_deref(),
            Some("#ffd700")
        );
    }

    #[test]
    fn real_frontend_payload_generates_pdf() {
        let output = std::env::temp_dir().join(format!(
            "base6-techo-test-{}-{}.pdf",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let request: RunPipelineRequest = serde_json::from_value(serde_json::json!({
            "output": output,
            "sections": [
                { "document": { "binding_text": "[base-6]" }, "pattern": { "kind": "basic", "pages": 1, "draw_hlines": true } },
                { "pattern": { "kind": "bunkwan" } },
                { "pattern": { "kind": "eight", "start_date": "2026-08-03", "end_date": "2026-08-16" } },
                { "pattern": { "kind": "midori" } },
                { "pattern": { "kind": "timeline", "pages": 1, "date": "2026-08-01", "latitude": 31.23, "longitude": 121.47, "timezone": "Asia/Shanghai" } }
            ],
            "bind": { "mode": "booklet", "sheets_per_group": 4 }
        }))
        .unwrap();

        let (path, bytes) = generate(request, false, None).unwrap();

        assert_eq!(&bytes[..4], b"%PDF");
        assert_eq!(fs::read(&path).unwrap(), bytes);
        fs::remove_file(path).unwrap();
    }
}
