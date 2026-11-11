//! 公历日期计算与模板需要的 strftime 子集。
//!
//! 只实现本应用模板实际使用的指令（`%Y`、`%m`、`%-m`、`%d`、`%-d`、`%a`），
//! 避免为本地化日期格式引入额外依赖。坐标与日期都用整数运算，跨时区稳定。

use std::fmt::Write as _;

use serde::{Deserialize, Serialize};

/// 星期短名语言；与页面文字语言分开，便于月历表头用中文而日期用英文星期。
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WeekdayLang {
    #[default]
    Zh,
    En,
    Ja,
}

impl WeekdayLang {
    fn short_name(self, monday_index: usize) -> &'static str {
        const ZH: [&str; 7] = ["一", "二", "三", "四", "五", "六", "日"];
        const EN: [&str; 7] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const JA: [&str; 7] = ["月", "火", "水", "木", "金", "土", "日"];
        let table = match self {
            Self::Zh => &ZH,
            Self::En => &EN,
            Self::Ja => &JA,
        };
        table[monday_index]
    }
}

/// 公历日期；年份限制在 1–9999，避免与 `YYYY-MM-DD` 的 4 位写法不一致。
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) struct Date {
    year: i32,
    month: u32,
    day: u32,
}

const MONTH_DAYS: [u32; 12] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

fn is_leap(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

pub(crate) fn days_in_month(year: i32, month: u32) -> u32 {
    if month == 2 && is_leap(year) {
        29
    } else {
        MONTH_DAYS[month as usize - 1]
    }
}

/// Howard Hinnant 的 `days_from_civil`：1970-01-01 为第 0 天。
pub(crate) fn days_from_civil(year: i32, month: u32, day: u32) -> i64 {
    let year = i64::from(year) - i64::from(month <= 2);
    let era = if year >= 0 { year } else { year - 399 }.div_euclid(400);
    let yoe = year - era * 400;
    let month = i64::from(month);
    let doy = (153 * (if month > 2 { month - 3 } else { month + 9 }) + 2) / 5 + i64::from(day) - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// `days_from_civil` 的逆运算。
fn civil_from_days(days: i64) -> (i32, u32, u32) {
    let days = days + 719_468;
    let era = if days >= 0 { days } else { days - 146_096 }.div_euclid(146_097);
    let doe = days - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let month = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    ((year + i64::from(month <= 2)) as i32, month, day)
}

impl Date {
    pub(crate) fn parse(text: &str) -> Result<Self, String> {
        let bytes = text.as_bytes();
        if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
            return Err(format!("日期必须为 YYYY-MM-DD，收到 {text}"));
        }
        if bytes
            .iter()
            .enumerate()
            .any(|(i, b)| i != 4 && i != 7 && !b.is_ascii_digit())
        {
            return Err(format!("日期必须为 YYYY-MM-DD，收到 {text}"));
        }
        let year = text[0..4].parse::<i32>().map_err(|_| "年份无效")?;
        let month = text[5..7].parse::<u32>().map_err(|_| "月份无效")?;
        let day = text[8..10].parse::<u32>().map_err(|_| "日期无效")?;
        if !(1..=9999).contains(&year) || !(1..=12).contains(&month) {
            return Err(format!("日期超出范围：{text}"));
        }
        if day == 0 || day > days_in_month(year, month) {
            return Err(format!("日期不存在：{text}"));
        }
        Ok(Self { year, month, day })
    }

    pub(crate) fn ordinal(self) -> i64 {
        days_from_civil(self.year, self.month, self.day)
    }

    /// 周一为 0，周日为 6。
    pub(crate) fn weekday(self) -> usize {
        (self.ordinal() + 3).rem_euclid(7) as usize
    }

    pub(crate) fn add_days(self, days: i64) -> Self {
        let (year, month, day) = civil_from_days(self.ordinal() + days);
        Self { year, month, day }
    }

    /// 当月 1 号。
    pub(crate) fn month_first(self) -> Self {
        Self { day: 1, ..self }
    }

    pub(crate) fn next_month_first(self) -> Self {
        if self.month == 12 {
            Self {
                year: self.year + 1,
                month: 1,
                day: 1,
            }
        } else {
            Self {
                year: self.year,
                month: self.month + 1,
                day: 1,
            }
        }
    }

    pub(crate) fn year(self) -> i32 {
        self.year
    }

    pub(crate) fn month(self) -> u32 {
        self.month
    }

    pub(crate) fn day(self) -> u32 {
        self.day
    }

    #[cfg(test)]
    pub(crate) fn to_iso(self) -> String {
        format!("{:04}-{:02}-{:02}", self.year, self.month, self.day)
    }
}

/// 单月网格的纯几何：天数、1 号星期偏移与周行数。
/// 迷你月历与整页月历共用，绘制方式各自决定。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct MonthGrid {
    pub first: Date,
    pub days: u32,
    /// 1 号是周几；周一为 0。
    pub first_weekday: usize,
    /// 覆盖整月所需的 7 列行数（4–6）。
    pub rows: usize,
}

