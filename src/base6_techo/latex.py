"""LaTeX renderer: draws precomputed OutputPages, knows nothing about
pageCount / parity / booklet semantics."""

from base6_techo.imposition import OutputPage
from base6_techo.models import RuledPattern
from base6_techo.pages import PAGE_NUMBER_COLOR

_DOC = """\\documentclass[multi=tikzpicture]{standalone}
\\usepackage{tikz}
\\definecolor{patterncolor}{HTML}{%s}
\\definecolor{pnumcolor}{HTML}{%s}
\\begin{document}
%s
\\end{document}
"""


def _page(op: OutputPage, pattern: RuledPattern) -> str:
    parts = [f"\\useasboundingbox (0,0) rectangle ({op.width:g},{op.height:g});"]
    lines = [
        f"  \\draw ({p.dx + l.x1:g},{l.y1:g}) -- ({p.dx + l.x2:g},{l.y2:g});"
        for p in op.placements
        for l in p.draw.lines
    ]
    if lines:
        parts.append(
            f"\\begin{{scope}}[patterncolor, line width={pattern.line_width:g}pt]\n"
            + "\n".join(lines)
            + "\n\\end{scope}"
        )
    for p in op.placements:
        for t in p.draw.texts:
            parts.append(
                f"\\node[pnumcolor, font=\\sffamily\\fontsize{{{t.size_pt:g}}}{{{t.size_pt * 1.2:g}}}\\selectfont] "
                f"at ({p.dx + t.x:g},{t.y:g}) {{{t.content}}};"
            )
    return (
        "\\begin{tikzpicture}[x=1mm, y=-1mm]\n"
        + "\n".join(parts)
        + "\n\\end{tikzpicture}"
    )


def render_latex(output_pages: list[OutputPage], pattern: RuledPattern) -> str:
    body = "\n\n".join(_page(op, pattern) for op in output_pages)
    return _DOC % (
        pattern.line_color.lstrip("#").upper(),
        PAGE_NUMBER_COLOR.lstrip("#").upper(),
        body,
    )
