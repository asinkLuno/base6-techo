//! 月历：单页横向设计，整页逆时针旋转 90° 落在阅读页上。
//!
//! 移植自 archive 分支 `backend/month.rs` 的单页核心：7 列周一为首网格、
//! 交叉处留缺口、左上角日期、可选逐日月相。农历、节假日、双页拆列与
//! 打卡表依赖主线没有的数据源或版式，未移植。

use serde::{Deserialize, Serialize};

use super::{
    calendar::{Date, MonthGrid, MonthSpan, WeekdayLang, format_date, validate_format},
    common::{check_text_len, validate_weekday_headers, weekday_headers},
    document::PageContext,
    latex::{Canvas, validate_color},
    layout::{PageLayout, Rect, check_range},
    moon::{moon_illumination, moon_points},
    table::{Landscape, TableGrid},
};

const HEAD_H: f64 = 4.0; // mm，星期表头行高
const PAD: f64 = 0.2; // mm，日期距格边
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
        MonthSpan::parse("月历", &self.start_month, self.months)?;
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

    pub(crate) fn draw(&self, canvas: &mut Canvas<'_>, layout: &PageLayout, context: &PageContext) {
        let Ok(span) = MonthSpan::parse("月历", &self.start_month, self.months) else {
            return;
        };
        let Some(&first) = span.firsts().get(context.local_index) else {
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
        let land_map = Landscape::new(body);

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

        self.draw_grid(canvas, &g, land_map);
        for (column, header) in weekday_headers(&self.weekday_headers).iter().enumerate() {
            let (x, y) = land_map.point(
                g.land.x + g.cell_w * (column as f64 + 0.5),
                g.land.y + HEAD_H / 2.0,
            );
            canvas.text(x, y, header, &line_style, "center", 90);
        }
        let (title_x, title_y) = land_map.point(body.height / 2.0, body.width / 16.0);
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
            let (x, y) = land_map.point(
                g.land.x + g.cell_w * column as f64 + PAD,
                g.gy + g.cell_h * row as f64 + PAD,
            );
            canvas.text(x, y, &day.to_string(), &text_style, "north west", 90);
            if self.show_phase {
                self.draw_phase(canvas, &g, column, row, date, land_map);
            }
        }
    }

    /// 7 列周网格；格线原语与月打卡共用。
    fn draw_grid(&self, canvas: &mut Canvas<'_>, g: &MonthLayout, land_map: Landscape) {
        let mut columns = [0.0; 8];
        for (index, column) in columns.iter_mut().enumerate() {
            *column = g.land.x + g.cell_w * index as f64;
        }
        TableGrid {
            columns: &columns,
            top: g.gy,
            row_height: g.cell_h,
            rows: g.rows,
        }
        .draw(canvas, self.line_width_pt, &self.line_color, land_map);
    }

    /// 右上角圆形月相：直径与日期字号同大。
    fn draw_phase(
        &self,
        canvas: &mut Canvas<'_>,
        g: &MonthLayout,
        column: usize,
        row: usize,
        date: Date,
        land_map: Landscape,
    ) {
        let radius = self.date_size_pt * MM_PER_PT / 2.0;
        let cx = g.land.x + g.cell_w * (column as f64 + 1.0) - PAD - radius - MOON_INSET;
        let cy = g.gy + g.cell_h * row as f64 + PAD + radius + MOON_INSET;
        let (illumination, waxing) = moon_illumination(date);
        let points = moon_points(cx, cy, radius, illumination, waxing)
            .into_iter()
            .map(|(x, y)| land_map.point(x, y))
            .collect::<Vec<_>>();
        canvas.filled_path(&points, &self.phase_color);
        let (x, y) = land_map.point(cx, cy);
        canvas.circle(x, y, radius, self.line_width_pt, &self.phase_color);
    }
}
