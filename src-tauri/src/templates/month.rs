//! 月历：单页横向设计，整页逆时针旋转 90° 落在阅读页上。
//!
//! 移植自 archive 分支 `backend/month.rs` 的单页核心：7 列周一为首网格、
//! 交叉处留缺口、左上角日期、可选逐日月相。农历、节假日、双页拆列与
//! 打卡表依赖主线没有的数据源或版式，未移植。

use serde::{Deserialize, Serialize};

use super::{
    calendar::{Date, MonthGrid, WeekdayLang, format_date, validate_format},
    common::{check_text_len, validate_weekday_headers, weekday_headers},
    document::PageContext,
    latex::{Canvas, validate_color},
    layout::{PageLayout, Rect, check_range},
    moon::{moon_illumination, moon_points},
};

/// 连续月份数上限；每个模板块的页数上限是 999。
pub(crate) const MONTHS_MAX: usize = 120;

const HEAD_H: f64 = 4.0; // mm，星期表头行高
const PAD: f64 = 0.2; // mm，日期距格边
const GAP: f64 = 0.2; // mm，网格交叉处留白
const MOON_INSET: f64 = 1.0; // mm，月相圆盘离格右上角的留白
const MM_PER_PT: f64 = 25.4 / 72.27;

/// 横向设计坐标系里的单月网格几何。
#[derive(Clone, Copy)]
struct MonthLayout {
    land: Rect,
    gy: f64,
    cell_w: f64,
    cell_h: f64,
    rows: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct MonthPattern {
    /// 起始月份（YYYY-MM）。
    pub start_month: String,
    /// 连续月份数；每页一个月，页数由它推导。
    pub months: usize,
    /// 月份标题格式；支持 `%Y`、`%m`、`%-m`、`%d`、`%-d`、`%a` 与 `%%`。
    pub title_format: String,
    /// `%a` 使用的星期短名语言。
    pub weekday_lang: WeekdayLang,
    /// 星期表头，英文逗号分隔 7 项。
    pub weekday_headers: String,
    pub line_color: String,
    /// 日期与标题的普通文字颜色。
    pub text_color: String,
    pub phase_color: String,
    pub line_width_pt: f64,
    pub date_size_pt: f64,
    /// 是否在每天右上角画近似月相。
    pub show_phase: bool,
}

impl Default for MonthPattern {
    fn default() -> Self {
        Self {
            start_month: "2026-08".into(),
            months: 1,
            title_format: "%Y年%-m月".into(),
            weekday_lang: WeekdayLang::Zh,
            weekday_headers: "一,二,三,四,五,六,日".into(),
            line_color: "#7A7A7A".into(),
            text_color: "#000000".into(),
            phase_color: "#E5B93F".into(),
            line_width_pt: 0.4,
            date_size_pt: 8.0,
            show_phase: true,
        }
    }
}

impl MonthPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        let start = parse_month(&self.start_month)?;
        if !(1..=MONTHS_MAX).contains(&self.months) {
            return Err(format!("月历月份数必须在 1–{MONTHS_MAX} 之间"));
        }
        let start_index = i64::from(start.year()) * 12 + i64::from(start.month()) - 1;
        if start_index + self.months as i64 - 1 > 9999 * 12 + 11 {
            return Err("月历范围不能超过 9999 年 12 月".into());
        }
        check_range("月历线宽（pt）", self.line_width_pt, 0.01, 10.0)?;
        check_range("月历日期字号（pt）", self.date_size_pt, 1.0, 72.0)?;
        validate_color(&self.line_color)?;
        validate_color(&self.text_color)?;
        validate_color(&self.phase_color)?;
        check_text_len("月历标题格式", &self.title_format)?;
        validate_weekday_headers(&self.weekday_headers)?;
        validate_format(&self.title_format)
    }

    /// 每月一页；页数由月份数推导。
    pub(crate) fn required_pages(&self) -> usize {
        self.months
    }

    /// 起始月份起连续 `months` 个月的 1 号；校验已保证格式合法。
    pub(crate) fn month_firsts(&self) -> Vec<Date> {
        let Ok(mut first) = parse_month(&self.start_month) else {
            return Vec::new();
        };
        let mut out = Vec::with_capacity(self.months);
        for _ in 0..self.months {
            out.push(first);
            first = first.next_month_first();
        }
        out
    }

    pub(crate) fn draw(&self, canvas: &mut Canvas<'_>, layout: &PageLayout, context: &PageContext) {
        let month_firsts = self.month_firsts();
        let Some(&first) = month_firsts.get(context.local_index) else {
            return;
        };
        self.draw_month(canvas, layout.body, first);
    }

    /// 单页月历：横向设计坐标系旋转 90° 后落到页心。
    fn draw_month(&self, canvas: &mut Canvas<'_>, body: Rect, first: Date) {
        let grid = MonthGrid::new(first);
        let title_w = body.width / 8.0;
        let land = Rect {
            x: 0.0,
            y: title_w,
            width: body.height,
            height: body.width - title_w,
        };
        let g = MonthLayout {
            land,
            gy: land.y + HEAD_H,
            cell_w: land.width / 7.0,
            cell_h: (land.height - HEAD_H) / grid.rows as f64,
            rows: grid.rows,
        };
        if g.cell_w <= 0.0 || g.cell_h <= 0.0 {
            return;
        }
        // 设计坐标系 (x 向右、y 向下) → 页面坐标：逆时针转 90°，贴到页心左下角。
        let base = body.y + body.height;
        let left = body.x;
        let to_page = |x: f64, y: f64| (left + y, base - x);

        let line_style = super::components::TextStyle {
            size_pt: self.date_size_pt,
            color: self.line_color.clone(),
        };
        let text_style = super::components::TextStyle {
            size_pt: self.date_size_pt,
            color: self.text_color.clone(),
        };
        let title_style = super::components::TextStyle {
            size_pt: self.date_size_pt * 1.5,
            color: self.text_color.clone(),
        };

        self.draw_grid(canvas, &g, &to_page);
        for (column, header) in weekday_headers(&self.weekday_headers).iter().enumerate() {
            let (x, y) = to_page(
                g.land.x + g.cell_w * (column as f64 + 0.5),
                g.land.y + HEAD_H / 2.0,
            );
            canvas.text(x, y, header, &line_style, "center", 90);
        }
        let (title_x, title_y) = to_page(body.height / 2.0, body.width / 16.0);
        canvas.text(
            title_x,
            title_y,
            &format_date(first, &self.title_format, self.weekday_lang),
            &title_style,
            "center",
            90,
        );

        for day in 1..=grid.days {
            let (column, row) = grid.position(day);
            let date = first.add_days(day as i64 - 1);
            let (x, y) = to_page(
                g.land.x + g.cell_w * column as f64 + PAD,
                g.gy + g.cell_h * row as f64 + PAD,
            );
            canvas.text(x, y, &day.to_string(), &text_style, "north west", 90);
            if self.show_phase {
                self.draw_phase(canvas, &g, column, row, date, &to_page);
            }
        }
    }

    /// 竖线按行分段、横线按列分段，交叉处各留 `GAP` 缺口。
    fn draw_grid<F>(&self, canvas: &mut Canvas<'_>, g: &MonthLayout, to_page: &F)
    where
        F: Fn(f64, f64) -> (f64, f64),
    {
        for column in 0..=7 {
            let x = g.land.x + g.cell_w * column as f64;
            for row in 0..g.rows {
                let y1 = g.gy + g.cell_h * row as f64 + GAP;
                let y2 = g.gy + g.cell_h * (row + 1) as f64 - GAP;
                let (x1, y1) = to_page(x, y1);
                let (x2, y2) = to_page(x, y2);
                canvas.line(x1, y1, x2, y2, self.line_width_pt, &self.line_color);
            }
        }
        for row in 0..=g.rows {
            let y = g.gy + g.cell_h * row as f64;
            for column in 0..7 {
                let x1 = g.land.x + g.cell_w * column as f64 + GAP;
                let x2 = g.land.x + g.cell_w * (column + 1) as f64 - GAP;
                let (x1, y1) = to_page(x1, y);
                let (x2, y2) = to_page(x2, y);
                canvas.line(x1, y1, x2, y2, self.line_width_pt, &self.line_color);
            }
        }
    }

    /// 右上角圆形月相：直径与日期字号同大。
    fn draw_phase<F>(
        &self,
        canvas: &mut Canvas<'_>,
        g: &MonthLayout,
        column: usize,
        row: usize,
        date: Date,
        to_page: &F,
    ) where
        F: Fn(f64, f64) -> (f64, f64),
    {
        let radius = self.date_size_pt * MM_PER_PT / 2.0;
        let cx = g.land.x + g.cell_w * (column as f64 + 1.0) - PAD - radius - MOON_INSET;
        let cy = g.gy + g.cell_h * row as f64 + PAD + radius + MOON_INSET;
        let (illumination, waxing) = moon_illumination(date);
        let points = moon_points(cx, cy, radius, illumination, waxing)
            .into_iter()
            .map(|(x, y)| to_page(x, y))
            .collect::<Vec<_>>();
        canvas.filled_path(&points, &self.phase_color);
        let (x, y) = to_page(cx, cy);
        canvas.circle(x, y, radius, self.line_width_pt, &self.phase_color);
    }
}

/// 解析 `YYYY-MM` 为当月 1 号；格式错误统一报“月份必须为 YYYY-MM”。
fn parse_month(text: &str) -> Result<Date, String> {
    let bytes = text.as_bytes();
    if bytes.len() != 7 || bytes[4] != b'-' || !bytes[..4].iter().all(u8::is_ascii_digit) {
        return Err(format!("月份必须为 YYYY-MM，收到 {text}"));
    }
    Date::parse(&format!("{text}-01")).map_err(|_| format!("月份必须为 YYYY-MM，收到 {text}"))
}
