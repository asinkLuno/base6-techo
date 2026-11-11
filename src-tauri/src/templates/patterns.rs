//! 页心模板扩展点。模板只消费已解析的页面上下文，不推算装订方向。
use super::{
    document::PageContext,
    latex::{Canvas, validate_color},
    layout::{PageLayout, Rect, check_range},
    octan_week::OctanWeekPattern,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum BodyTemplate {
    #[default]
    Blank,
    #[serde(alias = "lined")]
    Linear(LinearPattern),
    Dots(DotsPattern),
    Grid(GridPattern),
    Hogen(HogenPattern),
    #[serde(rename = "octanWeek")]
    OctanWeek(OctanWeekPattern),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct LinearPattern {
    pub spacing_mm: f64,
    pub color: String,
    pub line_width_pt: f64,
    /// 美式横线本的左侧竖线；None 表示不画。
    pub margin_line: Option<MarginLine>,
}

impl Default for LinearPattern {
    fn default() -> Self {
        Self {
            spacing_mm: 7.0,
            color: "#9E9E9E".into(),
            line_width_pt: 0.4,
            margin_line: None,
        }
    }
}

/// 左侧竖线：距纸张左缘 `x_mm`，贯穿整页高度（不裁剪到页心或页头页脚区域）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct MarginLine {
    pub x_mm: f64,
    pub color: String,
    pub width_pt: f64,
}

impl Default for MarginLine {
    fn default() -> Self {
        Self {
            x_mm: 25.0,
            color: "#D96A6A".into(),
            width_pt: 0.4,
        }
    }
}

/// 点阵：页心内以中心为对称点、按行距/列距等距铺开的圆点。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct DotsPattern {
    pub spacing_mm: f64,
    pub column_spacing_mm: f64,
    pub radius_mm: f64,
    pub color: String,
    /// 中心点单独颜色；None 表示与 color 一致。
    pub center_color: Option<String>,
}

impl Default for DotsPattern {
    fn default() -> Self {
        Self {
            spacing_mm: 5.0,
            column_spacing_mm: 5.0,
            radius_mm: 0.25,
            color: "#7A7A7A".into(),
            center_color: Some("#000000".into()),
        }
    }
}

/// 方格：页心内等距方格，四周封闭边框（锁边）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct GridPattern {
    pub spacing_mm: f64,
    pub color: String,
    pub line_width_pt: f64,
}

impl Default for GridPattern {
    fn default() -> Self {
        Self {
            spacing_mm: 5.0,
            color: "#7A9AC9".into(),
            line_width_pt: 0.2,
        }
    }
}

/// 方眼罫：复刻 Midori 笔记本内页，尺寸、断口、外伸与标记点全部固定，只开放颜色。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct HogenPattern {
    /// 格线与标记点共用的颜色。
    pub color: String,
}

impl Default for HogenPattern {
    fn default() -> Self {
        Self {
            color: "#A9D1AE".into(),
        }
    }
}

/// 横线与方格共用的间距 / 线宽 / 颜色校验，`kind` 只决定报错前缀。
fn validate_line_grid(
    kind: &str,
    spacing_mm: f64,
    line_width_pt: f64,
    color: &str,
) -> Result<(), String> {
    check_range(&format!("{kind}间距（mm）"), spacing_mm, 0.1, 1000.0)?;
    check_range(&format!("{kind}线宽（pt）"), line_width_pt, 0.01, 10.0)?;
    validate_color(color)
}

impl LinearPattern {
    fn validate(&self) -> Result<(), String> {
        validate_line_grid("横线", self.spacing_mm, self.line_width_pt, &self.color)?;
        if let Some(margin_line) = &self.margin_line {
            margin_line.validate()?;
        }
        Ok(())
    }
}

impl MarginLine {
    fn validate(&self) -> Result<(), String> {
        check_range("左侧竖线位置（mm）", self.x_mm, 0.0, 1000.0)?;
        check_range("左侧竖线线宽（pt）", self.width_pt, 0.01, 10.0)?;
        validate_color(&self.color)
    }
}

