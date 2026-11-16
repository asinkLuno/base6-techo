//! 年历：一页排 `rows × cols` 个迷你月历，跨年浏览。
//!
//! 移植自 archive 分支 `backend/year.rs`：分页按每页 `rows × cols` 个月连续切块，
//! 单元格内是「月份标题 + 星期表头 + 日期」的无框迷你月历。
//! 节假日来自文档级 `holidays`（`YYYY-MM-DD` → 名称，通常由 iCal 导入），
//! 开启 `show_holidays` 时节假日与周末日期改用节日色。农历未移植。

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::{
    calendar::{Date, MonthGrid, MonthSpan, WeekdayLang, format_date, validate_format},
    common::{check_text_len, validate_weekday_headers, weekday_headers},
    document::PageContext,
    latex::{Canvas, validate_color},
    layout::{PageLayout, Rect, check_range},
};

/// 行列数上限：一年 12 个月，再大的网格只会留下空格。
const GRID_MAX: usize = 12;
/// 单元格内边距，mm。
const CELL_PAD: f64 = 1.5;
/// 一个月份最多跨 6 周；行高按 6 周固定，跨页同行才能对齐。
const WEEK_ROWS_MAX: usize = 6;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct YearPattern {
    /// 起始月份（YYYY-MM）。
    pub start_month: String,
    /// 连续月份数；页数由它和网格容量推导。
    pub months: usize,
    /// 每页月份行数。
    pub rows: usize,
    /// 每页月份列数。
    pub cols: usize,
    /// 月份标题格式；支持 `%Y`、`%m`、`%-m`、`%d`、`%-d`、`%a` 与 `%%`。
    pub title_format: String,
    /// `%a` 使用的星期短名语言。
    pub weekday_lang: WeekdayLang,
    /// 星期表头，英文逗号分隔 7 项。
    pub weekday_headers: String,
    /// 单元格边框线颜色。
    pub line_color: String,
    /// 日期与标题的普通文字颜色。
    pub text_color: String,
    /// 节假日与周末颜色；仅在 `show_holidays` 开启时使用。
    pub holiday_color: String,
    pub line_width_pt: f64,
    pub date_size_pt: f64,
    /// 是否用节日色标出节假日（以及周末）。
    pub show_holidays: bool,
}

impl Default for YearPattern {
    fn default() -> Self {
        Self {
            start_month: "2027-01".into(),
            months: 12,
            rows: 3,
            cols: 4,
            title_format: "%Y年%-m月".into(),
            weekday_lang: WeekdayLang::Zh,
            weekday_headers: "一,二,三,四,五,六,日".into(),
            line_color: "#B0B0B0".into(),
            text_color: "#000000".into(),
            holiday_color: "#D96A6A".into(),
            line_width_pt: 0.2,
            date_size_pt: 5.0,
            show_holidays: true,
        }
    }
}

