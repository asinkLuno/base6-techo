use serde::Deserialize;

use super::{Dot, Geometry, Line, LineStyle, centered, inset, region, validate_color};

#[derive(Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(crate) struct BasicPattern {
    pub(crate) pages: usize,
    pub(crate) spacing: f64,
    pub(crate) line_width: f64,
    pub(crate) line_color: String,
    pub(crate) line_style: LineStyle,
    pub(crate) draw_hlines: bool,
    pub(crate) draw_vlines: bool,
    pub(crate) draw_dots: bool,
    pub(crate) hline_top_color: String,
    pub(crate) hline_top_width: f64,
    pub(crate) hline_top_style: LineStyle,
    pub(crate) hline_bottom_color: String,
    pub(crate) hline_bottom_width: f64,
    pub(crate) hline_bottom_style: LineStyle,
    pub(crate) hline_center_color: String,
    pub(crate) hline_center_width: f64,
    pub(crate) hline_center_style: LineStyle,
    pub(crate) vline_left_color: String,
    pub(crate) vline_left_width: f64,
    pub(crate) vline_left_style: LineStyle,
    pub(crate) vline_right_color: String,
    pub(crate) vline_right_width: f64,
    pub(crate) vline_right_style: LineStyle,
    pub(crate) vline_center_color: String,
    pub(crate) vline_center_width: f64,
    pub(crate) vline_center_style: LineStyle,
    pub(crate) dot_center_color: Option<String>,
    pub(crate) hline_header: bool,
    pub(crate) hline_footer: bool,
    pub(crate) hline_inner: bool,
    pub(crate) hline_outer: bool,
    pub(crate) vline_header: bool,
    pub(crate) vline_footer: bool,
    pub(crate) vline_inner: bool,
    pub(crate) vline_outer: bool,
    pub(crate) dot_header: bool,
    pub(crate) dot_footer: bool,
    pub(crate) dot_inner: bool,
    pub(crate) dot_outer: bool,
    pub(crate) dot_spacing: Option<f64>,
    pub(crate) dot_radius: f64,
    pub(crate) vline_spacing: Option<f64>,
    pub(crate) vline_width: f64,
    pub(crate) vline_color: String,
    pub(crate) vline_style: LineStyle,
    pub(crate) hline_top: f64,
    pub(crate) hline_bottom: f64,
    pub(crate) hline_left: f64,
    pub(crate) hline_right: f64,
    pub(crate) vline_top: f64,
    pub(crate) vline_bottom: f64,
    pub(crate) vline_left: f64,
    pub(crate) vline_right: f64,
    pub(crate) dot_top: f64,
    pub(crate) dot_bottom: f64,
    pub(crate) dot_left: f64,
    pub(crate) dot_right: f64,
}

impl Default for BasicPattern {
    fn default() -> Self {
        Self {
            pages: 1,
            spacing: 8.0,
            line_width: 0.2,
            line_color: "#B0B0B0".into(),
            line_style: LineStyle::Solid,
            draw_hlines: false,
            draw_vlines: false,
            draw_dots: false,
            hline_top_color: "#B0B0B0".into(),
            hline_top_width: 0.2,
            hline_top_style: LineStyle::Solid,
            hline_bottom_color: "#B0B0B0".into(),
            hline_bottom_width: 0.2,
            hline_bottom_style: LineStyle::Solid,
            hline_center_color: "#B0B0B0".into(),
            hline_center_width: 0.2,
            hline_center_style: LineStyle::Solid,
            vline_left_color: "#B0B0B0".into(),
            vline_left_width: 0.2,
            vline_left_style: LineStyle::Solid,
            vline_right_color: "#B0B0B0".into(),
            vline_right_width: 0.2,
            vline_right_style: LineStyle::Solid,
            vline_center_color: "#B0B0B0".into(),
            vline_center_width: 0.2,
            vline_center_style: LineStyle::Solid,
            dot_center_color: None,
            hline_header: false,
            hline_footer: false,
            hline_inner: false,
            hline_outer: false,
            vline_header: false,
            vline_footer: false,
            vline_inner: false,
            vline_outer: false,
            dot_header: false,
            dot_footer: false,
            dot_inner: false,
            dot_outer: false,
            dot_spacing: None,
            dot_radius: 0.3,
            vline_spacing: None,
            vline_width: 0.2,
            vline_color: "#B0B0B0".into(),
            vline_style: LineStyle::Solid,
            hline_top: 0.0,
            hline_bottom: 0.0,
            hline_left: 0.0,
            hline_right: 0.0,
            vline_top: 0.0,
            vline_bottom: 0.0,
            vline_left: 0.0,
            vline_right: 0.0,
            dot_top: 0.0,
            dot_bottom: 0.0,
            dot_left: 0.0,
            dot_right: 0.0,
        }
    }
}

