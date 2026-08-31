//! 制图网格 — 与月打卡一样沿长边横放的极细方格纸：横轴 1–31 代表三十一天，
//! 每天细分 5 小格，因此每 5 条格线（日界线）加粗；31 外再多留一组 5 格；纵轴无文字。
//! 数字带可选压页面右缘（默认）或左缘，横放阅读时分别位于网格下方或上方。

use serde::Deserialize;

use super::{Geometry, Line, LineStyle, Rect, Text, validate_color};

const DAYS: usize = 31; // 横轴格数：一个月三十一天
const SUB: usize = 5; // 每天细分的小格数，加粗线即日界线
const AXIS_H: f64 = 5.0; // mm，横轴标签带高

/// 横轴数字位置：右侧页面顺时针转 90° 读，左侧逆时针转 90° 读。
#[derive(Clone, Copy, Default, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum AxisSide {
    #[default]
    Right,
    Left,
}

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct GraphPattern {
    pub(crate) axis: AxisSide,
    pub(crate) line_color: String,
    pub(crate) line_width: f64,
    pub(crate) date_size: f64,
}
impl Default for GraphPattern {
    fn default() -> Self {
        Self {
            axis: AxisSide::default(),
            line_color: "#7a7a7a".into(),
            line_width: 0.2,
            date_size: 8.0,
        }
    }
}
impl GraphPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if self.line_width <= 0.0 || self.date_size <= 0.0 {
            return Err("line_width and date_size must be > 0".into());
        }
        validate_color(&self.line_color)
    }
}

pub(crate) fn draw_graph(geo: Geometry, p: &GraphPattern, font: &str) -> (Vec<Line>, Vec<Text>) {
    let mut lines = Vec::new();
    let mut texts = Vec::new();
    let r = geo.content;
    // 与月历/月打卡一致：横放设计坐标系，画完后整体逆时针旋转 90° 落到页面。
    let land = Rect {
        x: 0.0,
        y: 0.0,
        width: r.height,
        height: r.width,
    };
    let cols = (DAYS + 1) * SUB; // 31 天外再多一组 5 格，末组不标数
    let cell = land.width / f64::from(cols as u16); // 正方形小格
    // 行数取 SUB 的倍数，保证上下边框与日界线同为粗线。
    let rows = ((land.height - AXIS_H) / cell) as usize / SUB * SUB;
    let gh = f64::from(rows as u16) * cell;
    // 数字在右侧时标签带在页面右缘（设计 y 大端），在左侧时镜像到设计 y 小端。
    let axis_left = p.axis == AxisSide::Left;
    let gy = land.y + if axis_left { AXIS_H } else { 0.0 } + (land.height - AXIS_H - gh) / 2.0;
    // 粗线为细线的两倍；颜色留空沿用版式线色。
    let line = |x1: f64, y1: f64, x2: f64, y2: f64, bold: bool| Line {
        x1,
        y1,
        x2,
        y2,
        color: None,
        width: Some(if bold {
            p.line_width * 2.0
        } else {
            p.line_width
        }),
        style: LineStyle::Solid,
    };
    for i in 0..=cols {
        let x = land.x + cell * i as f64;
        lines.push(line(x, gy, x, gy + gh, i % SUB == 0));
    }
    for j in 0..=rows {
        let y = gy + cell * j as f64;
        lines.push(line(land.x, y, land.x + land.width, y, j % SUB == 0));
    }
    // 标签居中压在第 d 条日界粗线上，1–31 共 31 条（起点粗线与末组 5 格不标）。
    // 右侧变体序号镜像（1 在页面顶侧），逆时针转 90° 后从左到右 1→31；
    // 左侧变体顺时针转 90° 后同样 1→31 从左到右。
    for d in 1..=DAYS {
        texts.push(Text {
            x: land.x
                + if axis_left {
                    f64::from(d as u16)
                } else {
                    f64::from((DAYS + 1 - d) as u16)
                } * f64::from(SUB as u16)
                    * cell,
            y: if axis_left { gy - 0.4 } else { gy + gh + 0.4 },
            content: d.to_string(),
            size: p.date_size,
            color: p.line_color.clone(),
            rotation: 0,
            font: font.into(),
            // 旋转 270° 时锚 south 才让文字体朝设计 y 大端（网格外）；旋转 90° 时朝 y 小端。
            anchor: "south",
        });
    }
    // 整体逆时针旋转 90°（同月历页），文字锚点保持原名。
    let base = r.y + r.height;
    let left = r.x;
    for line in &mut lines {
        let (x1, y1) = (left + line.y1, base - line.x1);
        let (x2, y2) = (left + line.y2, base - line.x2);
        line.x1 = x1;
        line.y1 = y1;
        line.x2 = x2;
        line.y2 = y2;
    }
    for text in &mut texts {
        let (x, y) = (left + text.y, base - text.x);
        text.x = x;
        text.y = y;
        // 右缘数字顺笔画朝页面左（逆时针转 90° 可读），左缘数字朝页面右（顺时针转 90° 可读）。
        text.rotation = if axis_left { 90 } else { 270 };
    }
    (lines, texts)
}
/// 手工样张：cargo test render_graph_sample -- --ignored --nocapture
#[test]
#[ignore]
fn render_graph_sample() {
    for (axis, file) in [
        ("right", "/tmp/graph-sample.pdf"),
        ("left", "/tmp/graph-sample-left.pdf"),
    ] {
        let body: super::RunPipelineRequest = serde_json::from_str(&format!(
            r#"{{
                "output": "{file}",
                "sections": [{{
                    "pattern": {{ "kind": "graph", "axis": "{axis}" }},
                    "document": {{ "page_number": false }}
                }}]
            }}"#,
        ))
        .unwrap();
        let (path, _) = super::generate(body, false, None).unwrap();
        println!("PDF: {}", path.display());
    }
}

