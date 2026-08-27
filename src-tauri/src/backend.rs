use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
    process::Command,
};

use base64::{Engine, engine::general_purpose::STANDARD};
use chrono::{
    Duration, Locale, NaiveDate, TimeZone, Timelike, Utc,
    format::{Item, StrftimeItems},
};
use chrono_tz::Tz;
use serde::Deserialize;
use tauri::Manager;

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

#[derive(Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
enum Parity {
    Odd,
    Even,
    Both,
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
enum DatePosition {
    Center,
    Binding,
    Outer,
}

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct DocumentSettings {
    page_count: usize,
    show_header: bool,
    binding_text: Option<String>,
    binding_text_2: Option<String>,
    binding_text_size: f64,
    binding_text_2_size: f64,
    binding_text_spacing: f64,
    binding_text_edge: Option<f64>,
    binding_text_font: String,
    binding_text_color: String,
    header_date: Option<NaiveDate>,
    header_date_end: Option<NaiveDate>,
    header_date_format: String,
    header_date_locale: String,
    header_parity: Parity,
    header_date_size: f64,
    header_date_font: Option<String>,
    header_date_position: DatePosition,
    header_text: Option<String>,
    header_text_2: Option<String>,
    header_text_size: f64,
    header_text_2_size: f64,
    header_text_spacing: f64,
    header_text_color: String,
    non_binding_text: Option<String>,
    non_binding_text_2: Option<String>,
    non_binding_text_size: f64,
    non_binding_text_2_size: f64,
    non_binding_text_spacing: f64,
    non_binding_text_edge: Option<f64>,
    non_binding_text_color: String,
    footer_text: Option<String>,
    footer_text_2: Option<String>,
    footer_text_size: f64,
    footer_text_2_size: f64,
    footer_text_spacing: f64,
    footer_text_color: String,
}

impl Default for DocumentSettings {
    fn default() -> Self {
        Self {
            page_count: 32,
            show_header: true,
            binding_text: None,
            binding_text_2: None,
            binding_text_size: 8.0,
            binding_text_2_size: 8.0,
            binding_text_spacing: 5.0,
            binding_text_edge: None,
            binding_text_font: r"\sffamily".into(),
            binding_text_color: "#7a7a7a".into(),
            header_date: None,
            header_date_end: None,
            header_date_format: "%Y-%m-%d".into(),
            header_date_locale: "zh_CN".into(),
            header_parity: Parity::Both,
            header_date_size: 8.0,
            header_date_font: None,
            header_date_position: DatePosition::Center,
            header_text: None,
            header_text_2: None,
            header_text_size: 8.0,
            header_text_2_size: 8.0,
            header_text_spacing: 5.0,
            header_text_color: "#7a7a7a".into(),
            non_binding_text: None,
            non_binding_text_2: None,
            non_binding_text_size: 8.0,
            non_binding_text_2_size: 8.0,
            non_binding_text_spacing: 5.0,
            non_binding_text_edge: None,
            non_binding_text_color: "#7a7a7a".into(),
            footer_text: None,
            footer_text_2: None,
            footer_text_size: 8.0,
            footer_text_2_size: 8.0,
            footer_text_spacing: 5.0,
            footer_text_color: "#7a7a7a".into(),
        }
    }
}

impl DocumentSettings {
    fn validate(&self, page: &PageSettings) -> Result<(), String> {
        if !(1..=500).contains(&self.page_count) {
            return Err("page_count must be in 1..500".into());
        }
        if let (Some(start), Some(end)) = (self.header_date, self.header_date_end)
            && end < start
        {
            return Err("结束日期必须晚于或等于开始日期".into());
        }
        validate_date_format(&self.header_date_format, &self.header_date_locale)?;
        let sizes = [
            self.binding_text_size,
            self.binding_text_2_size,
            self.header_date_size,
            self.header_text_size,
            self.header_text_2_size,
            self.non_binding_text_size,
            self.non_binding_text_2_size,
            self.footer_text_size,
            self.footer_text_2_size,
        ];
        if sizes.into_iter().any(|v| v <= 0.0) {
            return Err("text sizes must be > 0".into());
        }
        if [
            self.binding_text_spacing,
            self.header_text_spacing,
            self.non_binding_text_spacing,
            self.footer_text_spacing,
        ]
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
        for color in [
            &self.binding_text_color,
            &self.header_text_color,
            &self.non_binding_text_color,
            &self.footer_text_color,
        ] {
            validate_color(color)?;
        }
        if (self.footer_text.as_deref().is_some_and(|s| !s.is_empty())
            || self.footer_text_2.as_deref().is_some_and(|s| !s.is_empty()))
            && page.footer < 5.0
        {
            return Err(format!(
                "页脚高度不足（{}mm < 5mm），无法打印页脚文字",
                page.footer
            ));
        }
        Ok(())
    }

