//! 一日时间轴：时刻沿页心纵向排布，小时号贴装订侧，整点刻线向外侧延伸成点线。
//!
//! 移植自 archive 分支 `backend/daily_timeline.rs` 的版式，并按当前框架的约定重写：
//! 字号直接使用 pt（不再按页高缩放），一天两页时按页序拆分前/后半日，
//! 整点外的点线用 TikZ 虚线一次画出（不再逐点输出），昼夜着色用数值 UTC 偏移
//! 代替时区数据库。

use serde::{Deserialize, Serialize};

use super::{
    calendar::{Date, WeekdayLang, format_date, validate_format},
    common::check_text_len,
    components::TextStyle,
    document::PageContext,
    latex::{Canvas, validate_color},
    layout::{PageLayout, Side, check_range},
};

/// 一日最多 30 个整点：允许把一天延到次日清晨。
const HOUR_MAX: u32 = 30;
/// 全书页数上限；一天两页时可用天数减半。
const PAGES_MAX: usize = 999;
/// TeX pt（1/72.27in）换算成毫米。
const MM_PER_PT: f64 = 25.4 / 72.27;

/// 太阳高度角低于该值（含大气折射）即视为夜间。
const SUNRISE_ELEVATION: f64 = -0.833;

/// 可选的昼夜着色：给定地点与本地时间偏移，按太阳高度角切换刻线颜色。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct SunWindow {
    pub latitude: f64,
    pub longitude: f64,
    /// 本地时间相对 UTC 的偏移（小时）；UTC+8 为 8，含半小时时区可用 5.5。
    /// 不处理夏令时，需要时使用者按当季偏移填写。
    pub utc_offset_hours: f64,
    pub daylight_color: String,
    pub night_color: String,
}

impl Default for SunWindow {
    fn default() -> Self {
        Self {
            latitude: 31.23,
            longitude: 121.47,
            utc_offset_hours: 8.0,
            daylight_color: "#E5B93F".into(),
            night_color: "#496A9F".into(),
        }
    }
}

impl SunWindow {
    fn validate(&self) -> Result<(), String> {
        check_range("时间轴纬度", self.latitude, -90.0, 90.0)?;
        check_range("时间轴经度", self.longitude, -180.0, 180.0)?;
        check_range(
            "时间轴 UTC 偏移（小时）",
            self.utc_offset_hours,
            -14.0,
            14.0,
        )?;
        validate_color(&self.daylight_color)?;
        validate_color(&self.night_color)
    }

    fn is_daylight(&self, date: Date, minute: u32) -> bool {
        // 本地日期 00:00 的 UTC 秒，加上当天分钟数。
        let unix_seconds = date.ordinal() as f64 * 86_400.0 + f64::from(minute) * 60.0
            - self.utc_offset_hours * 3600.0;
        solar_elevation(self.latitude, self.longitude, unix_seconds) > SUNRISE_ELEVATION
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct DailyPattern {
    /// 起始日期（YYYY-MM-DD），每天一页或两页，逐日推进。
    pub start_date: String,
    /// 结束日期（含当天）。
    pub end_date: String,
    /// 当日时间轴的起始整点，0–30；大于 24 表示延续到次日。
    pub start_hour: u32,
    /// 当日时间轴的结束整点，必须大于起始且不超过 30。
    pub end_hour: u32,
    /// 每天占几页：1 = 全天一页；2 = 前半天 / 后半天各一页。
    pub pages_per_day: u32,
    pub line_color: String,
    pub line_width_pt: f64,
    /// 小时号字号；标题取它的 1.5 倍。
    pub label_size_pt: f64,
    /// 每页顶部日期标题格式。
    pub title_format: String,
    /// `%a` 使用的星期短名语言。
    pub weekday_lang: WeekdayLang,
    /// None 表示不按昼夜着色，全部使用 line_color。
    pub sun: Option<SunWindow>,
}

impl Default for DailyPattern {
    fn default() -> Self {
        Self {
            start_date: "2026-08-31".into(),
            end_date: "2026-08-31".into(),
            start_hour: 0,
            end_hour: 24,
            pages_per_day: 1,
            line_color: "#7A7A7A".into(),
            line_width_pt: 0.4,
            label_size_pt: 10.2,
            title_format: "%Y年%-m月%-d日".into(),
            weekday_lang: WeekdayLang::Zh,
            sun: None,
        }
    }
}

impl DailyPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        let (start, end) = self.dates()?;
        if !matches!(self.pages_per_day, 1 | 2) {
            return Err("每日页数必须是 1 或 2".into());
        }
        let days = (end.ordinal() - start.ordinal() + 1) as usize;
        if days * self.pages_per_day as usize > PAGES_MAX {
            return Err(format!("一日时间轴最多 {PAGES_MAX} 页"));
        }
        if self.end_hour > HOUR_MAX || self.end_hour <= self.start_hour {
            return Err(format!(
                "时间轴的起止整点必须满足 0 ≤ 起始 < 结束 ≤ {HOUR_MAX}"
            ));
        }
        if self.pages_per_day == 2 && self.end_hour - self.start_hour < 2 {
            return Err("一天两页时时间跨度至少为 2 小时".into());
        }
        check_range("时间轴线宽（pt）", self.line_width_pt, 0.01, 10.0)?;
        check_range("时间轴字号（pt）", self.label_size_pt, 1.0, 72.0)?;
        check_text_len("时间轴标题格式", &self.title_format)?;
        validate_format(&self.title_format)?;
        validate_color(&self.line_color)?;
        if let Some(sun) = &self.sun {
            sun.validate()?;
        }
        Ok(())
    }

