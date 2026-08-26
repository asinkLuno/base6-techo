import sys
from base64 import b64decode
from types import SimpleNamespace


class Commands:
    def command(self):
        return lambda function: function


sys.modules.setdefault(
    "pytauri",
    SimpleNamespace(
        Commands=Commands,
        builder_factory=None,
        context_factory=None,
    ),
)

import app
from models import RenderSectionRequest


def test_preview_renders_exactly_two_pages(monkeypatch):
    def run(pipeline, output):
        assert pipeline.document.page_count == 2
        output.write_bytes(b"pdf")

    monkeypatch.setattr(app.Pipeline, "run", run)

    preview = app._preview_pdf(
        RenderSectionRequest.model_validate(
            {"document": {"page_count": 99}, "pattern": {"kind": "basic"}}
        )
    )

    assert b64decode(preview) == b"pdf"