    fn dates(&self) -> Vec<Option<NaiveDate>> {
        let Some(start) = self.header_date else {
            return vec![None; self.page_count];
        };
        let days = self
            .header_date_end
            .map(|end| (end - start).num_days() as usize + 1);
        let mut dates = vec![None; self.page_count];
        if self.header_parity == Parity::Both {
            for (i, slot) in dates
                .iter_mut()
                .take(days.unwrap_or(self.page_count).min(self.page_count))
                .enumerate()
            {
                *slot = Some(start + Duration::days(i as i64));
            }
        } else {
            let count = days
                .unwrap_or(self.page_count)
                .min(self.page_count.div_ceil(2));
            for i in 0..count {
                let date = start + Duration::days(i as i64);
                dates[i * 2] = Some(date);
                if i * 2 + 1 < dates.len() {
                    dates[i * 2 + 1] = Some(date);
                }
            }
        }
        dates
    }
}

#[derive(Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum Pattern {
    Basic(BasicPattern),
    Midori(MidoriPattern),
    Timeline(TimelinePattern),
}

impl Pattern {
    fn line_color(&self) -> &str {
        match self {
            Self::Basic(p) => &p.line_color,
            Self::Midori(p) => &p.line_color,
            Self::Timeline(p) => &p.line_color,
        }
    }
    fn line_width(&self) -> f64 {
        match self {
            Self::Basic(p) => p.line_width,
            Self::Midori(p) => p.line_width,
            Self::Timeline(p) => p.line_width,
        }
    }
    fn validate(&self) -> Result<(), String> {
        match self {
            Self::Basic(p) => p.validate(),
            Self::Midori(p) => p.validate(),
            Self::Timeline(p) => p.validate(),
        }
    }
}

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct BasicPattern {
    spacing: f64,
    line_width: f64,
    line_color: String,
    draw_hlines: bool,
    draw_vlines: bool,
    draw_dots: bool,
    hline_edge_color: Option<String>,
    hline_edge_width: Option<f64>,
    vline_edge_color: Option<String>,
    vline_edge_width: Option<f64>,
    dot_center_color: Option<String>,
    hline_header: bool,
    hline_footer: bool,
    hline_inner: bool,
    hline_outer: bool,
    vline_header: bool,
    vline_footer: bool,
    vline_inner: bool,
    vline_outer: bool,
    dot_header: bool,
    dot_footer: bool,
    dot_inner: bool,
    dot_outer: bool,
    dot_spacing: Option<f64>,
    dot_radius: f64,
    margin_x: Option<f64>,
    margin_color: Option<String>,
    vline_spacing: Option<f64>,
}