    fn dates(&self) -> Result<(Date, Date), String> {
        let start = Date::parse(&self.start_date)?;
        let end = Date::parse(&self.end_date)?;
        if end < start {
            return Err("时间轴结束日期必须晚于或等于开始日期".into());
        }
        Ok((start, end))
    }

    /// 页数 = 起止日天数 × 每天页数。
    pub(crate) fn required_pages(&self) -> usize {
        let Ok((start, end)) = self.dates() else {
            return 0;
        };
        let days = (end.ordinal() - start.ordinal() + 1) as usize;
        days * self.pages_per_day.max(1) as usize
    }

    pub(crate) fn draw(&self, canvas: &mut Canvas<'_>, layout: &PageLayout, context: &PageContext) {
        let Ok((start_date, _)) = self.dates() else {
            return;
        };
        let per_day = self.pages_per_day.max(1) as usize;
        let date = start_date.add_days((context.local_index / per_day) as i64);
        let (from, to) = self.hours_for(context.local_index, per_day);
        self.draw_page(canvas, layout, date, from, to);
    }

    /// 一天两页时按页序拆成前半天与后半天；不再依赖装订侧猜左右页。
    fn hours_for(&self, local_index: usize, per_day: usize) -> (u32, u32) {
        if per_day == 1 {
            return (self.start_hour, self.end_hour);
        }
        let mid = self.start_hour + (self.end_hour - self.start_hour) / 2;
        if local_index.is_multiple_of(2) {
            (self.start_hour, mid)
        } else {
            (mid, self.end_hour)
        }
    }

