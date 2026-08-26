from pathlib import Path

from anyio import to_thread
from anyio.from_thread import start_blocking_portal
from api import DocumentSettings, PageSettings, Pipeline
from pytauri import Commands, builder_factory, context_factory
from template.basic import BasicPattern

commands = Commands()


def _generate_pdf(output: Path) -> None:
    (
        Pipeline(
            BasicPattern(spacing=8, draw_hlines=True),
            PageSettings(148, 210),
            DocumentSettings(page_count=32, show_page_number=False),
        )
        .add_pages(trailing=2)
        .bind("booklet")
        .run(output)
    )


@commands.command()
async def run_pipeline(body: str) -> str:
    output = Path(body)
    if not output.name:
        raise ValueError("输出文件名不能为空")
    await to_thread.run_sync(_generate_pdf, output)
    return str(output)


def main() -> int:
    with start_blocking_portal() as portal:
        app = builder_factory().build(
            context=context_factory(),
            invoke_handler=commands.generate_handler(portal),
        )
        return app.run_return()
