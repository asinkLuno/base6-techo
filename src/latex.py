"""LaTeX renderer: draws precomputed OutputPages, knows nothing about
pageCount / parity / booklet semantics."""

from pathlib import Path

from src.imposition import OutputPage
from src.midori import MidoriPattern
from src.pages import PAGE_NUMBER_COLOR, Pattern
from src.timeline import TimelinePattern

_DOC = """\\documentclass[multi=tikzpicture]{standalone}
%s
\\usepackage{tikz}
%s
\\begin{document}
%s
\\end{document}
"""


def _name(h: str) -> str:
    return "c" + h.lstrip("#")


def _tex(text: str) -> str:
    """Escape user text before inserting it into a TikZ node."""
    escaped = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "#": r"\#",
        "$": r"\$",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "^": r"\textasciicircum{}",
        "~": r"\textasciitilde{}",
    }
    return "".join(escaped.get(char, char) for char in text)


def _font_command(font: str) -> str:
    if font.lstrip().startswith("\\"):
        return font
    path = Path(font)
    if path.suffix.lower() in {".otf", ".ttf", ".ttc"}:
        return (
            f"\\fontspec[Path={_tex(path.parent.as_posix() + '/')}]"
            f"{{{_tex(path.name)}}}"
        )
    return f"\\fontspec{{{_tex(font)}}}"


def _page(op: OutputPage, pattern: Pattern) -> str:
    parts = [f"\\useasboundingbox (0,0) rectangle ({op.width:g},{op.height:g});"]
    line_cmds: dict[tuple[str, float | None], list[str]] = {}
    dot_cmds: dict[str, list[str]] = {}
    for p in op.placements:
        for l in p.draw.lines:
            name = "patterncolor" if l.color is None else _name(l.color)
            line_cmds.setdefault((name, l.width), []).append(
                f"  \\draw ({p.dx + l.x1:g},{l.y1:g}) -- ({p.dx + l.x2:g},{l.y2:g});"
            )
        for d in p.draw.dots:
            name = "patterncolor" if d.color is None else _name(d.color)
            dot_cmds.setdefault(name, []).append(
                f"  \\fill ({p.dx + d.x - d.radius:g},{d.y - d.radius:g}) "
                f"rectangle ({p.dx + d.x + d.radius:g},{d.y + d.radius:g});"
                if d.square
                else f"  \\fill ({p.dx + d.x:g},{d.y:g}) circle ({d.radius:g});"
            )
    for (name, width), cmds in line_cmds.items():
        w = pattern.line_width if width is None else width
        parts.append(
            f"\\begin{{scope}}[{name}, line width={w:g}pt]\n"
            + "\n".join(cmds)
            + "\n\\end{scope}"
        )
    for name, cmds in dot_cmds.items():
        parts.append(f"\\begin{{scope}}[{name}]\n" + "\n".join(cmds) + "\n\\end{scope}")
    for p in op.placements:
        for t in p.draw.texts:
            name = "pnumcolor" if t.color == PAGE_NUMBER_COLOR else _name(t.color)
            parts.append(
                f"\\node[{name}, rotate={t.rotation:g}, anchor={t.anchor}, "
                f"font={{{_font_command(t.font)}\\fontsize{{{t.size_pt:g}}}{{{t.size_pt * 1.2:g}}}\\selectfont}}] "
                f"at ({p.dx + t.x:g},{t.y:g}) {{{_tex(t.content)}}};"
            )
    return (
        "\\begin{tikzpicture}[x=1mm, y=-1mm]\n"
        + "\n".join(parts)
        + "\n\\end{tikzpicture}"
    )


def render_latex(output_pages: list[OutputPage], pattern: Pattern) -> str:
    colors = {"patterncolor": pattern.line_color, "pnumcolor": PAGE_NUMBER_COLOR}
    for h in (
        getattr(pattern, "margin_color", None),
        getattr(pattern, "hline_edge_color", None),
        getattr(pattern, "vline_edge_color", None),
        getattr(pattern, "dot_center_color", None),
        pattern.dot_color if isinstance(pattern, MidoriPattern) else None,
        pattern.line_color if isinstance(pattern, TimelinePattern) else None,
    ):
        if h is not None:
            colors[_name(h)] = h
    defines = "\n".join(
        f"\\definecolor{{{name}}}{{HTML}}{{{color.lstrip('#').upper()}}}"
        for name, color in colors.items()
    )
    body = "\n\n".join(_page(op, pattern) for op in output_pages)
    uses_font_name = any(
        t.font and not t.font.lstrip().startswith("\\")
        for op in output_pages
        for placement in op.placements
        for t in placement.draw.texts
    )
    packages = "\\usepackage{fontspec}" if uses_font_name else ""
    return _DOC % (packages, defines, body)
