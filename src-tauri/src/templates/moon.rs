//! 近似月相：以 2000-01-06 18:14 UTC 朔为历元，按朔望月线性推算。
//!
//! 精度足够画装饰性月相；不依赖时区，日期统一按当天中午取值。

use std::f64::consts::TAU;

use super::{
    calendar::Date,
    latex::{Arc, Canvas, Curve},
};

const SYNODIC_DAYS: f64 = 29.530_588_67;

/// 返回（照面比例 0..1，是否盈相）；`waxing` 为真时亮面在右。
pub(crate) fn moon_illumination(date: Date) -> (f64, bool) {
    let epoch = super::calendar::days_from_civil(2000, 1, 6) as f64 + 18.233 / 24.0;
    let moment = date.ordinal() as f64 + 0.5;
    let fraction = (moment - epoch).rem_euclid(SYNODIC_DAYS) / SYNODIC_DAYS;
    ((1.0 - (TAU * fraction).cos()) / 2.0, fraction < 0.5)
}

/// 月相亮面轮廓：从圆顶出发，先沿亮面一侧的半圆到圆底，再沿明暗界线
/// 回到圆顶。角度与半径都在设计坐标系（x 向右、y 向下）里。
#[derive(Debug, Clone, Copy)]
pub(crate) struct MoonOutline {
    pub(crate) start: (f64, f64),
    pub(crate) limb: Arc,
    pub(crate) terminator: Terminator,
}

/// 明暗界线。半圆时退化为一条直线，两端都在圆顶/圆底。
#[derive(Debug, Clone, Copy)]
pub(crate) enum Terminator {
    Line,
    Arc(Arc),
}

/// `k = 1 - 2 * illumination` 是明暗界线的横向缩放：k = 1 时与亮面半圆
/// 重合（新月，面积为 0），k = -1 时是另一半圆（满月），k = 0 时退化为直线。
pub(crate) fn moon_outline(
    cx: f64,
    cy: f64,
    radius: f64,
    illumination: f64,
    waxing: bool,
) -> MoonOutline {
    let k = 1.0 - 2.0 * illumination;
    let limb = Arc {
        start_deg: -90.0,
        // 亏相从圆顶经左侧到圆底，所以角度继续减小。
        end_deg: if waxing { 90.0 } else { -270.0 },
        x_radius: radius,
        y_radius: radius,
    };
    let terminator = if k.abs() < 1e-6 {
        Terminator::Line
    } else {
        Terminator::Arc(Arc {
            start_deg: 90.0,
            // 界线走右半圆时从 90° 减到 -90°，走左半圆时从 90° 增到 270°。
            end_deg: if (k > 0.0) == waxing { -90.0 } else { 270.0 },
            x_radius: k.abs() * radius,
            y_radius: radius,
        })
    };
    MoonOutline {
        start: (cx, cy - radius),
        limb,
        terminator,
    }
}

impl MoonOutline {
    /// 映射到横放页面：整块设计逆时针旋转 90°。页面偏移
    /// `(dx, dy) → (dy, -dx)` 是纯旋转，所以角度减 90°、两轴半径互换。
    /// `map` 必须使用同一个旋转。
    pub(crate) fn through(self, map: impl Fn(f64, f64) -> (f64, f64)) -> Self {
        let turn = |arc: Arc| Arc {
            start_deg: arc.start_deg - 90.0,
            end_deg: arc.end_deg - 90.0,
            x_radius: arc.y_radius,
            y_radius: arc.x_radius,
        };
        Self {
            start: map(self.start.0, self.start.1),
            limb: turn(self.limb),
            terminator: match self.terminator {
                Terminator::Line => Terminator::Line,
                Terminator::Arc(arc) => Terminator::Arc(turn(arc)),
            },
        }
    }
}

/// 在画布上填充月相亮面；轮廓坐标已是画布坐标。
pub(crate) fn draw_moon(canvas: &mut Canvas<'_>, outline: &MoonOutline, color: &str) {
    let terminator = match outline.terminator {
        Terminator::Line => Curve::Line {
            x: outline.start.0,
            y: outline.start.1,
        },
        Terminator::Arc(arc) => Curve::Arc(arc),
    };
    canvas.filled_outline(
        outline.start,
        &[Curve::Arc(outline.limb), terminator],
        color,
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    fn arc_of(terminator: Terminator) -> Arc {
        match terminator {
            Terminator::Arc(arc) => arc,
            Terminator::Line => panic!("expected an arc terminator"),
        }
    }

    #[test]
    fn new_moon_is_dark_and_full_moon_is_lit() {
        let (new, _) = moon_illumination(Date::parse("2000-01-06").unwrap());
        assert!(new < 0.05, "new moon illumination {new}");

        // 新月：界线与亮面半圆重合（右半圆），围出的面积为 0。
        let new_arc = arc_of(moon_outline(10.0, 10.0, 2.0, 0.0, true).terminator);
        assert_eq!((new_arc.start_deg, new_arc.end_deg), (90.0, -90.0));
        assert_eq!(new_arc.x_radius, 2.0);

        // 满月：界线是左半圆，与右半圆合成整圆。
        let full_arc = arc_of(moon_outline(10.0, 10.0, 2.0, 1.0, true).terminator);
        assert_eq!((full_arc.start_deg, full_arc.end_deg), (90.0, 270.0));
        assert_eq!(full_arc.x_radius, 2.0);
    }

    #[test]
    fn half_moon_uses_a_straight_terminator() {
        let outline = moon_outline(10.0, 10.0, 2.0, 0.5, true);
        assert_eq!(outline.start, (10.0, 8.0));
        assert_eq!(
            (outline.limb.start_deg, outline.limb.end_deg),
            (-90.0, 90.0)
        );
        assert!(matches!(outline.terminator, Terminator::Line));
    }

    #[test]
    fn waning_mirrors_the_lit_side() {
        let waxing = moon_outline(10.0, 10.0, 2.0, 0.3, true);
        let waning = moon_outline(10.0, 10.0, 2.0, 0.3, false);
        // 亮面半圆换到左侧。
        assert_eq!(waning.limb.end_deg, -270.0);
        // 明暗界线跟着镜像：盈相走右半圆，亏相走左半圆。
        let waxing_arc = arc_of(waxing.terminator);
        let waning_arc = arc_of(waning.terminator);
        assert_eq!((waxing_arc.start_deg, waxing_arc.end_deg), (90.0, -90.0));
        assert_eq!((waning_arc.start_deg, waning_arc.end_deg), (90.0, 270.0));
        assert_eq!(waxing_arc.x_radius, waning_arc.x_radius);
    }

    #[test]
    fn quarter_turn_rotates_points_and_swaps_arc_axes() {
        // 横放日历：设计 (x,y) → 页面 (left+y, base-x)。
        let turned =
            moon_outline(10.0, 10.0, 2.0, 0.25, true).through(|x, y| (100.0 + y, 200.0 - x));
        assert_eq!(turned.start, (108.0, 190.0));
        assert_eq!((turned.limb.start_deg, turned.limb.end_deg), (-180.0, 0.0));
        let arc = arc_of(turned.terminator);
        // 设计里横轴半径 1mm、纵轴 2mm，旋转后两轴互换。
        assert_eq!((arc.x_radius, arc.y_radius), (2.0, 1.0));
    }
}
