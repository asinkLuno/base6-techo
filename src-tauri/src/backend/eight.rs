use chrono::{Datelike, Duration, NaiveDate, Utc, Weekday};

use serde::Deserialize;

use super::colors::{BLACK, GRAY, HOLIDAY_RED, PHASE_GOLD};
use super::month::{MOON_STEPS, PS, moon_illumination};
use super::{
    Dot, Geometry, HashMap, Line, LineStyle, Poly, Rect, Text, WeekdayLang, chrono_format,
    format_date, lunar_date, validate_color, validate_date_format, weekday_headers,
};

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct EightPattern {
    pub(crate) start_date: NaiveDate,
    pub(crate) end_date: NaiveDate,
    pub(crate) date_format: String,
    pub(crate) date_locale: String,
    pub(crate) weekday_lang: WeekdayLang,
    pub(crate) line_color: String,
    pub(crate) line_width: f64,
    pub(crate) line_style: LineStyle,
    pub(crate) center_gap: f64,
    pub(crate) date_size: f64,
}
impl Default for EightPattern {
    fn default() -> Self {
        let today = Utc::now().date_naive();
        let monday = today - Duration::days(i64::from(today.weekday().num_days_from_monday()));
        Self {
            start_date: monday,
            end_date: monday + Duration::days(6),
            date_format: "%-d".into(),
            date_locale: "zh-CN".into(),
            weekday_lang: WeekdayLang::Zh,
            line_color: GRAY.into(),
            line_width: 0.4,
            line_style: LineStyle::Solid,
            center_gap: 2.0,
            date_size: 10.0,
        }
    }
}
impl EightPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if self.end_date < self.start_date {
            return Err("结束日期必须晚于或等于开始日期".into());
        }
        if self.start_date.weekday() != Weekday::Mon {
            return Err("开始日期必须是星期一".into());
        }
        if self.end_date.weekday() != Weekday::Sun {
            return Err("结束日期必须是星期日".into());
        }
        if self.line_width <= 0.0 || self.date_size <= 0.0 {
            return Err("line_width and date_size must be > 0".into());
        }
        if self.center_gap < 0.0 {
            return Err("center_gap must be >= 0".into());
        }
        validate_color(&self.line_color)?;
        validate_date_format(&self.date_format, &self.date_locale)?;
        if chrono_format(&self.date_format).contains('\u{e000}')
            && [self.start_date, self.end_date]
                .into_iter()
                .any(|date| lunar_date(date).is_none())
        {
            return Err("农历日期仅支持 1901-02-19 至 2101-01-28".into());
        }
        Ok(())
    }

    /// 整星期（周一至周日）列表；起止日期已由 validate 保证为周一和周日。
    pub(crate) fn weeks(&self) -> Vec<(NaiveDate, NaiveDate)> {
        let count = (self.end_date - self.start_date).num_days() as usize / 7 + 1;
        (0..count)
            .map(|w| {
                let start = self.start_date + Duration::days(7 * w as i64);
                (start, start + Duration::days(6))
            })
            .collect()
    }
}

pub(crate) const MINI_PAD: f64 = 2.0; // mm，迷你月历距所在矩形边缘

