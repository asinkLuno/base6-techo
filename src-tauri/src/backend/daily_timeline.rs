use chrono::{Duration, NaiveDate, TimeZone, Timelike, Utc};
use chrono_tz::Tz;

use serde::Deserialize;

use super::{
    Dot, Geometry, Line, LineStyle, MM_PER_PT, Side, Text, format_date, validate_color,
    validate_title_format,
};

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct DailyTimelinePattern {
    pub(crate) start: i32,
    pub(crate) end: i32,
    /// 一日占几页：1 = 一日一页（全天一轴）；2 = 一日跨页两页，
    /// 摊开跨页左页画前半夜、右页画后半夜。
    pub(crate) pages: i32,
    pub(crate) line_color: String,
    pub(crate) line_width: f64,
    pub(crate) label_size: f64,
    #[serde(default)]
    pub(crate) latitude: Option<f64>,
    #[serde(default)]
    pub(crate) longitude: Option<f64>,
    #[serde(default)]
    pub(crate) timezone: Option<String>,
    pub(crate) daylight_color: String,
    pub(crate) night_color: String,
    #[serde(default)]
    pub(crate) start_date: Option<NaiveDate>,
    #[serde(default)]
    pub(crate) end_date: Option<NaiveDate>,
    /// 每页顶部日期标题格式，例如 "%Y年%-m月%-d日"。
    pub(crate) title_format: String,
}
#[cfg(test)]
impl Default for DailyTimelinePattern {
    fn default() -> Self {
        Self {
            start: 0,
            end: 24,
            pages: 1,
            line_color: "#7a7a7a".into(),
            line_width: 0.4 / MM_PER_PT,
            label_size: 10.2,
            latitude: None,
            longitude: None,
            timezone: None,
            daylight_color: "#e5b93f".into(),
            night_color: "#496a9f".into(),
            start_date: None,
            end_date: None,
            title_format: "%Y年%-m月%-d日".into(),
        }
    }
}
impl DailyTimelinePattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if !(0..30).contains(&self.start) || self.end <= self.start || self.end > 30 {
            return Err("timeline hours must satisfy 0 <= start < end <= 30".into());
        }
        let (Some(start_date), Some(end_date)) = (self.start_date, self.end_date) else {
            return Err("timeline start_date and end_date are required".into());
        };
        if end_date < start_date {
            return Err("timeline start_date must be <= end_date".into());
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
        validate_title_format(&self.title_format, "zh-CN", false)?;
        validate_color(&self.night_color)
    }
    pub(crate) fn page_count(&self) -> usize {
        let days = (self.end_date.unwrap() - self.start_date.unwrap()).num_days() + 1;
        usize::try_from(days).unwrap_or(1) * self.pages as usize
    }
}

