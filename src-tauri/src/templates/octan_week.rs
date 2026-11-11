//! 八分周视图：每页四格，两周共四页；空白格放当月与次月迷你月历。
//!
//! 移植自 archive 分支的 `backend/octan_week.rs`。当前框架没有农历与节假日
//! 数据源，因此只保留周视图本身：整周日期、迷你月历、本周高亮与月相。

use serde::{Deserialize, Serialize};

use super::{
    calendar::{Date, MonthGrid, WeekdayLang, format_date, validate_format},
    common::{check_text_len, validate_weekday_headers, weekday_headers},
    document::PageContext,
    latex::{Canvas, validate_color},
    layout::{PageLayout, Rect, check_range},
    moon::{draw_moon, moon_illumination, moon_outline},
};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LineStyle {
    #[default]
    Solid,
    Dashed,
    Dotted,
    DashDot,
}

impl LineStyle {
    fn tikz(self) -> &'static str {
        match self {
            Self::Solid => "solid",
            Self::Dashed => "dashed",
            Self::Dotted => "dotted",
            Self::DashDot => "dash dot",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct OctanWeekPattern {
    /// 整周起点，必须是周一（YYYY-MM-DD）。
    pub start_date: String,
    /// 整周终点，必须是周日（YYYY-MM-DD）。
    pub end_date: String,
    /// 格子日期格式；支持 `%Y`、`%m`、`%-m`、`%d`、`%-d`、`%a` 与 `%%`。
    pub date_format: String,
    /// `%a` 使用的星期短名语言。
    pub weekday_lang: WeekdayLang,
    /// 迷你月历月份标题格式，指令同 `date_format`。
    pub title_format: String,
    /// 迷你月历星期表头，英文逗号分隔 7 项。
    pub weekday_headers: String,
    pub line_color: String,
    /// 迷你月历的普通文字颜色。
    pub text_color: String,
    /// 迷你月历里当周日期的高亮颜色。
    pub highlight_color: String,
    pub phase_color: String,
    pub line_width_pt: f64,
    pub line_style: LineStyle,
    /// 中心十字线留出的空隙（mm）。
    pub center_gap_mm: f64,
    pub date_size_pt: f64,
}

impl Default for OctanWeekPattern {
    fn default() -> Self {
        Self {
            start_date: "2026-08-03".into(),
            end_date: "2026-08-09".into(),
            date_format: "%-d".into(),
            weekday_lang: WeekdayLang::Zh,
            title_format: "%Y年%-m月".into(),
            weekday_headers: "一,二,三,四,五,六,日".into(),
            line_color: "#7A7A7A".into(),
            text_color: "#000000".into(),
            highlight_color: "#8B0000".into(),
            phase_color: "#E5B93F".into(),
            line_width_pt: 0.4,
            line_style: LineStyle::Solid,
            center_gap_mm: 2.0,
            date_size_pt: 10.0,
        }
    }
}

impl OctanWeekPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        let start = Date::parse(&self.start_date)?;
        let end = Date::parse(&self.end_date)?;
        if end < start {
            return Err("结束日期必须晚于或等于开始日期".into());
        }
        if start.weekday() != 0 {
            return Err("开始日期必须是星期一".into());
        }
        if end.weekday() != 6 {
            return Err("结束日期必须是星期日".into());
        }
        check_range("八分周视图线宽（pt）", self.line_width_pt, 0.01, 10.0)?;
        check_range("八分周视图日期字号（pt）", self.date_size_pt, 1.0, 72.0)?;
        check_range("八分周视图中心留白（mm）", self.center_gap_mm, 0.0, 1000.0)?;
        validate_color(&self.line_color)?;
        validate_color(&self.text_color)?;
        validate_color(&self.highlight_color)?;
        validate_color(&self.phase_color)?;
        check_text_len("八分周视图日期格式", &self.date_format)?;
        check_text_len("八分周视图月份格式", &self.title_format)?;
        validate_weekday_headers(&self.weekday_headers)?;
        validate_format(&self.date_format)?;
        validate_format(&self.title_format)
    }

    /// 起止日期已由 validate 保证为周一与周日。
    pub(crate) fn weeks(&self) -> Vec<(Date, Date)> {
        let (Ok(start), Ok(end)) = (Date::parse(&self.start_date), Date::parse(&self.end_date))
        else {
            return Vec::new();
        };
        if end < start {
            return Vec::new();
        }
        let count = ((end.ordinal() - start.ordinal()) / 7 + 1) as usize;
        (0..count)
            .map(|w| {
                let first = start.add_days(7 * w as i64);
                (first, first.add_days(6))
            })
            .collect()
    }

    pub(crate) fn required_pages(&self) -> usize {
        self.weeks().len() * 2
    }

    pub(crate) fn draw(&self, canvas: &mut Canvas<'_>, layout: &PageLayout, context: &PageContext) {
        let body = layout.body;
        let (cx, cy) = body.center();
        let gap = self.center_gap_mm;
        let style = self.line_style.tikz();
        let line = |canvas: &mut Canvas<'_>, x1, y1, x2, y2| {
            canvas.line_styled(x1, y1, x2, y2, self.line_width_pt, &self.line_color, style);
        };
        // 中心留空后向四边画线，不画外框。
        line(canvas, cx, cy - gap, cx, body.y);
        line(canvas, cx, cy + gap, cx, body.y + body.height);
        line(canvas, cx - gap, cy, body.x, cy);
        line(canvas, cx + gap, cy, body.x + body.width, cy);
        canvas.dot(cx, cy, 0.5, &self.line_color);

