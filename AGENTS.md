# Project instructions

## Scope

- Desktop Tauri application with a Python (pytauri) frontend logic layer and a Rust shell in `src-tauri`.
- Keep platform scope as the project already defines it; do not add mobile/web targets speculatively.

## pytauri / Tauri documentation

- This project pins `pytauri 0.8.0` and `tauri 2.11.5` (see `Cargo.lock`).
- Before every response that inspects, designs, changes, reviews, or explains pytauri/Tauri code, call the configured `rust-docs-mcp-server` via `query_pytauri_docs` or `query_tauri_docs`.
- Query the relevant API for the exact pinned dependency version before relying on its behavior or signatures. Do not rely only on memory, generic web examples, or examples from another version.
- Treat the MCP result as documentation evidence, then verify the actual project with the local source, `Cargo.toml`/`Cargo.lock`, and compiler when implementing changes.
- If the MCP result is incomplete or conflicts with the checked-out dependency, state the discrepancy and prefer the pinned local dependency plus a compiling minimal example.

## Change workflow

- Inspect the existing code and callers before editing.
- Prefer the smallest idiomatic change; do not add abstractions or dependencies without a concrete need.
- After Rust changes, run at least `cargo fmt -- --check` and `cargo check`; run Clippy when practical.
- After Python changes, run `uv run ruff check` and the project's pytest suite when present.
