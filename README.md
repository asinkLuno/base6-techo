# base6-techo

用于生成可打印笔记本 PDF 的 Python 库。所有页面尺寸使用 mm，线宽和字号使用 pt。

## 安装

```sh
uv sync
```

生成 PDF 还需要系统中存在 `tectonic`、`xelatex` 或 `pdflatex`；也可以在 `run()` 中显式指定引擎。

## 用法

```python
from src import BasicPattern, DocumentSettings, PageSettings, Pipeline

result = (
    Pipeline(
        BasicPattern(spacing=8, draw_hlines=True),
        PageSettings(width=148, height=210),
        DocumentSettings(page_count=32, binding_text="base-6"),
    )
    .add_pages(trailing=2)
    .bind("booklet")
    .run("notebook.pdf")
)

print(result.pdf, result.logical_pages, result.sheets)
```

现有 PDF 可以追加到生成内容之后：

```python
pipeline.merge("appendix.pdf")
```

同一纸张尺寸的不同版式可以组成一本笔记本：

```python
from src import MidoriPattern

pipeline.add_section(
    MidoriPattern(spacing=5),
    DocumentSettings(page_count=16),
)
```

处理顺序固定为：生成各 section → 合并外部 PDF → 添加空白页 → 拼版。`bind()` 支持 `booklet` 和 `thread`；后者可传 `sheets_per_group`。

自定义同步处理可通过 `append()` 插入到补白和拼版之间。step 接收共享的 `PipelineContext`：

```python
from src import PipelineContext


def inspect(context: PipelineContext) -> None:
    print(context.current_pdf, context.merged_pages)


pipeline.append(inspect)
```

## 测试

```sh
uv run pytest
uv run ruff check .
uv run ty check
```
