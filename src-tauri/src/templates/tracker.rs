//! 月打卡：单月两段式打卡表。
//!
//! 移植自 archive 分支 `backend/month.rs` 的 `TrackerPattern`：上表 1–14 日
//! 带打卡项列，下表 15–月末；两表左缘用折线箭头逐行连接。整页横放设计后
//! 逆时针旋转 90°，格线缺口与月历共用 `table.rs`。年度追踪（跨月网格）不在
//! 本次范围内。

use serde::{Deserialize, Serialize};

use super::{
    calendar::{Date, MonthGrid, MonthSpan},
    components::TextStyle,
    document::PageContext,
    latex::{Canvas, validate_color},
    layout::{PageLayout, Rect, check_range},
    table::{Landscape, TableGrid},
};

/// 打卡项数上限：每页最多 30 行打卡项。
const ITEMS_MAX: usize = 30;
/// 打卡项列宽 = ITEM_W × 日期格宽。
const ITEM_W: f64 = 5.0;
/// 上下两表间距（mm）。
const TABLE_GAP: f64 = 2.0;
/// 整组表格上移量（mm）。
const TABLE_UP: f64 = 3.0;
/// 左侧连接箭头泳道宽度（mm）。
const ARROW_LANE: f64 = 6.0;
/// 箭头线宽沿用 TikZ 默认值，与 archive 一致。
const ARROW_WIDTH_PT: f64 = 0.4;
/// 日期距格边留白（mm）。
const DATE_PAD: f64 = 0.2;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct TrackerPattern {
    /// 起始月份（YYYY-MM）。
    pub start_month: String,
    /// 连续月份数；每页一个月，页数由它推导。
    pub months: usize,
    /// 每页打卡项行数。
    pub items: usize,
    pub line_color: String,
    pub line_width_pt: f64,
    pub date_size_pt: f64,
}

impl Default for TrackerPattern {
    fn default() -> Self {
        Self {
            start_month: "2026-08".into(),
            months: 1,
            items: 4,
            line_color: "#7A7A7A".into(),
            line_width_pt: 0.4,
            date_size_pt: 8.0,
        }
    }
}

impl TrackerPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        MonthSpan::parse("打卡", &self.start_month, self.months)?;
        if !(1..=ITEMS_MAX).contains(&self.items) {
            return Err(format!("打卡项数必须在 1–{ITEMS_MAX} 之间"));
        }
        check_range("打卡线宽（pt）", self.line_width_pt, 0.01, 10.0)?;
        check_range("打卡日期字号（pt）", self.date_size_pt, 1.0, 72.0)?;
        validate_color(&self.line_color)
    }

    /// 每月一页；页数由月份数推导。
    pub(crate) fn required_pages(&self) -> usize {
        self.months
    }

    pub(crate) fn draw(&self, canvas: &mut Canvas<'_>, layout: &PageLayout, context: &PageContext) {
        let Ok(span) = MonthSpan::parse("打卡", &self.start_month, self.months) else {
            return;
        };
        let Some(&first) = span.firsts().get(context.local_index) else {
            return;
        };
        self.draw_page(canvas, layout.body, first);
    }

    fn draw_page(&self, canvas: &mut Canvas<'_>, body: Rect, first: Date) {
        let days = MonthGrid::new(first).days as usize;
        let items = self.items;
        let rows = items + 1; // 表头行 + 打卡项行
        let count1 = days.min(14);
        let count2 = days - count1;
        let land = Rect {
            x: 0.0,
            y: 0.0,
            width: body.height,
            height: body.width,
        };
        let cols = (ITEM_W + count1 as f64).max(count2 as f64);
        let lane = if count2 > 0 { ARROW_LANE } else { 0.0 };
        let cell = ((land.width - lane) / cols)
            .min(if count2 > 0 {
                (land.height - TABLE_GAP) / (2.0 * rows as f64)
            } else {
                land.height / rows as f64
            })
            .max(0.8);
        let w1 = (ITEM_W + count1 as f64) * cell;
        let w2 = count2 as f64 * cell;
        let max_w = w1.max(w2);
        // 表在箭头泳道右侧的剩余宽度内居中。
        let left = land.x + lane + (land.width - lane - max_w) / 2.0;
        let table_h = rows as f64 * cell;
        let total = if count2 > 0 {
            2.0 * table_h + TABLE_GAP
        } else {
            table_h
        };
        let top1 = (land.y + (land.height - total) / 2.0 - TABLE_UP).max(land.y + 0.5);
        let top2 = top1 + table_h + TABLE_GAP;
        let land_map = Landscape::new(body);

        self.draw_table(
            canvas,
            land_map,
            TableSpec {
                left,
                top: top1,
                first_day: 1,
                days: count1,
                with_items: true,
                cell,
            },
        );
        if count2 > 0 {
            self.draw_table(
                canvas,
                land_map,
                TableSpec {
                    left,
                    top: top2,
                    first_day: 1 + count1 as u32,
                    days: count2,
                    with_items: false,
                    cell,
                },
            );
            // 打卡第 i 行：上表左缘 → 泳道左侧错开 → 下表左缘；表头行不连。
            for row in 1..rows {
                let yc1 = top1 + (row as f64 + 0.5) * cell;
                let yc2 = top2 + (row as f64 + 0.5) * cell;
                let xm = (left - 1.5 - row as f64 * 1.5).max(land.x + 0.8);
                let points = [(left - 0.4, yc1), (xm, yc1), (xm, yc2), (left - 0.4, yc2)]
                    .map(|(x, y)| land_map.point(x, y));
                canvas.arrow_path(&points, ARROW_WIDTH_PT, &self.line_color);
            }
        }
    }

    /// 一张打卡表：表头行（日期，锚在格右上）+ `items` 行空格；顶部不封口。
    fn draw_table(&self, canvas: &mut Canvas<'_>, land_map: Landscape, spec: TableSpec) {
        let mut columns = Vec::with_capacity(spec.days + 2);
        columns.push(spec.left);
        if spec.with_items {
            columns.push(spec.left + ITEM_W * spec.cell);
        }
        for _ in 0..spec.days {
            let next = columns.last().copied().unwrap_or(spec.left) + spec.cell;
            columns.push(next);
        }
        TableGrid {
            columns: &columns,
            top: spec.top + spec.cell,
            row_height: spec.cell,
            rows: self.items,
        }
        .draw(canvas, self.line_width_pt, &self.line_color, land_map);

        let style = TextStyle {
            size_pt: self.date_size_pt,
            color: self.line_color.clone(),
        };
        let offset = usize::from(spec.with_items);
        for index in 0..spec.days {
            let day = spec.first_day + index as u32;
            let (x, y) =
                land_map.point(columns[offset + index + 1], spec.top + spec.cell - DATE_PAD);
            canvas.text(x, y, &day.to_string(), &style, "south east", 90);
        }
    }
}

#[derive(Clone, Copy)]
struct TableSpec {
    left: f64,
    top: f64,
    first_day: u32,
    days: usize,
    with_items: bool,
    cell: f64,
}