impl YearPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        MonthSpan::parse("年历", &self.start_month, self.months)?;
        check_range("年历行数", self.rows as f64, 1.0, GRID_MAX as f64)?;
        check_range("年历列数", self.cols as f64, 1.0, GRID_MAX as f64)?;
        check_range("年历线宽（pt）", self.line_width_pt, 0.01, 10.0)?;
        check_range("年历日期字号（pt）", self.date_size_pt, 1.0, 72.0)?;
        validate_color(&self.line_color)?;
        validate_color(&self.text_color)?;
        validate_color(&self.holiday_color)?;
        check_text_len("年历标题格式", &self.title_format)?;
        validate_weekday_headers(&self.weekday_headers)?;
        validate_format(&self.title_format)
    }

    /// 每页容纳 `rows × cols` 个月，页数向上取整。
    pub(crate) fn required_pages(&self) -> usize {
        let per = self.rows.max(1) * self.cols.max(1);
        self.months.div_ceil(per)
    }

    pub(crate) fn draw(
        &self,
        canvas: &mut Canvas<'_>,
        layout: &PageLayout,
        context: &PageContext,
        holidays: &BTreeMap<String, String>,
    ) {
        let Ok(span) = MonthSpan::parse("年历", &self.start_month, self.months) else {
            return;
        };
        let firsts = span.firsts();
        let rows = self.rows.max(1);
        let cols = self.cols.max(1);
        let per = rows * cols;
        let start = context.local_index.saturating_mul(per);
        let Some(page_months) = firsts.get(start..) else {
            return;
        };
        let body = layout.body;
        let cell_w = body.width / cols as f64;
        let cell_h = body.height / rows as f64;
        if cell_w <= 0.0 || cell_h <= 0.0 {
            return;
        }
        for (slot, first) in page_months.iter().take(per).enumerate() {
            let cell = Rect {
                x: body.x + cell_w * (slot % cols) as f64,
                y: body.y + cell_h * (slot / cols) as f64,
                width: cell_w,
                height: cell_h,
            };
            self.draw_frame(canvas, cell);
            self.draw_month(canvas, cell, *first, holidays);
        }
    }

    /// 单元格细边框，复用 `line_color` / `line_width_pt`。
    fn draw_frame(&self, canvas: &mut Canvas<'_>, cell: Rect) {
        let segments = [
            (cell.x, cell.y, cell.x + cell.width, cell.y),
            (
                cell.x,
                cell.y + cell.height,
                cell.x + cell.width,
                cell.y + cell.height,
            ),
            (cell.x, cell.y, cell.x, cell.y + cell.height),
            (
                cell.x + cell.width,
                cell.y,
                cell.x + cell.width,
                cell.y + cell.height,
            ),
        ];
        canvas.line_batch(&segments, self.line_width_pt, &self.line_color);
    }

    /// 单元格内的迷你月历：标题行 + 星期表头行 + 日期行，无内部格线。
    fn draw_month(
        &self,
        canvas: &mut Canvas<'_>,
        cell: Rect,
        first: Date,
        holidays: &BTreeMap<String, String>,
    ) {
        let grid = MonthGrid::new(first);
        let cell_w = (cell.width - 2.0 * CELL_PAD) / 7.0;
        // 标题行 + 星期表头 + 固定 6 周：月份周数不同也不影响同行对齐。
        let cell_h = (cell.height - 2.0 * CELL_PAD) / (WEEK_ROWS_MAX + 2) as f64;
        if cell_w <= 0.0 || cell_h <= 0.0 {
            return;
        }
        let text_style = super::components::TextStyle {
            size_pt: self.date_size_pt,
            color: self.text_color.clone(),
        };
        let holiday_style = super::components::TextStyle {
            size_pt: self.date_size_pt,
            color: self.holiday_color.clone(),
        };
        let place = |canvas: &mut Canvas<'_>,
                     content: &str,
                     column: f64,
                     row: usize,
                     style: &super::components::TextStyle| {
            canvas.text(
                cell.x + CELL_PAD + cell_w * (column + 0.5),
                cell.y + CELL_PAD + cell_h * (row as f64 + 0.5),
                content,
                style,
                "center",
                0,
            );
        };
        place(
            canvas,
            &format_date(first, &self.title_format, self.weekday_lang),
            3.0,
            0,
            &text_style,
        );
        for (column, header) in weekday_headers(&self.weekday_headers).iter().enumerate() {
            place(canvas, header, column as f64, 1, &text_style);
        }
        for day in 1..=grid.days {
            let date = first.add_days(day as i64 - 1);
            let (column, row) = grid.position(day);
            let marked =
                self.show_holidays && (date.weekday() >= 5 || holidays.contains_key(&iso(date)));
            let style = if marked { &holiday_style } else { &text_style };
            place(
                canvas,
                &date.day().to_string(),
                column as f64,
                row + 2,
                style,
            );
        }
    }
}

/// `YYYY-MM-DD`，与 `holidays` 的键一致。
fn iso(date: Date) -> String {
    format!("{:04}-{:02}-{:02}", date.year(), date.month(), date.day())
}