impl MonthGrid {
    pub(crate) fn new(first: Date) -> Self {
        debug_assert_eq!(first.day(), 1, "MonthGrid 必须从当月 1 号开始");
        let days = days_in_month(first.year, first.month);
        let first_weekday = first.weekday();
        Self {
            first,
            days,
            first_weekday,
            rows: (first_weekday + days as usize).div_ceil(7),
        }
    }

    /// 当月 `day` 号在 7 列网格中的（列, 行），均从 0 开始。
    pub(crate) fn position(&self, day: u32) -> (usize, usize) {
        let position = self.first_weekday + day as usize - 1;
        (position % 7, position / 7)
    }
}

/// 连续月份数上限；每个模板块的页数上限是 999。
pub(crate) const MONTHS_MAX: usize = 120;

/// 连续月份范围：起始月 1 号 + 月数。月历与月打卡共用同一套边界校验。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct MonthSpan {
    start: Date,
    months: usize,
}

impl MonthSpan {
    /// `label` 用作错误信息前缀（如「月历」「打卡」）。
    pub(crate) fn parse(label: &str, start_month: &str, months: usize) -> Result<Self, String> {
        let start = parse_month(start_month)?;
        if !(1..=MONTHS_MAX).contains(&months) {
            return Err(format!("{label}月份数必须在 1–{MONTHS_MAX} 之间"));
        }
        let start_index = i64::from(start.year()) * 12 + i64::from(start.month()) - 1;
        if start_index + months as i64 - 1 > 9999 * 12 + 11 {
            return Err(format!("{label}范围不能超过 9999 年 12 月"));
        }
        Ok(Self { start, months })
    }

    /// 起始月起连续 `months` 个月的 1 号。
    pub(crate) fn firsts(self) -> Vec<Date> {
        let mut first = self.start;
        let mut out = Vec::with_capacity(self.months);
        for _ in 0..self.months {
            out.push(first);
            first = first.next_month_first();
        }
        out
    }
}

/// 解析 `YYYY-MM` 为当月 1 号；格式错误统一报「月份必须为 YYYY-MM」。
pub(crate) fn parse_month(text: &str) -> Result<Date, String> {
    let bytes = text.as_bytes();
    if bytes.len() != 7 || bytes[4] != b'-' || !bytes[..4].iter().all(u8::is_ascii_digit) {
        return Err(format!("月份必须为 YYYY-MM，收到 {text}"));
    }
    Date::parse(&format!("{text}-01")).map_err(|_| format!("月份必须为 YYYY-MM，收到 {text}"))
}

/// 校验格式串：非空，且每个 `%` 指令都在支持范围内。
pub(crate) fn validate_format(format: &str) -> Result<(), String> {
    if format.is_empty() {
        return Err("日期格式不能为空".into());
    }
    let chars: Vec<char> = format.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] != '%' {
            i += 1;
            continue;
        }
        i += 1;
        match chars.get(i) {
            Some('%' | 'Y' | 'm' | 'd' | 'a') => i += 1,
            Some('-') => match chars.get(i + 1) {
                Some('m' | 'd') => i += 2,
                _ => return Err(format!("不支持的日期格式指令：{format}")),
            },
            _ => return Err(format!("不支持的日期格式指令：{format}")),
        }
    }
    Ok(())
}

