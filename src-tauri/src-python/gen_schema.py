"""Generate JSON schemas for pytauri request models into the frontend tree.

`yarn build` runs `yarn schema` before `tsc`; the frontend imports the schema
to type-check the IPC payload shape, so a frontend/backend field drift fails
the build instead of only failing at runtime.
"""

import json
from pathlib import Path

from models import RunPipelineRequest

_SCHEMA_PATH = (
    Path(__file__).resolve().parent.parent.parent
    / "src"
    / "pipeline-request.schema.json"
)


def schema_text() -> str:
    return json.dumps(
        RunPipelineRequest.model_json_schema(mode="serialization"), indent=2
    )


def main() -> None:
    _SCHEMA_PATH.write_text(schema_text() + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