/// 次月 1 号。
fn next_month_first(first: NaiveDate) -> Option<NaiveDate> {
    if first.month() == 12 {
        NaiveDate::from_ymd_opt(first.year() + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(first.year(), first.month() + 1, 1)
    }
}

/// 空白格（周一所在页左上象限）内上下画两个月：不跨月的周显示本月和下月，
/// 跨月的周恰好就是所跨的两个月。本周内的日期红色，其余黑色。
fn push_mini_calendar(
    texts: &mut Vec<Text>,
    quad: Rect,
    week_start: NaiveDate,
    p: &EightPattern,
    font: &str,
    holidays: &Option<HashMap<String, String>>,
    lunar: bool,
) {
    let first = NaiveDate::from_ymd_opt(week_start.year(), week_start.month(), 1)
        .expect("month of an existing date is valid");
    if let Some(next) = next_month_first(first) {
        push_one_month(
            texts,
            Rect {
                y: quad.y + quad.height / 2.0,
                height: quad.height / 2.0,
                ..quad
            },
            next,
            p.date_size * 0.7,
            p.weekday_lang,
            Some((week_start, week_start + Duration::days(6))),
            font,
            holidays,
            lunar,
            true,
            true,
        );
    }
    push_one_month(
        texts,
        Rect {
            height: quad.height / 2.0,
            ..quad
        },
        first,
        p.date_size * 0.7,
        p.weekday_lang,
        Some((week_start, week_start + Duration::days(6))),
        font,
        holidays,
        lunar,
        false,
        true,
    );
}

/// 单个月历：月份标题 + 星期表头 + 日期（周一为首的 7 列，仅文字无框线），
/// 落在 highlight 区间内的日期红色（年历等无本周概念时传 None）。八分视图与年历共用。
pub(crate) fn push_one_month(
    texts: &mut Vec<Text>,
    rect: Rect,
    first: NaiveDate,
    size: f64,
    lang: WeekdayLang,
    highlight: Option<(NaiveDate, NaiveDate)>,
    font: &str,
    holidays: &Option<HashMap<String, String>>,
    lunar: bool,
    mini: bool,
    week_only: bool,
) {
    let Some(next) = next_month_first(first) else {
        return;
    };
    let days = (next - first).num_days() as usize;
    let first_wd = first.weekday().num_days_from_monday() as usize;
    let rows = (first_wd + days).div_ceil(7);
    let cell_w = (rect.width - 2.0 * MINI_PAD) / 7.0;
    let cell_h = (rect.height - 2.0 * MINI_PAD) / (rows + 2) as f64;
    let title_format = "%Y.%m";
    let locale = match lang {
        WeekdayLang::En => "en-US",
        WeekdayLang::Zh | WeekdayLang::Ja => "zh-CN",
    };
    let head = weekday_headers(lang);
    fn push_text(
        texts: &mut Vec<Text>,
        rect: Rect,
        cell_w: f64,
        cell_h: f64,
        size: f64,
        font: &str,
        content: &str,
        i: f64,
        j: usize,
        color: &str,
    ) {
        texts.push(Text {
            x: rect.x + MINI_PAD + cell_w * (i + 0.5),
            y: rect.y + MINI_PAD + cell_h * (j as f64 + 0.5),
            content: content.into(),
            size,
            color: color.into(),
            rotation: 0,
            font: font.into(),
            anchor: "center",
        });
    }
    push_text(
        texts,
        rect,
        cell_w,
        cell_h,
        size,
        font,
        &format_date(first, title_format, locale),
        3.0,
        0,
        BLACK,
    );
    for (i, w) in head.iter().enumerate() {
        push_text(
            texts, rect, cell_w, cell_h, size, font, w, i as f64, 1, BLACK,
        );
    }
    for d in 1..=days {
        let date = first + Duration::days(d as i64 - 1);
        let pos = first_wd + d - 1;
        let red = highlight.is_some_and(|(s, e)| (s..=e).contains(&date));
        let is_weekend = date.weekday() == Weekday::Sat || date.weekday() == Weekday::Sun;
        let date_key = format!("{}-{:02}-{:02}", date.year(), date.month(), date.day());
        let holiday_name = holidays.as_ref().and_then(|h| h.get(&date_key));
        let is_compensatory = holiday_name.is_some_and(|n| n.starts_with("上班"));
        // 八分视图迷你月历只染当周（调休上班日仍不染）；年历保持周末/节假日染色。
        let is_red = if week_only {
            red && !is_compensatory
        } else {
            red || (holiday_name.is_some() && !is_compensatory) || (is_weekend && !is_compensatory)
        };
        push_text(
            texts,
            rect,
            cell_w,
            cell_h,
            size,
            font,
            &d.to_string(),
            (pos % 7) as f64,
            pos / 7 + 2,
            if is_red { HOLIDAY_RED } else { BLACK },
        );
        // 农历日期与节日名称：同一格内日期下方居中（微缩月历仅染色，不显示文字）
        if !mini {
            if lunar && let Some(lunar_str) = lunar_date(date) {
                texts.push(Text {
                    x: rect.x + MINI_PAD + cell_w * ((pos % 7) as f64 + 0.5),
                    y: rect.y + MINI_PAD + cell_h * ((pos / 7 + 2) as f64 + 0.72),
                    content: lunar_str,
                    size: size * 0.5,
                    color: BLACK.into(),
                    rotation: 0,
                    font: font.into(),
                    anchor: "center",
                });
            }
            if let Some(name) = holiday_name
                && !is_compensatory
            {
                texts.push(Text {
                    x: rect.x + MINI_PAD + cell_w * ((pos % 7) as f64 + 0.5),
                    y: rect.y + MINI_PAD + cell_h * ((pos / 7 + 2) as f64 + 0.88),
                    content: name.clone(),
                    size: size * 0.5,
                    color: HOLIDAY_RED.into(),
                    rotation: 0,
                    font: font.into(),
                    anchor: "center",
                });
            }
        }
    }
}

/// `index`：section 内 0 起的页序（即第 index+1 页）；第 1、3、5… 页画整周前半
/// （空/周一/周四/周五），第 2、4、6… 页画后半（周二/周三/周六/周日），保证顺序。
pub(crate) fn draw_eight(
    geo: Geometry,
    p: &EightPattern,
    index: usize,
    font: &str,
    holidays: &Option<HashMap<String, String>>,
    lunar: bool,
) -> (Vec<Line>, Vec<Dot>, Vec<Poly>, Vec<Text>) {
    let r = geo.content;
    let cx = r.x + r.width / 2.0;
    let cy = r.y + r.height / 2.0;
    let line = |x1, y1, x2, y2| Line {
        x1,
        y1,
        x2,
        y2,
        color: Some(p.line_color.clone()),
        width: Some(p.line_width),
        style: p.line_style,
    };
    // 中心圆点留出 center_gap 间隙后向上下左右画直线分成四份，不画外框。
    let gap = p.center_gap;
    let lines = vec![
        line(cx, cy - gap, cx, r.y),
        line(cx, cy + gap, cx, r.y + r.height),
        line(cx - gap, cy, r.x, cy),
        line(cx + gap, cy, r.x + r.width, cy),
    ];
    let dots = vec![Dot {
        x: cx,
        y: cy,
        radius: 0.5,
        color: Some(p.line_color.clone()),
        square: false,
    }];
    let Some(&(week_start, _)) = p.weeks().get(index / 2) else {
        return (lines, dots, vec![], vec![]);
    };
    // section 内第 1、3、5… 页画空/周一/周四/周五，第 2、4、6… 页画周二/周三/周六/周日。
    let offsets: [Option<u32>; 4] = if (index + 1) % 2 == 1 {
        [None, Some(0), Some(3), Some(4)]
    } else {
        [Some(1), Some(2), Some(5), Some(6)]
    };
    let mut texts = Vec::new();
    let mut paths = Vec::new();
    // 空白格放当月迷你月历，本周所在行红色高亮。
    if (index + 1) % 2 == 1 {
        push_mini_calendar(
            &mut texts,
            Rect {
                x: r.x,
                y: r.y,
                width: r.width / 2.0,
                height: r.height / 2.0,
            },
            week_start,
            p,
            font,
            holidays,
            lunar,
        );
    }
    for (slot, offset) in offsets.into_iter().enumerate() {
        let Some(offset) = offset else { continue };
        let cx = r.x + f64::from(slot as u16 % 2) * r.width / 2.0;
        let cy = r.y + f64::from(slot as u16 / 2) * r.height / 2.0;
        texts.push(Text {
            x: cx + 2.0,
            y: cy + 2.0,
            content: format_date(
                week_start + Duration::days(i64::from(offset)),
                &p.date_format,
                &p.date_locale,
            ),
            size: p.date_size,
            color: p.line_color.clone(),
            rotation: 0,
            font: font.into(),
            anchor: "north west",
        });
        // 右上角月相
        {
            let date = week_start + Duration::days(i64::from(offset));
            let (illum, waxing) = moon_illumination(date.and_hms_opt(12, 0, 0).unwrap().and_utc());
            // 月相直径 6mm、上/右各留 4mm（原 PS*0.7=1.4mm 且贴角，太小太靠边）。
            let rx = cx + r.width / 2.0 - 4.0;
            let ty = cy + 4.0;
            let mps = 6.0;
            let mx = rx - mps / 2.0;
            let my = ty + mps / 2.0;
            let radius = mps / 2.0;
            let tau = std::f64::consts::TAU;
            let half_pi = std::f64::consts::FRAC_PI_2;
            let arc = |start: f64, end: f64| {
                (0..=MOON_STEPS)
                    .map(|i| {
                        let phi = start + (end - start) * i as f64 / MOON_STEPS as f64;
                        (mx + radius * phi.cos(), my + radius * phi.sin())
                    })
                    .collect::<Vec<_>>()
            };
            paths.push(Poly {
                points: arc(0.0, tau),
                color: PHASE_GOLD.into(),
                fill: false,
                arrow: false,
            });
            let mut lit = arc(-half_pi, half_pi);
            for (x, y) in arc(half_pi, -half_pi) {
                lit.push((mx + (1.0 - 2.0 * illum) * (x - mx), y));
            }
            if !waxing {
                for point in &mut lit {
                    point.0 = 2.0 * mx - point.0;
                }
            }
            paths.push(Poly {
                points: lit,
                color: PHASE_GOLD.into(),
                fill: true,
                arrow: false,
            });
        }
    }
    (lines, dots, paths, texts)
}

#[cfg(test)]
mod tests {
    use super::super::{PageSettings, geometry_for};
    use super::*;

    fn pattern(start: &str, end: &str) -> EightPattern {
        EightPattern {
            start_date: NaiveDate::parse_from_str(start, "%F").unwrap(),
            end_date: NaiveDate::parse_from_str(end, "%F").unwrap(),
            ..Default::default()
        }
    }

    #[test]
    fn weeks_covers_exact_weeks_between_dates() {
        let p = pattern("2026-08-03", "2026-08-16");
        assert_eq!(
            p.weeks(),
            vec![
                (
                    NaiveDate::from_ymd_opt(2026, 8, 3).unwrap(),
                    NaiveDate::from_ymd_opt(2026, 8, 9).unwrap()
                ),
                (
                    NaiveDate::from_ymd_opt(2026, 8, 10).unwrap(),
                    NaiveDate::from_ymd_opt(2026, 8, 16).unwrap()
                ),
            ]
        );
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
        assert_eq!(
            pattern("2026-08-03", "2026-08-02").validate().unwrap_err(),
            "结束日期必须晚于或等于开始日期"
        );
        assert!(pattern("2026-08-03", "2026-08-09").validate().is_ok());
    }

    fn days(texts: &[Text]) -> Vec<&str> {
        // 迷你月历用 center 锚点，格子日期用 north west。
        texts
            .iter()
            .filter(|text| text.anchor == "north west")
            .map(|text| text.content.as_str())
            .collect()
    }

    fn draw(page: &PageSettings, p: &EightPattern, index: usize) -> Vec<Text> {
        draw_eight(
            geometry_for(page, index + 1),
            p,
            index,
            r"\sffamily",
            &None,
            false,
        )
        .3
    }

    #[test]
    fn pages_follow_week_order() {
        let page = PageSettings::default();
        let p = pattern("2026-08-03", "2026-08-16");
        // 第 1 页 = 第一周前半，第 2 页 = 后半，第 3/4 页 = 第二周。
        assert_eq!(days(&draw(&page, &p, 0)), ["3", "6", "7"]);
        assert_eq!(days(&draw(&page, &p, 1)), ["4", "5", "8", "9"]);
        assert_eq!(days(&draw(&page, &p, 2)), ["10", "13", "14"]);
        assert_eq!(days(&draw(&page, &p, 3)), ["11", "12", "15", "16"]);
    }

    #[test]
    fn cell_dates_reuse_header_format_system() {
        let page = PageSettings::default();
        let mut p = pattern("2026-08-03", "2026-08-09");
        p.date_format = "%a. %m/%d".into();
        assert_eq!(
            days(&draw(&page, &p, 0)),
            ["一. 08/03", "四. 08/06", "五. 08/07"]
        );
        p.date_format = "%Y年 %cccc".into();
        assert_eq!(days(&draw(&page, &p, 0))[0], "2026年 六月廿一");
        p.date_format = "%Q".into();
        assert!(p.validate().is_err());
    }

    #[test]
    fn blank_cell_gets_mini_month_calendar() {
        let page = PageSettings::default();
        let p = pattern("2026-08-03", "2026-08-16");
        let texts = draw(&page, &p, 0);
        let mini: Vec<&Text> = texts.iter().filter(|t| t.anchor == "center").collect();
        // 两个月：8 月（标题+7 表头+31 天）+ 9 月（标题+7 表头+30 天）。
        assert_eq!(mini.len(), 2 * 8 + 31 + 30);
        assert!(mini.iter().any(|t| t.content == "2026.08"));
        assert!(mini.iter().any(|t| t.content == "2026.09"));
        let colored =
            |s: &str, color: &str| mini.iter().any(|t| t.content == s && t.color == color);
        // 本周 8/3–8/9 红色，8/1、8/2、8/10 及 9 月黑色。
        assert!(colored("3", HOLIDAY_RED) && colored("9", HOLIDAY_RED));
        assert!(colored("1", BLACK) && colored("2", BLACK));
        assert!(colored("10", BLACK));
        assert!(colored("30", BLACK));
        // 后半页（偶数序号页）没有空白格，不画月历。
        assert!(draw(&page, &p, 1).iter().all(|t| t.anchor != "center"));
    }

    #[test]
    fn cross_month_week_highlights_both_calendars() {
        let page = PageSettings::default();
        let p = pattern("2026-08-31", "2026-09-06");
        let texts = draw(&page, &p, 0);
        let mini: Vec<&Text> = texts.iter().filter(|t| t.anchor == "center").collect();
        let colored =
            |s: &str, color: &str| mini.iter().any(|t| t.content == s && t.color == color);
        // 8 月只有 31 红色；9 月 1–6 红色，7 及以后黑色。
        assert!(colored("31", HOLIDAY_RED));
        assert!(colored("30", BLACK));
        for d in 1..=6 {
            assert!(colored(&d.to_string(), HOLIDAY_RED));
        }
        assert!(colored("7", BLACK));
    }

    #[test]
    fn mini_month_colors_only_the_week() {
        // 迷你月历：当周（含其中的周末）红色，其余周末/平日黑色。
        // 9 月无 31 日，"31" 仅存在于 10 月迷你历，断言无歧义。
        let page = PageSettings::default();
        let p = pattern("2026-10-05", "2026-10-11");
        let texts = draw(&page, &p, 0);
        let mini: Vec<&Text> = texts.iter().filter(|t| t.anchor == "center").collect();
        let colored =
            |s: &str, color: &str| mini.iter().any(|t| t.content == s && t.color == color);
        for d in 5..=11 {
            assert!(colored(&d.to_string(), HOLIDAY_RED));
        }
        assert!(colored("31", BLACK)); // 10-31 周六，当周之外
    }

    #[test]
    fn mini_calendar_header_follows_language() {
        let page = PageSettings::default();
        let mut p = pattern("2026-08-03", "2026-08-09");
        p.weekday_lang = WeekdayLang::Ja;
        assert!(draw(&page, &p, 0).iter().any(|t| t.content == "月"));
        p.weekday_lang = WeekdayLang::En;
        assert!(draw(&page, &p, 0).iter().any(|t| t.content == "Mo"));
    }

    #[test]
    fn out_of_range_week_draws_empty_grid() {
        let page = PageSettings::default();
        let p = pattern("2026-08-03", "2026-08-09");
        let (lines, dots, _paths, texts) =
            draw_eight(geometry_for(&page, 5), &p, 4, r"\sffamily", &None, false);
        assert_eq!(lines.len(), 4);
        assert_eq!(dots.len(), 1);
        assert!(texts.is_empty());
    }
}