        let weeks = self.weeks();
        let Some(&(week_start, week_end)) = weeks.get(context.local_index / 2) else {
            return;
        };
        // 第 1、3、5… 页画空 / 周一 / 周四 / 周五，第 2、4、6… 页画周二 / 周三 / 周六 / 周日。
        let offsets: [Option<i64>; 4] = if context.local_index.is_multiple_of(2) {
            [None, Some(0), Some(3), Some(4)]
        } else {
            [Some(1), Some(2), Some(5), Some(6)]
        };
        if context.local_index.is_multiple_of(2) {
            self.draw_mini_calendar(
                canvas,
                Rect {
                    x: body.x,
                    y: body.y,
                    width: body.width / 2.0,
                    height: body.height / 2.0,
                },
                week_start,
                week_end,
            );
        }
        let date_style = super::components::TextStyle {
            size_pt: self.date_size_pt,
            color: self.line_color.clone(),
        };
        for (slot, offset) in offsets.into_iter().enumerate() {
            let Some(offset) = offset else { continue };
            let x = body.x + (slot % 2) as f64 * body.width / 2.0;
            let y = body.y + (slot / 2) as f64 * body.height / 2.0;
            let date = week_start.add_days(offset);
            canvas.text(
                x + 2.0,
                y + 2.0,
                &format_date(date, &self.date_format, self.weekday_lang),
                &date_style,
                "north west",
                0,
            );
            // 月相：直径与日期字号同大，右边距 4mm，上沿与日期字面同高。
            let diameter = self.date_size_pt * 25.4 / 72.27;
            let radius = diameter / 2.0;
            let (illumination, waxing) = moon_illumination(date);
            let moon_x = x + body.width / 2.0 - 4.0 - radius;
            let moon_y = y + 2.0 + radius;
            let outline = moon_outline(moon_x, moon_y, radius, illumination, waxing);
            draw_moon(canvas, &outline, &self.phase_color);
            canvas.circle(
                moon_x,
                moon_y,
                radius,
                self.line_width_pt,
                &self.phase_color,
            );
        }
    }

    /// 空白格（左上象限）上下画两个月：本周所在月与次月。
    fn draw_mini_calendar(
        &self,
        canvas: &mut Canvas<'_>,
        quad: Rect,
        week_start: Date,
        week_end: Date,
    ) {
        let first = week_start.month_first();
        let next = first.next_month_first();
        let half = quad.height / 2.0;
        self.push_one_month(
            canvas,
            Rect {
                y: quad.y,
                height: half,
                ..quad
            },
            first,
            week_start,
            week_end,
        );
        self.push_one_month(
            canvas,
            Rect {
                y: quad.y + half,
                height: half,
                ..quad
            },
            next,
            week_start,
            week_end,
        );
    }

    /// 单个月历：月份标题 + 星期表头 + 日期（周一为首 7 列，无框线），
    /// 当周日期用高亮色，其余用文字色。
    fn push_one_month(
        &self,
        canvas: &mut Canvas<'_>,
        rect: Rect,
        first: Date,
        week_start: Date,
        week_end: Date,
    ) {
        const MINI_PAD: f64 = 2.0;
        let grid = MonthGrid::new(first);
        let cell_w = (rect.width - 2.0 * MINI_PAD) / 7.0;
        let cell_h = (rect.height - 2.0 * MINI_PAD) / (grid.rows + 2) as f64;
        if cell_w <= 0.0 || cell_h <= 0.0 {
            return;
        }
        let size = self.date_size_pt * 0.7;
        let text =
            |canvas: &mut Canvas<'_>, content: &str, column: f64, row: usize, color: &str| {
                canvas.text(
                    rect.x + MINI_PAD + cell_w * (column + 0.5),
                    rect.y + MINI_PAD + cell_h * (row as f64 + 0.5),
                    content,
                    &super::components::TextStyle {
                        size_pt: size,
                        color: color.into(),
                    },
                    "center",
                    0,
                );
            };
        text(
            canvas,
            &format_date(first, &self.title_format, self.weekday_lang),
            3.0,
            0,
            &self.text_color,
        );
        for (column, header) in weekday_headers(&self.weekday_headers).iter().enumerate() {
            text(canvas, header, column as f64, 1, &self.text_color);
        }
        for day in 1..=grid.days {
            let date = first.add_days(day as i64 - 1);
            let (column, row) = grid.position(day);
            let color = if date >= week_start && date <= week_end {
                &self.highlight_color
            } else {
                &self.text_color
            };
            text(
                canvas,
                &date.day().to_string(),
                column as f64,
                row + 2,
                color,
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pattern(start: &str, end: &str) -> OctanWeekPattern {
        OctanWeekPattern {
            start_date: start.into(),
            end_date: end.into(),
            ..Default::default()
        }
    }

    #[test]
    fn weeks_enumerates_every_monday_to_sunday() {
        let p = pattern("2026-08-03", "2026-08-16");
        let weeks = p.weeks();
        assert_eq!(weeks.len(), 2);
        assert_eq!(weeks[0].0.to_iso(), "2026-08-03");
        assert_eq!(weeks[0].1.to_iso(), "2026-08-09");
        assert_eq!(weeks[1].0.to_iso(), "2026-08-10");
        assert_eq!(p.required_pages(), 4);
    }

    #[test]
    fn validate_requires_monday_start_and_sunday_end() {
        assert_eq!(
            pattern("2026-08-04", "2026-08-09").validate().unwrap_err(),
            "开始日期必须是星期一"
        );
        assert_eq!(
            pattern("2026-08-03", "2026-08-08").validate().unwrap_err(),
            "结束日期必须是星期日"
        );
        assert!(pattern("2026-08-03", "2026-08-09").validate().is_ok());
    }
}
