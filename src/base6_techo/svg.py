"""SVG preview renderer: same OutputPages as LaTeX, no layout logic."""

from base6_techo.imposition import OutputPage
from base6_techo.models import RuledPattern
from base6_techo.pages import PT_TO_MM


def render_svg(op: OutputPage, pattern: RuledPattern) -> str:
    lines = "\n".join(
        f'  <line x1="{p.dx + l.x1:g}" y1="{l.y1:g}" x2="{p.dx + l.x2:g}" y2="{l.y2:g}"/>'
        for p in op.placements
        for l in p.draw.lines
    )
    texts = "\n".join(
        f'  <text x="{p.dx + t.x:g}" y="{t.y:g}" text-anchor="middle" dominant-baseline="central" '
        f'font-family="sans-serif" font-size="{t.size_pt * PT_TO_MM:.2f}" fill="{t.color}">{t.content}</text>'
        for p in op.placements
        for t in p.draw.texts
    )
    w, h = f"{op.width:g}", f"{op.height:g}"
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}mm" height="{h}mm" viewBox="0 0 {w} {h}">\n'
        f'<g stroke="{pattern.line_color}" stroke-width="{pattern.line_width * PT_TO_MM:.4f}">\n'
        f"{lines}\n</g>\n{texts}\n</svg>\n"
    )
