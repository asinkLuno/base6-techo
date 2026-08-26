# base6-techo

PyTauri + PyO3 桌面应用框架，前端使用 Yarn、TypeScript、React 和 Vite。

排版、拼版和 PDF 生成由 `src-tauri/src/backend.rs` 中的原生 Tauri commands 提供。

## 开发

```sh
yarn install
uv venv --python-preference only-system
source .venv/bin/activate
uv sync
yarn tauri dev
```

## 检查

```sh
yarn build
uv run pytest -q
uv run ruff check .
cargo check --workspace
```
