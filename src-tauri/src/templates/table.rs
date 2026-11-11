//! 月历与月打卡共用的表格绘制原语。
//!
//! 两页都是「横向设计、整页逆时针旋转 90°」的开口网格：竖线不过表头行、
//! 横线不封顶，交叉处各留 `GAP` 缺口。模板只负责给出列界与行高。

use super::{latex::Canvas, layout::Rect};

pub(crate) const GAP: f64 = 0.2; // mm，网格交叉处留白

/// 横放设计坐标系 → 阅读页坐标：逆时针旋转 90°，贴到页心左下角。
#[derive(Clone, Copy)]
pub(crate) struct Landscape {
    left: f64,
    base: f64,
}

impl Landscape {
    pub(crate) fn new(body: Rect) -> Self {
        Self {
            left: body.x,
            base: body.y + body.height,
        }
    }

    /// 设计坐标 (x 向右、y 向下) → 页面坐标。
    pub(crate) fn point(self, x: f64, y: f64) -> (f64, f64) {
        (self.left + y, self.base - x)
    }
}

/// 开口表格格线：列界由调用方给出（允许首列更宽），行高一致。
#[derive(Clone, Copy)]
pub(crate) struct TableGrid<'a> {
    /// 列界坐标，`columns.len() - 1` 为列数。
    pub(crate) columns: &'a [f64],
    /// 表体（不含表头行）上缘。
    pub(crate) top: f64,
    pub(crate) row_height: f64,
    /// 表体行数；表头行另画，不计入这里。
    pub(crate) rows: usize,
}

impl TableGrid<'_> {
    pub(crate) fn draw(
        &self,
        canvas: &mut Canvas<'_>,
        width_pt: f64,
        color: &str,
        land: Landscape,
    ) {
        // 一页表格有上百条短线，全部同色同线宽，合并成一条路径交给 TikZ。
        let mut segments = Vec::with_capacity(
            self.columns.len() * self.rows + (self.rows + 1) * self.columns.len().saturating_sub(1),
        );
        for &x in self.columns {
            for row in 0..self.rows {
                let y1 = self.top + self.row_height * row as f64 + GAP;
                let y2 = self.top + self.row_height * (row + 1) as f64 - GAP;
                let (x1, y1) = land.point(x, y1);
                let (x2, y2) = land.point(x, y2);
                segments.push((x1, y1, x2, y2));
            }
        }
        for row in 0..=self.rows {
            let y = self.top + self.row_height * row as f64;
            for pair in self.columns.windows(2) {
                let (x1, y1) = land.point(pair[0] + GAP, y);
                let (x2, y2) = land.point(pair[1] - GAP, y);
                segments.push((x1, y1, x2, y2));
            }
        }
        canvas.line_batch(&segments, width_pt, color);
    }
}
