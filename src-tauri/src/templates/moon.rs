//! 近似月相：以 2000-01-06 18:14 UTC 朔为历元，按朔望月线性推算。
//!
//! 精度足够画装饰性月相；不依赖时区，日期统一按当天中午取值。

use std::f64::consts::{FRAC_PI_2, PI, TAU};

use super::calendar::Date;

const SYNODIC_DAYS: f64 = 29.530_588_67;
/// 圆弧采样数；采样点越多路径越圆，24 段在印刷尺寸下已看不出折线。
pub(crate) const MOON_STEPS: usize = 24;

/// 返回（照面比例 0..1，是否盈相）；`waxing` 为真时亮面在右。
pub(crate) fn moon_illumination(date: Date) -> (f64, bool) {
    let epoch = super::calendar::days_from_civil(2000, 1, 6) as f64 + 18.233 / 24.0;
    let moment = date.ordinal() as f64 + 0.5;
    let fraction = (moment - epoch).rem_euclid(SYNODIC_DAYS) / SYNODIC_DAYS;
    ((1.0 - (TAU * fraction).cos()) / 2.0, fraction < 0.5)
}

/// 生成月相亮面路径的采样点；`k = 1 - 2 * illumination` 控制明暗界线，
/// 0 时与右半圆重合（新月），1 时与左半圆重合（满月）。
pub(crate) fn moon_points(
    cx: f64,
    cy: f64,
    radius: f64,
    illumination: f64,
    waxing: bool,
) -> Vec<(f64, f64)> {
    let k = 1.0 - 2.0 * illumination;
    let mut points = Vec::with_capacity(MOON_STEPS * 2 + 2);
    for step in 0..=MOON_STEPS {
        let angle = -FRAC_PI_2 + PI * step as f64 / MOON_STEPS as f64;
        points.push((cx + radius * angle.cos(), cy + radius * angle.sin()));
    }
    for step in (0..=MOON_STEPS).rev() {
        let angle = -FRAC_PI_2 + PI * step as f64 / MOON_STEPS as f64;
        points.push((cx + k * radius * angle.cos(), cy + radius * angle.sin()));
    }
    if !waxing {
        for point in &mut points {
            point.0 = 2.0 * cx - point.0;
        }
    }
    points
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_moon_is_dark_and_full_moon_is_lit() {
        let (new, _) = moon_illumination(Date::parse("2000-01-06").unwrap());
        assert!(new < 0.05, "new moon illumination {new}");
        let full_points = moon_points(10.0, 10.0, 2.0, 1.0, true);
        // 满月：右半圆 + 左半圆，横向覆盖整个圆。
        assert!(full_points.iter().any(|p| (p.0 - 12.0).abs() < 1e-9));
        assert!(full_points.iter().any(|p| (p.0 - 8.0).abs() < 1e-9));
    }

    #[test]
    fn waning_mirrors_the_lit_side() {
        let waxing = moon_points(10.0, 10.0, 2.0, 0.5, true);
        let waning = moon_points(10.0, 10.0, 2.0, 0.5, false);
        for (left, right) in waxing.iter().zip(&waning) {
            assert!((left.0 + right.0 - 20.0).abs() < 1e-9);
            assert_eq!(left.1, right.1);
        }
    }
}
