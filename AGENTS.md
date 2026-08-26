# Project instructions

## Scope

- Desktop Tauri application with a React frontend and a Rust backend in `src-tauri`.
- Keep platform scope as the project already defines it; do not add mobile/web targets speculatively.

## Tauri documentation

- This project pins `tauri 2.11.5` (see `Cargo.lock`).
- Before every response that inspects, designs, changes, reviews, or explains Tauri code, call the configured `rust-docs-tauri` MCP server.
- Query the relevant API for the exact pinned dependency version before relying on its behavior or signatures. Do not rely only on memory, generic web examples, or examples from another version.
- Treat the MCP result as documentation evidence, then verify the actual project with the local source, `Cargo.toml`/`Cargo.lock`, and compiler when implementing changes.
- If the MCP result is incomplete or conflicts with the checked-out dependency, state the discrepancy and prefer the pinned local dependency plus a compiling minimal example.

## Change workflow

- Inspect the existing code and callers before editing.
- Prefer the smallest idiomatic change; do not add abstractions or dependencies without a concrete need.
- After Rust changes, run at least `cargo fmt -- --check` and `cargo check`; run Clippy when practical.
- After Python changes, run `uv run ruff check` and the project's pytest suite when present.