impl Default for BasicPattern {
    fn default() -> Self {
        Self {
            spacing: 8.0,
            line_width: 0.2,
            line_color: "#B0B0B0".into(),
            draw_hlines: false,
            draw_vlines: false,
            draw_dots: false,
            hline_edge_color: None,
            hline_edge_width: None,
            vline_edge_color: None,
            vline_edge_width: None,
            dot_center_color: None,
            hline_header: false,
            hline_footer: false,
            hline_inner: false,
            hline_outer: false,
            vline_header: false,
            vline_footer: false,
            vline_inner: false,
            vline_outer: false,
            dot_header: false,
            dot_footer: false,
            dot_inner: false,
            dot_outer: false,
            dot_spacing: None,
            dot_radius: 0.3,
            margin_x: None,
            margin_color: None,
            vline_spacing: None,
        }
    }
}

impl BasicPattern {
    fn validate(&self) -> Result<(), String> {
        if self.spacing <= 0.0 || self.line_width <= 0.0 || self.dot_radius <= 0.0 {
            return Err("spacing, line_width and dot_radius must be > 0".into());
        }
        for value in [
            self.dot_spacing,
            self.margin_x,
            self.vline_spacing,
            self.hline_edge_width,
            self.vline_edge_width,
        ]
        .into_iter()
        .flatten()
        {
            if value <= 0.0 {
                return Err("optional pattern lengths must be > 0".into());
            }
        }
        for color in [
            &Some(self.line_color.clone()),
            &self.margin_color,
            &self.hline_edge_color,
            &self.vline_edge_color,
            &self.dot_center_color,
        ]
        .into_iter()
        .filter_map(|v| v.as_deref())
        {
            validate_color(color)?;
        }
        Ok(())
    }
}

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct MidoriPattern {
    spacing: f64,
    gap: f64,
    edge_extension: f64,
    dot_frequency: usize,
    dot_radius: f64,
    line_width: f64,
    line_color: String,
    dot_color: String,
    header: bool,
    footer: bool,
    inner: bool,
    outer: bool,
}
impl Default for MidoriPattern {
    fn default() -> Self {
        Self {
            spacing: 5.0,
            gap: 1.0,
            edge_extension: 1.2,
            dot_frequency: 10,
            dot_radius: 0.4,
            line_width: 0.7,
            line_color: "#a9d1ae".into(),
            dot_color: "#a9d1ae".into(),
            header: false,
            footer: false,
            inner: false,
            outer: false,
        }
    }
}
impl MidoriPattern {
    fn validate(&self) -> Result<(), String> {
        if [
            self.spacing,
            self.gap,
            self.edge_extension,
            self.dot_radius,
            self.line_width,
        ]
        .into_iter()
        .any(|v| v <= 0.0)
            || self.dot_frequency == 0
        {
            return Err("midori dimensions and dot_frequency must be > 0".into());
        }
        validate_color(&self.line_color)?;
        validate_color(&self.dot_color)
    }
}

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct TimelinePattern {
    start: i32,
    end: i32,
    pages: i32,
    line_color: String,
    line_width: f64,
    label_size: f64,
    city_name: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    timezone: Option<String>,
    daylight_color: String,
    night_color: String,
}
impl Default for TimelinePattern {
    fn default() -> Self {
        Self {
            start: 0,
            end: 26,
            pages: 1,
            line_color: "#7A7A7A".into(),
            line_width: 0.4 / MM_PER_PT,
            label_size: 10.2,
            city_name: None,
            latitude: None,
            longitude: None,
            timezone: None,
            daylight_color: "#ffd700".into(),
            night_color: "#0047ab".into(),
        }
    }
}
impl TimelinePattern {
    fn validate(&self) -> Result<(), String> {
        if !(0..30).contains(&self.start) || self.end <= self.start || self.end > 30 {
            return Err("timeline hours must satisfy 0 <= start < end <= 30".into());
        }
        if !matches!(self.pages, 1 | 2) {
            return Err("pages must be 1 or 2".into());
        }
        if self.line_width <= 0.0 || self.label_size <= 0.0 {
            return Err("line_width and label_size must be > 0".into());
        }
        if [
            self.latitude.is_some(),
            self.longitude.is_some(),
            self.timezone.is_some(),
        ]
        .into_iter()
        .any(|v| v)
            && !(self.latitude.is_some() && self.longitude.is_some() && self.timezone.is_some())
        {
            return Err("latitude, longitude and timezone must be set together".into());
        }
        if self.latitude.is_some_and(|v| !(-90.0..=90.0).contains(&v))
            || self
                .longitude
                .is_some_and(|v| !(-180.0..=180.0).contains(&v))
        {
            return Err("invalid latitude or longitude".into());
        }
        if let Some(tz) = &self.timezone {
            tz.parse::<Tz>()
                .map_err(|_| format!("unknown timezone: {tz}"))?;
        }
        validate_color(&self.line_color)?;
        validate_color(&self.daylight_color)?;
        validate_color(&self.night_color)
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
#[derive(Clone, Default)]
struct PageDraw {
    lines: Vec<Line>,
    texts: Vec<Text>,
    dots: Vec<Dot>,
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

fn draw_basic(geo: Geometry, p: &BasicPattern) -> (Vec<Line>, Vec<Dot>) {
    let hr = region(
        geo,
        p.hline_header,
        p.hline_footer,
        p.hline_inner,
        p.hline_outer,
    );
    let vr = region(
        geo,
        p.vline_header,
        p.vline_footer,
        p.vline_inner,
        p.vline_outer,
    );
    let dr = region(geo, p.dot_header, p.dot_footer, p.dot_inner, p.dot_outer);
    let ys = if p.draw_hlines {
        centered(hr.y, hr.height, p.spacing)
    } else {
        vec![]
    };
    let mut lines = Vec::new();
    for (i, y) in ys.iter().enumerate() {
        let edge = i == 0 || i + 1 == ys.len();
        lines.push(Line {
            x1: hr.x,
            y1: *y,
            x2: hr.x + hr.width,
            y2: *y,
            color: edge.then(|| p.hline_edge_color.clone()).flatten(),
            width: edge.then_some(p.hline_edge_width).flatten(),
        });
    }
    if p.draw_vlines {
        let top = vr.y;
        let bottom = vr.y + vr.height;
        if let (Some(margin), Some(color)) = (p.margin_x, &p.margin_color) {
            let x = geo.content.x + margin;
            lines.push(Line {
                x1: x,
                y1: top,
                x2: x,
                y2: bottom,
                color: Some(p.vline_edge_color.clone().unwrap_or_else(|| color.clone())),
                width: p.vline_edge_width,
            });
        }
        if let (Some(spacing), Some(color)) = (p.vline_spacing, &p.margin_color) {
            let xs = if let Some(margin) = p.margin_x {
                let count = ((vr.x + vr.width - geo.content.x - margin) / spacing).floor() as usize;
                (1..=count)
                    .map(|i| geo.content.x + margin + i as f64 * spacing)
                    .collect()
            } else {
                centered(vr.x, vr.width, spacing)
            };
            for (i, x) in xs.into_iter().enumerate() {
                lines.push(Line {
                    x1: x,
                    y1: top,
                    x2: x,
                    y2: bottom,
                    color: Some(if i == 0 && p.margin_x.is_none() {
                        p.vline_edge_color.clone().unwrap_or_else(|| color.clone())
                    } else {
                        color.clone()
                    }),
                    width: if i == 0 { p.vline_edge_width } else { None },
                });
            }
        }
    }
    let mut dots = Vec::new();
    if p.draw_dots
        && let Some(spacing) = p.dot_spacing
    {
        let cx = dr.x + dr.width / 2.0;
        let cy = dr.y + dr.height / 2.0;
        for y in centered(dr.y, dr.height, p.spacing) {
            for x in centered(dr.x, dr.width, spacing) {
                dots.push(Dot {
                    x,
                    y,
                    radius: p.dot_radius,
                    color: ((x - cx).abs() < 1e-9 && (y - cy).abs() < 1e-9)
                        .then(|| p.dot_center_color.clone())
                        .flatten(),
                    square: false,
                });
            }
        }
    }
    (lines, dots)
}

fn dot_indices(cells: usize, frequency: usize) -> BTreeSet<usize> {
    let middle = cells / 2;
    let mut out = BTreeSet::new();
    for step in 0..cells {
        let d = step * frequency;
        if middle >= d && middle - d > 0 {
            out.insert(middle - d);
        }
        if middle + d < cells {
            out.insert(middle + d);
        }
    }
    out
}

fn draw_midori(geo: Geometry, p: &MidoriPattern) -> (Vec<Line>, Vec<Dot>) {
    let r = region(geo, p.header, p.footer, p.inner, p.outer);
    let inset = p.gap + p.edge_extension;
    let nx = ((r.width - 2.0 * inset) / p.spacing).floor().max(0.0) as usize;
    let ny = ((r.height - 2.0 * inset) / p.spacing).floor().max(0.0) as usize;
    if nx == 0 || ny == 0 {
        return (vec![], vec![]);
    }
    let w = nx as f64 * p.spacing;
    let h = ny as f64 * p.spacing;
    let sx = r.x + (r.width - w) / 2.0;
    let sy = r.y + (r.height - h) / 2.0;
    let xd = dot_indices(nx, p.dot_frequency);
    let yd = dot_indices(ny, p.dot_frequency);
    let mut lines = Vec::new();
    let line = |x1, y1, x2, y2| Line {
        x1,
        y1,
        x2,
        y2,
        color: None,
        width: None,
    };
    for row in 0..=ny {
        let y = sy + row as f64 * p.spacing;
        lines.push(line(sx, y, sx + w, y));
        if row % 2 == 0 && !yd.contains(&row) && row > 0 && row < ny {
            lines.push(line(sx - p.gap - p.edge_extension, y, sx - p.gap, y));
            lines.push(line(
                sx + w + p.gap,
                y,
                sx + w + p.gap + p.edge_extension,
                y,
            ));
        }
    }
    for col in 0..=nx {
        let x = sx + col as f64 * p.spacing;
        if col % 2 == 0 && !xd.contains(&col) && col > 0 && col < nx {
            lines.push(line(x, sy - p.gap - p.edge_extension, x, sy - p.gap));
            lines.push(line(
                x,
                sy + h + p.gap,
                x,
                sy + h + p.gap + p.edge_extension,
            ));
        }
        for row in 0..ny {
            lines.push(line(
                x,
                sy + row as f64 * p.spacing + p.gap,
                x,
                sy + (row + 1) as f64 * p.spacing,
            ));
        }
    }
    let mut dots = Vec::new();
    let dot = |x, y| Dot {
        x,
        y,
        radius: p.dot_radius,
        color: Some(p.dot_color.clone()),
        square: false,
    };
    for col in xd {
        let x = sx + col as f64 * p.spacing;
        dots.push(dot(x, sy - 1.5));
        dots.push(dot(x, sy + h + 1.5));
    }
    for row in yd {
        let y = sy + row as f64 * p.spacing;
        dots.push(dot(sx - 1.5, y));
        dots.push(dot(sx + w + 1.5, y));
    }
    (lines, dots)
}

fn timeline_color(p: &TimelinePattern, date: Option<NaiveDate>, minute: i32) -> Option<String> {
    let (Some(date), Some(lat), Some(lon), Some(tz)) =
        (date, p.latitude, p.longitude, p.timezone.as_deref())
    else {
        return None;
    };
    let tz: Tz = tz.parse().ok()?;
    let local = tz
        .from_local_datetime(&(date.and_hms_opt(0, 0, 0)? + Duration::minutes(i64::from(minute))))
        .single()?;
    Some(
        if solar_elevation(lat, lon, local.with_timezone(&Utc)) > -0.833 {
            p.daylight_color.clone()
        } else {
            p.night_color.clone()
        },
    )
}

fn solar_elevation(latitude: f64, longitude: f64, moment: chrono::DateTime<Utc>) -> f64 {
    let jd = moment.timestamp() as f64 / 86400.0 + 2440587.5;
    let t = (jd - 2451545.0) / 36525.0;
    let l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)).rem_euclid(360.0);
    let m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
    let c = m.to_radians().sin() * (1.914602 - t * (0.004817 + 0.000014 * t))
        + (2.0 * m).to_radians().sin() * (0.019993 - 0.000101 * t)
        + (3.0 * m).to_radians().sin() * 0.000289;
    let omega = 125.04 - 1934.136 * t;
    let lambda = l0 + c - 0.00569 - 0.00478 * omega.to_radians().sin();
    let epsilon = 23.0
        + (26.0 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60.0) / 60.0
        + 0.00256 * omega.to_radians().cos();
    let decl = (epsilon.to_radians().sin() * lambda.to_radians().sin()).asin();
    let y = (epsilon.to_radians() / 2.0).tan().powi(2);
    let eq = 4.0
        * (y * (2.0 * l0).to_radians().sin() - 2.0 * 0.016708634 * m.to_radians().sin()
            + 4.0 * 0.016708634 * y * m.to_radians().sin() * (2.0 * l0).to_radians().cos()
            - 0.5 * y * y * (4.0 * l0).to_radians().sin()
            - 1.25 * 0.016708634_f64.powi(2) * (2.0 * m).to_radians().sin())
        .to_degrees();
    let minutes =
        f64::from(moment.hour() * 60 + moment.minute()) + f64::from(moment.second()) / 60.0;
    let hour_angle = (minutes + eq + 4.0 * longitude).rem_euclid(1440.0) / 4.0 - 180.0;
    let lat = latitude.to_radians();
    (lat.sin() * decl.sin() + lat.cos() * decl.cos() * hour_angle.to_radians().cos())
        .asin()
        .to_degrees()
}

fn draw_timeline(
    geo: Geometry,
    p: &TimelinePattern,
    date: Option<NaiveDate>,
    font: &str,
) -> (Vec<Line>, Vec<Dot>, Vec<Text>) {
    let mid = (p.start + p.end) / 2;
    let (start, end) = if p.pages == 1 {
        (p.start, p.end)
    } else if geo.binding_side == Side::Left {
        (p.start, mid)
    } else {
        (mid, p.end)
    };
    let span = f64::from(end - start);
    let hh = geo.content.height / span;
    let axis = if geo.binding_side == Side::Left {
        geo.content.x
    } else {
        geo.content.x + geo.content.width
    };
    let direction = if geo.binding_side == Side::Left {
        1.0
    } else {
        -1.0
    };
    let extension = geo.page.width
        * if geo.binding_side == Side::Left {
            2.0 / 3.0
        } else {
            1.0 / 3.0
        };
    let mut lines = Vec::new();
    let mut dots = Vec::new();
    let mut texts = Vec::new();
    for hour in start..=end {
        let color = timeline_color(p, date, hour * 60);
        let y = geo.content.y + f64::from(hour - start) / span * geo.content.height;
        let tick = axis + direction * 7.0;
        lines.push(Line {
            x1: axis,
            y1: y,
            x2: tick,
            y2: y,
            color: color.clone(),
            width: Some(p.line_width),
        });
        let count = ((extension - tick).abs() / (hh / 2.0)).ceil() as usize;
        for i in 1..count {
            dots.push(Dot {
                x: tick + direction * i as f64 * hh / 2.0,
                y,
                radius: p.line_width * MM_PER_PT / 2.0,
                color: color.clone(),
                square: true,
            });
        }
        texts.push(Text {
            x: axis - direction * 3.0,
            y,
            content: format!("{hour:02}"),
            size: p.label_size,
            color: color.unwrap_or_else(|| p.line_color.clone()),
            rotation: 0,
            font: font.into(),
            anchor: "center",
        });
        if hour < end {
            let half = y + hh / 2.0;
            lines.push(Line {
                x1: axis,
                y1: half,
                x2: axis + direction * 3.0,
                y2: half,
                color: timeline_color(p, date, hour * 60 + 30),
                width: Some(p.line_width),
            });
        }
    }
    (lines, dots, texts)
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
    if format.is_empty() || StrftimeItems::new(format).any(|item| item == Item::Error) {
        return Err(format!("invalid date format: {format}"));
    }
    date_locale(locale).ok_or_else(|| format!("unsupported locale: {locale}"))?;
    Ok(())
}

fn format_date(date: NaiveDate, format: &str, locale: &str) -> String {
    date.format_localized(format, date_locale(locale).expect("validated locale"))
        .to_string()
}

fn render_page(
    page: &PageSettings,
    pattern: &Pattern,
    number: usize,
    doc: &DocumentSettings,
    index: usize,
    dates: &[Option<NaiveDate>],
) -> PageDraw {
    let geo = geometry_for(page, number);
    let date = dates.get(index).copied().flatten();
    let (lines, dots, mut texts) = match pattern {
        Pattern::Basic(p) => {
            let (l, d) = draw_basic(geo, p);
            (l, d, vec![])
        }
        Pattern::Midori(p) => {
            let (l, d) = draw_midori(geo, p);
            (l, d, vec![])
        }
        Pattern::Timeline(p) => draw_timeline(geo, p, date, &doc.binding_text_font),
    };
    let visible = doc.header_parity == Parity::Both
        || (doc.header_parity == Parity::Odd && !(index + 1).is_multiple_of(2))
        || (doc.header_parity == Parity::Even && (index + 1).is_multiple_of(2));
    if doc.show_header
        && visible
        && let Some(date) = date
    {
        let (x, anchor) = match doc.header_date_position {
            DatePosition::Binding => {
                if geo.binding_side == Side::Left {
                    (page.binding / 2.0, "west")
                } else {
                    (page.width - page.binding / 2.0, "east")
                }
            }
            DatePosition::Outer => {
                if geo.binding_side == Side::Left {
                    (page.width - page.non_binding / 2.0, "east")
                } else {
                    (page.non_binding / 2.0, "west")
                }
            }
            DatePosition::Center => (page.width / 2.0, "center"),
        };
        texts.push(Text {
            x,
            y: page.header / 2.0,
            content: format_date(date, &doc.header_date_format, &doc.header_date_locale),
            size: doc.header_date_size,
            color: doc.header_text_color.clone(),
            rotation: 0,
            font: doc
                .header_date_font
                .clone()
                .unwrap_or_else(|| doc.binding_text_font.clone()),
            anchor,
        });
    }
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
    add_text_block(
        &mut texts,
        &doc.binding_text_font,
        [
            (&doc.header_text, doc.header_text_size),
            (&doc.header_text_2, doc.header_text_2_size),
        ],
        doc.header_text_spacing,
        page.width / 2.0,
        page.header / 2.0,
        &doc.header_text_color,
        0,
        1.0,
        false,
    );
    add_text_block(
        &mut texts,
        &doc.binding_text_font,
        [
            (&doc.footer_text, doc.footer_text_size),
            (&doc.footer_text_2, doc.footer_text_2_size),
        ],
        doc.footer_text_spacing,
        page.width / 2.0,
        page.height - page.footer / 2.0,
        &doc.footer_text_color,
        0,
        1.0,
        false,
    );
    PageDraw { lines, dots, texts }
}

fn normal_output(section: &RenderSectionRequest, start: usize) -> Vec<OutputPage> {
    let dates = section.document.dates();
    (0..section.document.page_count)
        .map(|i| {
            let mut draw = render_page(
                &section.page,
                &section.pattern,
                start + i,
                &section.document,
                i,
                &dates,
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
        let mut line_groups: BTreeMap<(String, String), Vec<String>> = BTreeMap::new();
        let mut dot_groups: BTreeMap<String, Vec<String>> = BTreeMap::new();
        for placement in &page.placements {
            for line in &placement.draw.lines {
                let raw = line.color.as_deref().unwrap_or("#000000");
                let color = color_name(raw);
                colors.insert(color.clone(), raw.into());
                line_groups
                    .entry((color, line.width.unwrap_or(0.2).to_string()))
                    .or_default()
                    .push(format!(
                        r"  \draw ({},{}) -- ({},{});",
                        placement.dx + line.x1,
                        line.y1,
                        placement.dx + line.x2,
                        line.y2
                    ));
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
        for ((color, width), commands) in line_groups {
            parts.push(format!(
                "\\begin{{scope}}[{color}, line width={width}pt]\n{}\n\\end{{scope}}",
                commands.join("\n")
            ));
        }
        for (color, commands) in dot_groups {
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
                parts.push(format!(r"\node[{}, rotate={}, anchor={}, font={{{}\fontsize{{{}}}{{{}}}\selectfont}}] at ({},{}) {{{}}};", color, text.rotation, text.anchor, font_command(&text.font), text.size, text.size * 1.2, placement.dx + text.x, text.y, tex_escape(&text.content)));
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
    for mut section in body.sections {
        if preview {
            section.document.page_count = 2;
        }
        generated.extend(normal_output(&section, number));
        number += section.document.page_count;
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
    use super::*;

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
    fn layout_and_french_grid_match_existing_geometry() {
        let page = PageSettings::default();
        assert_eq!(geometry_for(&page, 1).content.x, 15.0);
        assert_eq!(geometry_for(&page, 2).content.x, 8.0);
        let pattern = BasicPattern {
            margin_x: Some(15.0),
            margin_color: Some("#88AEC7".into()),
            vline_spacing: Some(8.0),
            draw_vlines: true,
            ..Default::default()
        };
        let (lines, _) = draw_basic(geometry_for(&page, 1), &pattern);
        assert_eq!(
            lines.iter().take(4).map(|line| line.x1).collect::<Vec<_>>(),
            [30.0, 38.0, 46.0, 54.0]
        );
    }

    #[test]
    fn date_ranges_repeat_across_spreads() {
        let document = DocumentSettings {
            page_count: 6,
            header_date: NaiveDate::from_ymd_opt(2025, 3, 1),
            header_date_end: NaiveDate::from_ymd_opt(2025, 3, 3),
            header_parity: Parity::Odd,
            ..Default::default()
        };
        assert_eq!(
            document.dates(),
            [
                "2025-03-01",
                "2025-03-01",
                "2025-03-02",
                "2025-03-02",
                "2025-03-03",
                "2025-03-03"
            ]
            .map(|date| Some(NaiveDate::parse_from_str(date, "%F").unwrap()))
        );
    }

    #[test]
    fn chrono_formats_localized_dates_with_weekdays() {
        let date = NaiveDate::from_ymd_opt(2025, 9, 8).unwrap();
        assert_eq!(format_date(date, "[%a. %m/%d]", "zh-CN"), "[一. 09/08]");
        assert_eq!(format_date(date, "[%a. %m/%d]", "en-US"), "[Mon. 09/08]");
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
                { "document": { "page_count": 1, "binding_text": "[base-6]" }, "pattern": { "kind": "basic", "draw_hlines": true } },
                { "document": { "page_count": 1 }, "pattern": { "kind": "midori" } },
                { "document": { "page_count": 1 }, "pattern": { "kind": "timeline", "pages": 1 } }
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