#[cfg(test)]
mod tests {
    use super::super::{PageSettings, geometry_for};
    use super::*;

    #[test]
    fn grid_has_bold_lines_every_five_cells() {
        let page = PageSettings::default();
        let r = geometry_for(&page, 1).content;
        let p = GraphPattern::default();
        let (lines, texts) = draw_graph(geometry_for(&page, 1), &p, r"\sffamily");
        // A5 默认页：设计区 190×125，格 190/160≈1.188mm，行数 (120/格)÷5×5=100。
        // 竖线 161（粗 33）+ 横线 101（粗 21）。
        assert_eq!(lines.len(), 161 + 101);
        let bold = lines
            .iter()
            .filter(|l| l.width == Some(p.line_width * 2.0))
            .count();
        assert_eq!(bold, 33 + 21);
        // 横轴 1–31 标签（末组 5 格不标），无其他文字。
        assert_eq!(texts.len(), 31);
        assert_eq!(texts[0].content, "1");
        assert_eq!(texts[30].content, "31");
        assert_eq!(texts[0].anchor, "south");
        assert_eq!(texts[0].rotation, 270);
        // 序号镜像：标签 1 在最末日界线（155 格，页面顶侧），页面 y = 顶边 + 5 格；
        // 标签 31 在第 1 条日界线（5 格）上，页面 y = 底边 − 5 格。
        let cell = r.height / 160.0;
        assert!((texts[0].y - (r.y + 5.0 * cell)).abs() < 0.01);
        assert!((texts[30].y - (r.y + r.height - 5.0 * cell)).abs() < 0.01);
    }

    #[test]
    fn left_axis_mirrors_labels() {
        let page = PageSettings::default();
        let r = geometry_for(&page, 1).content;
        let p = GraphPattern {
            axis: AxisSide::Left,
            ..Default::default()
        };
        let (_, texts) = draw_graph(geometry_for(&page, 1), &p, r"\sffamily");
        assert_eq!(texts.len(), 31);
        assert_eq!(texts[0].content, "1");
        assert_eq!(texts[0].anchor, "south");
        // 左缘变体数字方向 rotation 90（顺时针转 90° 可读），1 在第 1 条日界线上；
        // 标签带在页面左缘：页面 x = 内容左缘 + gy − 0.4。
        assert_eq!(texts[0].rotation, 90);
        let cell = r.height / 160.0;
        let gh = 100.0 * cell;
        let gy = 5.0 + (r.width - 5.0 - gh) / 2.0;
        assert!((texts[0].x - (r.x + gy - 0.4)).abs() < 0.01);
        // 序号位置不变：标签 1 仍在第 1 条日界线（5 格）上。
        assert!((texts[0].y - (r.y + r.height - 5.0 * cell)).abs() < 0.01);
        assert!((texts[30].y - (r.y + 5.0 * cell)).abs() < 0.01);
    }

    #[test]
    fn validate_checks_sizes_and_color() {
        let p = GraphPattern::default();
        assert!(p.validate().is_ok());
        assert!(
            GraphPattern {
                line_width: 0.0,
                ..p.clone()
            }
            .validate()
            .is_err()
        );
        assert!(
            GraphPattern {
                line_color: "red".into(),
                ..p.clone()
            }
            .validate()
            .is_err()
        );
    }
}