impl DotsPattern {
    fn validate(&self) -> Result<(), String> {
        check_range("点阵行距（mm）", self.spacing_mm, 0.1, 1000.0)?;
        check_range("点阵列距（mm）", self.column_spacing_mm, 0.1, 1000.0)?;
        check_range("点半径（mm）", self.radius_mm, 0.01, 10.0)?;
        validate_color(&self.color)?;
        if let Some(color) = &self.center_color {
            validate_color(color)?;
        }
        Ok(())
    }
}

impl GridPattern {
    fn validate(&self) -> Result<(), String> {
        validate_line_grid("方格", self.spacing_mm, self.line_width_pt, &self.color)
    }
}

impl HogenPattern {
    fn validate(&self) -> Result<(), String> {
        validate_color(&self.color)
    }
}

/// 方眼罫的固定几何：5mm 格、横线下方 1mm 断口、隔线外伸 1.2mm、每 10 格一个标记点。
const HOGEN_SPACING_MM: f64 = 5.0;
const HOGEN_GAP_MM: f64 = 1.0;
const HOGEN_PROTRUSION_MM: f64 = 1.2;
const HOGEN_INSET_MM: f64 = HOGEN_GAP_MM + HOGEN_PROTRUSION_MM;
const HOGEN_LINE_WIDTH_PT: f64 = 0.7;
const HOGEN_MARKER_PERIOD: i32 = 10;
const HOGEN_DOT_RADIUS_MM: f64 = 0.4;
const HOGEN_DOT_OFFSET_MM: f64 = 1.5;

/// 以区域中心为对称点、按 spacing 等距展开的最外侧两点坐标。
/// `inset` 是两端额外预留的余量（方眼罫给外伸线与标记点留位）。
/// 序列至少包含中心点本身，所以区间一定存在（可能退化成一个点）。
fn centered_extent(start: f64, length: f64, spacing: f64, inset: f64) -> (f64, f64) {
    let center = start + length / 2.0;
    let k = (((length / 2.0) - inset) / spacing + 1e-9).floor().max(0.0);
    (center - k * spacing, center + k * spacing)
}

/// 从中心数第 `offset` 条格线是否向外伸出：隔一条伸一次，
/// 最外圈本身是边框，每 10 格的标记线改画点，两者都不伸。
fn hogen_extends(offset: i32, half_cells: i32) -> bool {
    offset % 2 == 0 && offset.abs() != half_cells && offset % HOGEN_MARKER_PERIOD != 0
}

impl BodyTemplate {
    /// 空白页心不产生任何绘制，调用方可跳过区域裁剪。
    pub(crate) fn is_empty(&self) -> bool {
        matches!(self, Self::Blank)
    }

    pub(crate) fn validate(&self) -> Result<(), String> {
        match self {
            Self::Linear(p) => p.validate(),
            Self::Dots(p) => p.validate(),
            Self::Grid(p) => p.validate(),
            Self::Hogen(p) => p.validate(),
            Self::OctanWeek(p) => p.validate(),
            Self::Blank => Ok(()),
        }
    }

    /// 页数由模板自身日期范围决定的模板返回必需页数；其余模板返回 None。
    pub(crate) fn required_pages(&self) -> Option<usize> {
        match self {
            Self::OctanWeek(p) => Some(p.required_pages()),
            _ => None,
        }
    }