    fn draw_page(
        &self,
        canvas: &mut Canvas<'_>,
        layout: &PageLayout,
        date: Date,
        from: u32,
        to: u32,
    ) {
        let body = layout.body;
        let m = self.label_size_pt * MM_PER_PT;
        let title_size = 1.5 * self.label_size_pt;
        let title_band = 1.15 * title_size * MM_PER_PT;
        let title_gap = 0.50 * title_size * MM_PER_PT;
        // 首尾整点号以中心对齐刻度，上下各让出半个字号，避免贴到页心边缘被裁掉。
        let label_half = m / 2.0;
        let axis_top = body.y + title_band + title_gap + label_half;
        let timeline_height = (body.height - title_band - title_gap - m).max(0.0);
        let span = f64::from(to - from);
        let hour_height = if span > 0.0 {
            timeline_height / span
        } else {
            0.0
        };

        // 日期标题贴外侧页心边缘，与贴装订侧的小时号带镜像。
        let (title_x, title_anchor) = if layout.binding_side == Side::Left {
            (body.x + body.width - 1.0, "south east")
        } else {
            (body.x + 1.0, "south west")
        };
        canvas.text(
            title_x,
            body.y + title_band,
            &format_date(date, &self.title_format, self.weekday_lang),
            &TextStyle {
                size_pt: title_size,
                color: self.line_color.clone(),
            },
            title_anchor,
            0,
        );
        if hour_height <= 0.0 {
            return;
        }

        // 小时号带贴装订侧；刻度与点线朝外侧页心边缘铺开。
        let axis = if layout.binding_side == Side::Left {
            body.x
        } else {
            body.x + body.width
        };
        let direction = if layout.binding_side == Side::Left {
            1.0
        } else {
            -1.0
        };
        let outer = if layout.binding_side == Side::Left {
            body.x + body.width
        } else {
            body.x
        };
        let label_width = m;
        let band = axis + direction * (label_width + 1.0);
        let major_tick = 1.90 * m;
        let half_tick = 0.83 * m;
        let quarter_tick = 0.42 * m;

        let mut segments: Vec<(&str, Segment)> = Vec::new();
        let mut dotted: Vec<(&str, Segment)> = Vec::new();
        for hour in from..=to {
            let y = axis_top + f64::from(hour - from) * hour_height;
            let color = self.color_at(date, hour * 60);
            let tick = band + direction * major_tick;
            segments.push((color, (band, y, tick, y)));
            // 整点后的点线以每半小时为间距铺到外侧页心边缘。
            let (x1, x2) = if direction > 0.0 {
                (tick, outer)
            } else {
                (outer, tick)
            };
            dotted.push((color, (x1, y, x2, y)));

            let label = hour_label(hour);
            canvas.text(
                axis + direction * (label_width / 2.0 + 0.5),
                y,
                &label,
                &TextStyle {
                    size_pt: self.label_size_pt,
                    color: color.into(),
                },
                "center",
                0,
            );

            if hour < to {
                let half_y = y + hour_height / 2.0;
                segments.push((
                    self.color_at(date, hour * 60 + 30),
                    (band, half_y, band + direction * half_tick, half_y),
                ));
                let quarter_y = y + hour_height / 4.0;
                segments.push((
                    self.color_at(date, hour * 60 + 15),
                    (band, quarter_y, band + direction * quarter_tick, quarter_y),
                ));
                let three_quarter_y = y + hour_height * 3.0 / 4.0;
                segments.push((
                    self.color_at(date, hour * 60 + 45),
                    (
                        band,
                        three_quarter_y,
                        band + direction * quarter_tick,
                        three_quarter_y,
                    ),
                ));
            }
        }
        draw_segments(canvas, self.line_width_pt, segments);
        draw_dotted_segments(canvas, self.line_width_pt, dotted, hour_height / 2.0);
    }

    fn color_at(&self, date: Date, minute: u32) -> &str {
        match &self.sun {
            Some(sun) if sun.is_daylight(date, minute) => &sun.daylight_color,
            Some(sun) => &sun.night_color,
            None => &self.line_color,
        }
    }
}

/// 线段在页面坐标中的 (x1, y1, x2, y2)。
type Segment = (f64, f64, f64, f64);

/// 按颜色分组，保留首次出现的顺序；昼/夜最多两种颜色。
fn batch_by_color(segments: Vec<(&str, Segment)>) -> Vec<(&str, Vec<Segment>)> {
    let mut batches: Vec<(&str, Vec<Segment>)> = Vec::new();
    for (color, segment) in segments {
        match batches.iter_mut().find(|(batch, _)| *batch == color) {
            Some((_, batch)) => batch.push(segment),
            None => batches.push((color, vec![segment])),
        }
    }
    batches
}

/// 同色同线宽的实线合并成一条 TikZ 路径。
fn draw_segments(canvas: &mut Canvas<'_>, width_pt: f64, segments: Vec<(&str, Segment)>) {
    for (color, batch) in batch_by_color(segments) {
        canvas.line_batch(&batch, width_pt, color);
    }
}

