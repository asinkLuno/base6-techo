use chrono::{Duration, NaiveDate, TimeZone, Timelike, Utc};
use chrono_tz::Tz;

use serde::Deserialize;

use super::{Dot, Geometry, Line, LineStyle, MM_PER_PT, Side, Text, validate_color};

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct TimelinePattern {
    pub(crate) start: i32,
    pub(crate) end: i32,
    pub(crate) pages: i32,
    pub(crate) line_color: String,
    pub(crate) line_width: f64,
    pub(crate) label_size: f64,
    pub(crate) city_name: Option<String>,
    pub(crate) latitude: Option<f64>,
    pub(crate) longitude: Option<f64>,
    pub(crate) timezone: Option<String>,
    pub(crate) daylight_color: String,
    pub(crate) night_color: String,
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
    pub(crate) fn validate(&self) -> Result<(), String> {
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

pub(crate) fn timeline_color(
    p: &TimelinePattern,
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

pub(crate) fn draw_timeline(
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
            style: LineStyle::Solid,
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
                style: LineStyle::Solid,
            });
        }
    }
    (lines, dots, texts)
}
