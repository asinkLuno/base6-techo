#!/usr/bin/env python3
"""Check the PDF produced by e2e_document (requires Ghostscript)."""
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def check_sample(pdf: Path) -> None:
    result = subprocess.run(
        ["gs", "-q", "-dBATCH", "-dNOPAUSE", "-sDEVICE=txtwrite", "-dTextFormat=0",
         "-sOutputFile=-", str(pdf)],
        check=True, capture_output=True, text=True,
    )
    pages = ET.fromstring("<document>" + result.stdout + "</document>").findall("page")
    assert len(pages) == 5, f"Expected 5 pages, got {len(pages)}"
    for index, page in enumerate(pages, 1):
        spans = [
            ("".join(c.attrib["c"] for c in span.findall("char")),
             list(map(float, span.attrib["bbox"].split())))
            for span in page.findall("span")
        ]
        inner = next(bounds for text, bounds in spans if text == "INNER")
        outer = next(bounds for text, bounds in spans if text == "OUTER")
        assert (inner[0] < outer[0]) == (index % 2 == 1), f"Page {index}: watermarks reversed"
        footer = [text for text, bounds in spans if min(bounds[1], bounds[3]) > 550]
        expected = [] if index <= 3 else [str(index - 3)]
        assert footer == expected, f"Page {index}: expected footer {expected}, got {footer}"
        header = "".join(text for text, bounds in spans if bounds[1] < 40)
        for literal in ["100%", "&", "#1_{}", "$", "\\", "^", "~"]:
            assert literal in header, f"Page {index}: missing literal {literal!r}"
    print("Verified 5 pages: mirrored watermarks, independent page numbering, escaped text.")


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    check_sample(Path(sys.argv[1]) if len(sys.argv) > 1 else root / "build/framework-sample.pdf")