impl BasicPattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if !(1..=500).contains(&self.pages) {
            return Err("pages must be in 1..=500".into());
        }
        if self.spacing <= 0.0
            || self.line_width <= 0.0
            || self.vline_width <= 0.0
            || self.hline_top_width <= 0.0
            || self.hline_bottom_width <= 0.0
            || self.hline_center_width <= 0.0
            || self.vline_left_width <= 0.0
            || self.vline_right_width <= 0.0
            || self.vline_center_width <= 0.0
            || self.dot_radius <= 0.0
        {
            return Err("spacing, line widths and dot_radius must be > 0".into());
        }
        for value in [self.dot_spacing, self.vline_spacing].into_iter().flatten() {
            if value <= 0.0 {
                return Err("optional pattern lengths must be > 0".into());
            }
        }
        if [
            self.hline_top,
            self.hline_bottom,
            self.hline_left,
            self.hline_right,
            self.vline_top,
            self.vline_bottom,
            self.vline_left,
            self.vline_right,
            self.dot_top,
            self.dot_bottom,
            self.dot_left,
            self.dot_right,
        ]
        .into_iter()
        .any(|value| value < 0.0)
        {
            return Err("pattern edge distances must be >= 0".into());
        }
        for color in [
            &self.line_color,
            &self.vline_color,
            &self.hline_top_color,
            &self.hline_bottom_color,
            &self.hline_center_color,
            &self.vline_left_color,
            &self.vline_right_color,
            &self.vline_center_color,
        ] {
            validate_color(color)?;
        }
        if let Some(color) = &self.dot_center_color {
            validate_color(color)?;
        }
        Ok(())
    }
}

pub(crate) fn draw_basic(geo: Geometry, p: &BasicPattern) -> (Vec<Line>, Vec<Dot>) {
    let hr = inset(
        region(
            geo,
            p.hline_header,
            p.hline_footer,
            p.hline_inner,
            p.hline_outer,
        ),
        p.hline_top,
        p.hline_bottom,
        p.hline_left,
        p.hline_right,
    );
    let vr = inset(
        region(
            geo,
            p.vline_header,
            p.vline_footer,
            p.vline_inner,
            p.vline_outer,
        ),
        p.vline_top,
        p.vline_bottom,
        p.vline_left,
        p.vline_right,
    );
    let dr = inset(
        region(geo, p.dot_header, p.dot_footer, p.dot_inner, p.dot_outer),
        p.dot_top,
        p.dot_bottom,
        p.dot_left,
        p.dot_right,
    );
    let ys = if p.draw_hlines {
        centered(hr.y, hr.height, p.spacing)
    } else {
        vec![]
    };
    let mut lines = Vec::new();
    for (i, y) in ys.iter().enumerate() {
        let center = i == ys.len() / 2;
        let (color, width, style) = if i == 0 {
            (&p.hline_top_color, p.hline_top_width, p.hline_top_style)
        } else if i + 1 == ys.len() {
            (
                &p.hline_bottom_color,
                p.hline_bottom_width,
                p.hline_bottom_style,
            )
        } else if center {
            (
                &p.hline_center_color,
                p.hline_center_width,
                p.hline_center_style,
            )
        } else {
            (&p.line_color, p.line_width, p.line_style)
        };
        lines.push(Line {
            x1: hr.x,
            y1: *y,
            x2: hr.x + hr.width,
            y2: *y,
            color: Some(color.clone()),
            width: Some(width),
            style,
        });
    }
    if p.draw_vlines {
        let top = vr.y;
        let bottom = vr.y + vr.height;
        if let Some(spacing) = p.vline_spacing {
            let xs = centered(vr.x, vr.width, spacing);
            let count = xs.len();
            for (i, x) in xs.into_iter().enumerate() {
                let center = i == count / 2;
                let (color, width, style) = if i == 0 {
                    (&p.vline_left_color, p.vline_left_width, p.vline_left_style)
                } else if i + 1 == count {
                    (
                        &p.vline_right_color,
                        p.vline_right_width,
                        p.vline_right_style,
                    )
                } else if center {
                    (
                        &p.vline_center_color,
                        p.vline_center_width,
                        p.vline_center_style,
                    )
                } else {
                    (&p.vline_color, p.vline_width, p.vline_style)
                };
                lines.push(Line {
                    x1: x,
                    y1: top,
                    x2: x,
                    y2: bottom,
                    color: Some(color.clone()),
                    width: Some(width),
                    style,
                });
            }
        }
    }
    let mut dots = Vec::new();
    if p.draw_dots
        && let Some(spacing) = p.dot_spacing
    {
        let cx = dr.x + dr.width / 2.0;
        let cy = dr.y + dr.height / 2.0;
        for y in centered(dr.y, dr.height, p.spacing) {
            for x in centered(dr.x, dr.width, spacing) {
                dots.push(Dot {
                    x,
                    y,
                    radius: p.dot_radius,
                    color: ((x - cx).abs() < 1e-9 && (y - cy).abs() < 1e-9)
                        .then(|| p.dot_center_color.clone())
                        .flatten(),
                    square: false,
                });
            }
        }
    }
    (lines, dots)
}
