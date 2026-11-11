#!/usr/bin/env python3
"""Verify actual PDF halves, page order, blank padding and binding-side watermarks (Ghostscript)."""
import struct
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HALF_WIDTH_PT = 148 * 72 / 25.4


def check_sample(name, expected):
    pdf = ROOT / f"build/{name}-sample.pdf"
    result = subprocess.run(
        ["gs", "-q", "-dBATCH", "-dNOPAUSE", "-sDEVICE=txtwrite", "-dTextFormat=0",
         "-sOutputFile=-", str(pdf)], check=True, capture_output=True, text=True,
    )
    pages = ET.fromstring("<document>" + result.stdout + "</document>").findall("page")
    assert len(pages) == len(expected), (name, len(pages))
    for index, (page, pair) in enumerate(zip(pages, expected)):
        spans = [("".join(char.attrib["c"] for char in span.findall("char")),
                  list(map(float, span.attrib["bbox"].split()))) for span in page.findall("span")]
        for half, physical_page in enumerate(pair):
            visible = [(text, bounds) for text, bounds in spans
                       if int((bounds[0] + bounds[2]) / 2 >= HALF_WIDTH_PT) == half]
            if physical_page is None:
                assert visible == [], (name, index, half, "padding has decorations", visible)
                continue
            footer = [(text, bounds) for text, bounds in visible if min(bounds[1], bounds[3]) > 550]
            assert [text for text, _ in footer] == [str(physical_page)], (name, index, half, footer)
            assert sum(text == "BOOK" for text, _ in visible) == 1
            inner = next(bounds for text, bounds in visible if text == "INNER")
            outer = next(bounds for text, bounds in visible if text == "OUTER")
            binding_left = physical_page % 2 == 1
            assert (inner[0] < outer[0]) == binding_left, (name, physical_page, "watermarks reversed")
            footer_x = (footer[0][1][0] + footer[0][1][2]) / 2
            assert (footer_x > (half + 0.5) * HALF_WIDTH_PT) == binding_left
    # Raster dimensions also verify that the PDF media is 296×210mm, not just a source option.
    png = subprocess.run(
        ["gs", "-q", "-dBATCH", "-dNOPAUSE", "-sDEVICE=png16m", "-r72",
         "-dFirstPage=1", "-dLastPage=1", "-sOutputFile=-", str(pdf)],
        check=True, capture_output=True,
    ).stdout
    assert png.startswith(b"\x89PNG\r\n\x1a\n")
    width, height = struct.unpack(">II", png[16:24])
    assert abs(width - HALF_WIDTH_PT * 2) <= 1 and abs(height - 210 * 72 / 25.4) <= 1
    print(f"{name}: verified {len(pages)} PDF sides, page order, blank padding and mirrored regions.")


if __name__ == "__main__":
    check_sample("booklet", [(None, 1), (2, None), (None, 3), (4, 5)])
    check_sample("thread", [(8, 1), (2, 7), (6, 3), (4, 5),
                            (None, 9), (10, None), (None, None), (None, None)])
