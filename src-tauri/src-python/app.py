from base64 import b64encode
from pathlib import Path
from tempfile import TemporaryDirectory

from anyio import to_thread
from anyio.from_thread import start_blocking_portal
from api import Pipeline
from models import (
    BasicPatternRequest,
    BindRequest,
    MidoriPatternRequest,
    PatternRequest,
    RenderSectionRequest,
    RunPipelineRequest,
    TimelinePatternRequest,
)
from pytauri import Commands, builder_factory, context_factory
from template.basic import BasicPattern
from template.midori import MidoriPattern
from template.timeline import TimelinePattern

commands = Commands()


def _pattern_from_request(pattern: PatternRequest):
    values = pattern.model_dump(exclude={"kind"})
    if isinstance(pattern, BasicPatternRequest):
        return BasicPattern(**values)
    if isinstance(pattern, MidoriPatternRequest):
        return MidoriPattern(**values)
    if isinstance(pattern, TimelinePatternRequest):
        return TimelinePattern(**values)
    raise TypeError(f"unsupported pattern: {type(pattern).__name__}")


def _generate_pdf(request: RunPipelineRequest) -> Path:
    output = Path(request.output)
    if not output.name:
        raise ValueError("输出文件名不能为空")

    first, *rest = request.sections
    pipeline = Pipeline(
        _pattern_from_request(first.pattern),
        first.page.to_settings(),
        first.document.to_settings(),
    )
    for section in rest:
        pipeline.add_section(
            _pattern_from_request(section.pattern),
            section.document.to_settings(),
            section.page.to_settings(),
        )
    bind: BindRequest = request.bind
    pipeline.bind(bind.mode, sheets_per_group=bind.sheets_per_group)
    pipeline.run(output)
    return output


def _preview_pdf(request: RenderSectionRequest) -> str:
    document = request.document.model_copy(update={"page_count": 2})
    with TemporaryDirectory(prefix="base6-techo-preview-") as directory:
        output = Path(directory) / "preview.pdf"
        Pipeline(
            _pattern_from_request(request.pattern),
            request.page.to_settings(),
            document.to_settings(),
        ).run(output)
        return b64encode(output.read_bytes()).decode()


@commands.command()
async def run_pipeline(body: RunPipelineRequest) -> str:
    output = await to_thread.run_sync(_generate_pdf, body)
    return str(output)


@commands.command()
async def preview_section(body: RenderSectionRequest) -> str:
    return await to_thread.run_sync(_preview_pdf, body)


def main() -> int:
    with start_blocking_portal() as portal:
        app = builder_factory().build(
            context=context_factory(),
            invoke_handler=commands.generate_handler(portal),
        )
        return app.run_return()