pub(crate) fn daily_timeline_color(
    p: &DailyTimelinePattern,
    date: Option<NaiveDate>,
    minute: i32,
) -> Option<String> {
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

pub(crate) fn solar_elevation(latitude: f64, longitude: f64, moment: chrono::DateTime<Utc>) -> f64 {
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

pub(crate) fn draw_daily_timeline(
    geo: Geometry,
    p: &DailyTimelinePattern,
    index: usize,
    font: &str,
) -> (Vec<Line>, Vec<Dot>, Vec<Text>) {
    let date = p
        .start_date
        .map(|start| start + Duration::days((index / p.pages as usize) as i64));
    let mid = (p.start + p.end) / 2;
    // 一日两页：摊开跨页的左页（偶数页号、订口在右）画前半夜、右页画后半夜，
    // 时刻沿摊开方向自左向右递增；一日一页时画全天。
    let (start, end) = if p.pages == 1 {
        (p.start, p.end)
    } else if geo.binding_side == Side::Right {
        (p.start, mid)
    } else {
        (mid, p.end)
    };
    let span = f64::from(end - start);
    let r = geo.content;
    // 全部元素收在页心内（同 octan_week 的 content 纪律）：顶部为日期标题带；
    // 小时号带贴订口侧页心边缘，主刻度与昼/夜小点纹自号带铺到页心外缘。
    // 两级尺度：页面级（r / timeline_h / hh）由纸张与时间跨度决定；
    // 组件级（S / M）以 label_size 为唯一 token，决定字号、号带与刻度。
    let s = p.label_size; // pt —— 基准字号 token
    let m = s * MM_PER_PT; // mm —— label_size 的物理尺度
    // 标题层级时钟刻度均为固定比例（见 docs 规范），不随页心宽度缩放。
    let title_size = 1.50 * s;
    let title_band_h = 1.15 * title_size * MM_PER_PT;
    let title_gap = 1.0; // 微间距允许绝对 mm
    let major_tick = 1.90 * m;
    let half_tick = 0.83 * m;
    let quarter_tick = 0.42 * m;
    let timeline_h = r.height - title_band_h - title_gap;
    let axis_top = r.y + title_band_h + title_gap;
    let hh = timeline_h / span;
    let axis = if geo.binding_side == Side::Left {
        r.x
    } else {
        r.x + r.width
    };
    let direction = if geo.binding_side == Side::Left {
        1.0
    } else {
        -1.0
    };
    // 号带宽度 = 1.00M（组件级，随 label_size 缩放）。
    let label_w = m;
    let band = axis + direction * (label_w + 1.0);
    let outer = if geo.binding_side == Side::Left {
        r.x + r.width
    } else {
        r.x
    };
    let mut lines = Vec::new();
    let mut dots = Vec::new();
    let mut texts = Vec::new();
    if let Some(date) = date {
        texts.push(Text {
            x: r.x + r.width / 2.0,
            y: r.y + title_band_h,
            content: format_date(date, &p.title_format, "zh-CN"),
            size: title_size,
            color: p.line_color.clone(),
            rotation: 0,
            font: font.into(),
            anchor: "south",
        });
    }
    for hour in start..=end {
        let color = daily_timeline_color(p, date, hour * 60);
        let y = axis_top + f64::from(hour - start) * hh;
        // 主刻度 = 1.90M；小点纹按半小时节奏铺满到页心外缘。
        let tick = band + direction * major_tick;
        lines.push(Line {
            x1: band,
            y1: y,
            x2: tick,
            y2: y,
            color: color.clone(),
            width: Some(p.line_width),
            style: LineStyle::Solid,
        });
        let count = ((outer - tick).abs() / (hh / 2.0)).ceil() as usize;
        for i in 1..count {
            dots.push(Dot {
                x: tick + direction * i as f64 * hh / 2.0,
                y,
                radius: p.line_width * MM_PER_PT / 2.0,
                color: color.clone(),
                square: true,
                fill: true,
            });
        }
        texts.push(Text {
            x: axis + direction * (label_w / 2.0 + 0.5),
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
                x1: band,
                y1: half,
                x2: band + direction * half_tick,
                y2: half,
                color: daily_timeline_color(p, date, hour * 60 + 30),
                width: Some(p.line_width),
                style: LineStyle::Solid,
            });
            let quarter = y + hh / 4.0;
            lines.push(Line {
                x1: band,
                y1: quarter,
                x2: band + direction * quarter_tick,
                y2: quarter,
                color: daily_timeline_color(p, date, hour * 60 + 15),
                width: Some(p.line_width),
                style: LineStyle::Solid,
            });
            let three_quarter = y + hh * 3.0 / 4.0;
            lines.push(Line {
                x1: band,
                y1: three_quarter,
                x2: band + direction * quarter_tick,
                y2: three_quarter,
                color: daily_timeline_color(p, date, hour * 60 + 45),
                width: Some(p.line_width),
                style: LineStyle::Solid,
            });
        }
    }
    (lines, dots, texts)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::backend::Rect;

    #[test]
    fn draws_date_heading_with_title_format() {
        let date = NaiveDate::from_ymd_opt(2025, 6, 21).unwrap();
        let p = DailyTimelinePattern {
            start_date: Some(date),
            end_date: Some(date),
            ..Default::default()
        };
        let geo = Geometry {
            page: Rect {
                x: 0.0,
                y: 0.0,
                width: 100.0,
                height: 100.0,
            },
            content: Rect {
                x: 15.0,
                y: 10.0,
                width: 77.0,
                height: 80.0,
            },
            binding_side: Side::Left,
        };
        let (_, _, texts) = draw_daily_timeline(geo, &p, 0, "font");
        assert!(
            texts
                .iter()
                .any(|t| t.content == "2025年6月21日" && t.anchor == "south")
        );
    }

    #[test]
    fn draws_half_and_quarter_ticks_per_hour() {
        let date = NaiveDate::from_ymd_opt(2025, 6, 21).unwrap();
        let p = DailyTimelinePattern {
            start_date: Some(date),
            end_date: Some(date),
            ..Default::default()
        };
        let geo = Geometry {
            page: Rect {
                x: 0.0,
                y: 0.0,
                width: 100.0,
                height: 100.0,
            },
            content: Rect {
                x: 15.0,
                y: 10.0,
                width: 77.0,
                height: 80.0,
            },
            binding_side: Side::Left,
        };
        let (lines, _, _) = draw_daily_timeline(geo, &p, 0, "font");
        // 每小时：1 主刻度 + 1 半刻度（30 分）+ 2 刻度（15/45 分）；共 25 个主刻度。
        assert_eq!(lines.len(), 24 * 4 + 1);
    }
}