/// 点线按颜色分批，每批共用一次线宽与 dash pattern。
fn draw_dotted_segments(
    canvas: &mut Canvas<'_>,
    width_pt: f64,
    segments: Vec<(&str, Segment)>,
    spacing: f64,
) {
    for (color, batch) in batch_by_color(segments) {
        canvas.line_dotted_batch(&batch, width_pt, color, spacing);
    }
}

/// 24 点写成 24，超过 24 点的夜猫子时段回绕成 01–06。
fn hour_label(hour: u32) -> String {
    let hour = if hour > 24 { hour - 24 } else { hour };
    format!("{hour:02}")
}

/// 太阳高度角（度）。公式与 archive 分支一致，输入为 Unix 秒。
fn solar_elevation(latitude: f64, longitude: f64, unix_seconds: f64) -> f64 {
    let julian_day = unix_seconds / 86_400.0 + 2_440_587.5;
    let t = (julian_day - 2_451_545.0) / 36_525.0;
    let mean_longitude = (280.46646 + t * (36000.76983 + t * 0.0003032)).rem_euclid(360.0);
    let mean_anomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
    let center = mean_anomaly.to_radians().sin() * (1.914602 - t * (0.004817 + 0.000014 * t))
        + (2.0 * mean_anomaly).to_radians().sin() * (0.019993 - 0.000101 * t)
        + (3.0 * mean_anomaly).to_radians().sin() * 0.000289;
    let omega = 125.04 - 1934.136 * t;
    let apparent_longitude = mean_longitude + center - 0.00569 - 0.00478 * omega.to_radians().sin();
    let obliquity = 23.0
        + (26.0 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60.0) / 60.0
        + 0.00256 * omega.to_radians().cos();
    let declination = (obliquity.to_radians().sin() * apparent_longitude.to_radians().sin()).asin();
    let y = (obliquity.to_radians() / 2.0).tan().powi(2);
    let equation_of_time = 4.0
        * (y * (2.0 * mean_longitude).to_radians().sin()
            - 2.0 * 0.016708634 * mean_anomaly.to_radians().sin()
            + 4.0
                * 0.016708634
                * y
                * mean_anomaly.to_radians().sin()
                * (2.0 * mean_longitude).to_radians().cos()
            - 0.5 * y * y * (4.0 * mean_longitude).to_radians().sin()
            - 1.25 * 0.016708634_f64.powi(2) * (2.0 * mean_anomaly).to_radians().sin())
        .to_degrees();
    let utc_minutes = unix_seconds.rem_euclid(86_400.0) / 60.0;
    let hour_angle =
        (utc_minutes + equation_of_time + 4.0 * longitude).rem_euclid(1440.0) / 4.0 - 180.0;
    let latitude = latitude.to_radians();
    (latitude.sin() * declination.sin()
        + latitude.cos() * declination.cos() * hour_angle.to_radians().cos())
    .asin()
    .to_degrees()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn solar_elevation_matches_shanghai_reference() {
        let date = Date::parse("2026-08-31").unwrap();
        let noon = date.ordinal() as f64 * 86_400.0 + 12.0 * 3600.0 - 8.0 * 3600.0;
        let midnight = date.ordinal() as f64 * 86_400.0 - 8.0 * 3600.0;
        assert!((solar_elevation(31.23, 121.47, noon) - 67.38).abs() < 0.5);
        assert!(solar_elevation(31.23, 121.47, midnight) < -40.0);
    }

    #[test]
    fn hour_labels_wrap_after_midnight_but_keep_24() {
        assert_eq!(hour_label(0), "00");
        assert_eq!(hour_label(9), "09");
        assert_eq!(hour_label(24), "24");
        assert_eq!(hour_label(25), "01");
        assert_eq!(hour_label(30), "06");
    }

    #[test]
    fn two_page_day_splits_hours_in_reading_order() {
        let p = DailyPattern {
            pages_per_day: 2,
            ..Default::default()
        };
        assert_eq!(p.hours_for(0, 2), (0, 12));
        assert_eq!(p.hours_for(1, 2), (12, 24));
        assert_eq!(p.hours_for(2, 2), (0, 12));
    }
}