/// 按支持的指令格式化；调用前须通过 `validate_format`。
pub(crate) fn format_date(date: Date, format: &str, lang: WeekdayLang) -> String {
    let mut out = String::new();
    let chars: Vec<char> = format.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] != '%' {
            out.push(chars[i]);
            i += 1;
            continue;
        }
        i += 1;
        match chars.get(i) {
            Some('%') => {
                out.push('%');
                i += 1;
            }
            Some('Y') => {
                write!(out, "{:04}", date.year).unwrap();
                i += 1;
            }
            Some('m') => {
                write!(out, "{:02}", date.month).unwrap();
                i += 1;
            }
            Some('d') => {
                write!(out, "{:02}", date.day).unwrap();
                i += 1;
            }
            Some('a') => {
                out.push_str(lang.short_name(date.weekday()));
                i += 1;
            }
            Some('-') => {
                match chars.get(i + 1) {
                    Some('m') => write!(out, "{}", date.month).unwrap(),
                    Some('d') => write!(out, "{}", date.day).unwrap(),
                    _ => {}
                }
                i += 2;
            }
            _ => {}
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_only_real_zero_padded_dates() {
        assert_eq!(Date::parse("2026-02-28").unwrap().to_iso(), "2026-02-28");
        assert_eq!(Date::parse("2024-02-29").unwrap().to_iso(), "2024-02-29");
        for text in [
            "2026-02-29",
            "2026-13-01",
            "2026-00-10",
            "2026-1-01",
            "2026/01/01",
        ] {
            assert!(Date::parse(text).is_err(), "{text}");
        }
    }

    #[test]
    fn weekday_is_monday_zero() {
        assert_eq!(Date::parse("2026-08-03").unwrap().weekday(), 0);
        assert_eq!(Date::parse("2026-08-09").unwrap().weekday(), 6);
        assert_eq!(Date::parse("1970-01-01").unwrap().weekday(), 3);
    }

    #[test]
    fn add_days_crosses_month_and_year_boundaries() {
        let date = Date::parse("2026-12-28").unwrap();
        assert_eq!(date.add_days(4).to_iso(), "2027-01-01");
        assert_eq!(date.add_days(-1).to_iso(), "2026-12-27");
        assert_eq!(
            Date::parse("2024-02-28").unwrap().add_days(1).to_iso(),
            "2024-02-29"
        );
    }

    #[test]
    fn month_grid_maps_days_to_columns_and_rows() {
        let june = MonthGrid::new(Date::parse("2026-06-01").unwrap());
        assert_eq!((june.days, june.first_weekday, june.rows), (30, 0, 5));
        assert_eq!(june.position(1), (0, 0));
        assert_eq!(june.position(7), (6, 0));
        assert_eq!(june.position(30), (1, 4));

        let feb = MonthGrid::new(Date::parse("2026-02-01").unwrap());
        assert_eq!((feb.days, feb.first_weekday, feb.rows), (28, 6, 5));
        assert_eq!(feb.position(1), (6, 0));
        assert_eq!(feb.position(2), (0, 1));
    }

    #[test]
    fn formats_supported_directives_with_weekday_languages() {
        let date = Date::parse("2026-08-03").unwrap();
        assert_eq!(format_date(date, "%-d", WeekdayLang::Zh), "3");
        assert_eq!(format_date(date, "%Y年%-m月", WeekdayLang::Zh), "2026年8月");
        assert_eq!(
            format_date(date, "[%a. %m/%d] %%", WeekdayLang::En),
            "[Mon. 08/03] %"
        );
        assert_eq!(format_date(date, "%a", WeekdayLang::Ja), "月");
        assert!(validate_format("%Q").is_err());
        assert!(validate_format("").is_err());
        assert!(validate_format("%Y年%-m月").is_ok());
    }
}
