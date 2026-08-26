# base6-techo

PyTauri + PyO3 桌面应用框架，前端使用 Yarn、TypeScript、React 和 Vite。

原有 Python 后端位于 `src-tauri/src-python/base6_techo/`，目前尚未接入前端 IPC。

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
