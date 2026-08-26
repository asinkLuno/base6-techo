"""The frontend schema contract must not silently drift from the request models."""

from pathlib import Path

import gen_schema
from models import RunPipelineRequest

_SCHEMA = (
    (
        Path(__file__).resolve().parent.parent
        / "src-tauri"
        / "src-python"
        / "gen_schema.py"
    )
    .resolve()
    .parent.parent.parent
    / "src"
    / "pipeline-request.schema.json"
)


def test_frontend_schema_matches_request_models():
    assert _SCHEMA.read_text(encoding="utf-8") == gen_schema.schema_text() + "\n"


def test_schema_accepts_real_frontend_payload():
    request = RunPipelineRequest.model_validate(
        {
            "output": "/tmp/out.pdf",
            "sections": [
                {
                    "page": {"width": 148, "height": 210},
                    "document": {
                        "page_count": 32,
                        "binding_text": "base-6",
                        "header_date": "2025-01-01",
                    },
                    "pattern": {"kind": "basic", "spacing": 8, "draw_hlines": True},
                }
            ],
            "add_pages": {"leading": 0, "trailing": 2},
            "bind": {"mode": "booklet", "sheets_per_group": 4},
        }
    )
    assert request.sections[0].pattern.kind == "basic"