    pub(crate) fn draw(&self, canvas: &mut Canvas<'_>, layout: &PageLayout, context: &PageContext) {
        let body = layout.body;
        match self {
            Self::Linear(p) => {
                // 与点阵一致：以页心中心为对称点，先落中间一条，再上下等距扩展。
                let (first_y, _) = centered_extent(body.y, body.height, p.spacing_mm, 0.0);
                canvas.line_grid(body, first_y, p.spacing_mm, p.line_width_pt, &p.color);
            }
            Self::Dots(p) => {
                let (x_min, x_max) = centered_extent(body.x, body.width, p.column_spacing_mm, 0.0);
                let (y_min, y_max) = centered_extent(body.y, body.height, p.spacing_mm, 0.0);
                // 均匀点阵用 TikZ pattern 一次填充；逐点 \fill 在数百页时会撑爆 TeX 内存。
                canvas.dot_grid(
                    x_min,
                    y_min,
                    x_max,
                    y_max,
                    p.column_spacing_mm,
                    p.spacing_mm,
                    p.radius_mm,
                    &p.color,
                );
                if let Some(center_color) = p.center_color.as_deref()
                    && center_color != p.color.as_str()
                {
                    let (center_x, center_y) = body.center();
                    canvas.dot(center_x, center_y, p.radius_mm, center_color);
                }
            }
            Self::Grid(p) => {
                // 与横线、点阵一致：以页心中心为起点向四周等距扩展，
                // 四周最外侧的格线自然收口成边框。
                let (x_min, x_max) = centered_extent(body.x, body.width, p.spacing_mm, 0.0);
                let (y_min, y_max) = centered_extent(body.y, body.height, p.spacing_mm, 0.0);
                // 至少要有两条格线才构成一个可填充的方格区域。
                if x_min == x_max || y_min == y_max {
                    return;
                }
                canvas.cross_grid(
                    Rect {
                        x: x_min,
                        y: y_min,
                        width: x_max - x_min,
                        height: y_max - y_min,
                    },
                    p.spacing_mm,
                    p.line_width_pt,
                    &p.color,
                );
            }
            Self::OctanWeek(p) => p.draw(canvas, layout, context),
            Self::Hogen(p) => {
                // 与其它模板一致：整块格线以页心中心为对称点，四周预留给外伸线与标记点。
                let Some(lattice) = HogenLattice::fit(body) else {
                    return;
                };
                canvas.hogen_grid(
                    lattice.rect(),
                    HOGEN_SPACING_MM,
                    HOGEN_GAP_MM,
                    HOGEN_LINE_WIDTH_PT,
                    &p.color,
                );
                lattice.draw_fringe(canvas, &p.color);
            }
            Self::Blank => {}
        }
    }

    /// 绘制超出页心裁剪的模板元素。左侧竖线按美式横线本通到整页高度，
    /// 因此不能放在 `draw` 的页心 clip 里。
    pub(crate) fn draw_page_overlay(&self, canvas: &mut Canvas<'_>, layout: &PageLayout) {
        let Self::Linear(p) = self else {
            return;
        };
        let Some(margin_line) = &p.margin_line else {
            return;
        };
        canvas.line(
            margin_line.x_mm,
            0.0,
            margin_line.x_mm,
            layout.paper.height,
            margin_line.width_pt,
            &margin_line.color,
        );
    }
}

/// 方眼罫格线区域：以页心中心为对称点，每边最多 `half_*` 格。
#[derive(Clone, Copy)]
struct HogenLattice {
    x_min: f64,
    x_max: f64,
    y_min: f64,
    y_max: f64,
    center_x: f64,
    center_y: f64,
    half_x: i32,
    half_y: i32,
}

impl HogenLattice {
    fn fit(body: Rect) -> Option<Self> {
        let (x_min, x_max) = centered_extent(body.x, body.width, HOGEN_SPACING_MM, HOGEN_INSET_MM);
        let (y_min, y_max) = centered_extent(body.y, body.height, HOGEN_SPACING_MM, HOGEN_INSET_MM);
        // 至少要有两条格线才能构成一个方格区域。
        if x_min == x_max || y_min == y_max {
            return None;
        }
        let (center_x, center_y) = body.center();
        Some(Self {
            x_min,
            x_max,
            y_min,
            y_max,
            center_x,
            center_y,
            half_x: half_cells(x_min, x_max),
            half_y: half_cells(y_min, y_max),
        })
    }

    fn rect(self) -> Rect {
        Rect {
            x: self.x_min,
            y: self.y_min,
            width: self.x_max - self.x_min,
            height: self.y_max - self.y_min,
        }
    }

    fn x(self, offset: i32) -> f64 {
        self.center_x + f64::from(offset) * HOGEN_SPACING_MM
    }

    fn y(self, offset: i32) -> f64 {
        self.center_y + f64::from(offset) * HOGEN_SPACING_MM
    }

    /// 画格线外伸的短线和每 10 格的标记点；标记线用点代替外伸线。
    fn draw_fringe(self, canvas: &mut Canvas<'_>, color: &str) {
        let (gap, protrusion, width) = (HOGEN_GAP_MM, HOGEN_PROTRUSION_MM, HOGEN_LINE_WIDTH_PT);
        for offset in -self.half_x..=self.half_x {
            let x = self.x(offset);
            if hogen_extends(offset, self.half_x) {
                canvas.line(
                    x,
                    self.y_min - gap,
                    x,
                    self.y_min - gap - protrusion,
                    width,
                    color,
                );
                canvas.line(
                    x,
                    self.y_max + gap,
                    x,
                    self.y_max + gap + protrusion,
                    width,
                    color,
                );
            }
            if offset % HOGEN_MARKER_PERIOD == 0 {
                canvas.dot(
                    x,
                    self.y_min - HOGEN_DOT_OFFSET_MM,
                    HOGEN_DOT_RADIUS_MM,
                    color,
                );
                canvas.dot(
                    x,
                    self.y_max + HOGEN_DOT_OFFSET_MM,
                    HOGEN_DOT_RADIUS_MM,
                    color,
                );
            }
        }
        for offset in -self.half_y..=self.half_y {
            let y = self.y(offset);
            if hogen_extends(offset, self.half_y) {
                canvas.line(
                    self.x_min - gap,
                    y,
                    self.x_min - gap - protrusion,
                    y,
                    width,
                    color,
                );
                canvas.line(
                    self.x_max + gap,
                    y,
                    self.x_max + gap + protrusion,
                    y,
                    width,
                    color,
                );
            }
            if offset % HOGEN_MARKER_PERIOD == 0 {
                canvas.dot(
                    self.x_min - HOGEN_DOT_OFFSET_MM,
                    y,
                    HOGEN_DOT_RADIUS_MM,
                    color,
                );
                canvas.dot(
                    self.x_max + HOGEN_DOT_OFFSET_MM,
                    y,
                    HOGEN_DOT_RADIUS_MM,
                    color,
                );
            }
        }
    }
}

/// 格线区域半宽包含的格数；`centered_extent` 保证两端严格对称。
fn half_cells(min: f64, max: f64) -> i32 {
    ((max - min) / (2.0 * HOGEN_SPACING_MM)).round() as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn centered_extent_reserves_inset_on_both_sides() {
        // A5 页心宽 112mm：留白 2.2mm 后每边 10 格；不留白时每边 11 格。
        assert_eq!(centered_extent(18.0, 112.0, 5.0, 2.2), (24.0, 124.0));
        assert_eq!(centered_extent(18.0, 112.0, 5.0, 0.0), (19.0, 129.0));
    }

    #[test]
    fn centered_extent_degenerates_when_inset_does_not_fit() {
        assert_eq!(centered_extent(18.0, 1.0, 5.0, 2.2), (18.5, 18.5));
    }

    #[test]
    fn hogen_extends_every_other_line_but_not_edges_or_marks() {
        assert!(hogen_extends(2, 10));
        assert!(hogen_extends(-14, 17));
        assert!(!hogen_extends(3, 10));
        assert!(!hogen_extends(0, 10));
        assert!(!hogen_extends(10, 10));
        assert!(!hogen_extends(10, 17));
        // 半宽为奇数时最外圈是奇数偏移，内一圈 16 仍按隔线规则伸出。
        assert!(hogen_extends(16, 17));
        assert!(!hogen_extends(17, 17));
    }
}
