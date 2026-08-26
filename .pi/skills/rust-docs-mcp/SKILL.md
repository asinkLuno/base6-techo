---
name: rust-docs-mcp
description: Configure, add, repair, or verify the rust-docs-mcp-server for Rust crates in Pi or Codex. Use whenever the user asks to set up Rust documentation as an MCP server, add another crate such as tauri to the documentation MCP, configure query_pytauri_docs, edit .pi/extensions/rust-docs-mcp.ts, or edit Codex MCP server settings. Use this even when the user only names a Rust crate and asks for its docs to be available to an agent.
---

# Rust Docs MCP

Configure `rustdocs_mcp_server` as one stdio MCP server per crate. The server accepts one Cargo package ID specification, such as `pytauri@0.8.0` or `tauri@2.11.5`; a comma-separated multi-crate argument is not supported.

## Inspect First

1. Read the existing Pi extension at `.pi/extensions/rust-docs-mcp.ts` and Codex configuration at `~/.codex/config.toml` when present.
2. Read `Cargo.toml` and `Cargo.lock`. Use the lockfile's resolved version for an indirect dependency.
3. Find the server binary and working directory. The local convention is a sibling checkout:

```text
../rust-docs-mcp-server/target/release/rustdocs_mcp_server
../rust-docs-mcp-server
```

Do not change existing server configurations or unrelated project files.

## Pi Extension

Pi extensions must bridge each server process and expose a Pi tool. Keep a separate client state for every crate: child process, JSON-RPC request ID, stdout buffer, and pending request map cannot be shared between processes.

- Keep the existing `query_pytauri_docs` tool for the primary crate unless the user asks to rename it.
- Add a distinct local tool for each extra crate, for example `query_tauri_docs`.
- The remote MCP tool remains `query_rust_docs` for every server instance. Only the local Pi tool name changes.
- Start each process with its own package spec. Preserve `RUSTC` and `CARGO_INCREMENTAL=0` from the existing extension because the server's cargo integration may otherwise select the wrong toolchain.
- Provide an environment override for each package spec. For tauri, use `RUSTDOCS_TAURI_PACKAGE_SPEC`, defaulting to the version found in `Cargo.lock`.
- Kill all clients on `session_shutdown`.

The intended shape is:

```ts
const pytauriClient = createClient(env("RUSTDOCS_PYTAURI_PACKAGE_SPEC", "pytauri@0.8.0"));
const tauriClient = createClient(env("RUSTDOCS_TAURI_PACKAGE_SPEC", "tauri@2.11.5"));

registerDocsTool(pi, "query_pytauri_docs", "Query pytauri docs", pytauriClient);
registerDocsTool(pi, "query_tauri_docs", "Query tauri docs", tauriClient);
```

Use the existing extension's JSON-RPC implementation rather than adding an MCP client dependency.

## Codex Configuration

Add one top-level `mcp_servers` entry per crate in `~/.codex/config.toml`. Give each server a unique descriptive name and preserve its environment block.

```toml
[mcp_servers.rust-docs-tauri]
command = "/absolute/path/to/rustdocs_mcp_server"
args = ["tauri@2.11.5"]
cwd = "/absolute/path/to/rust-docs-mcp-server"

[mcp_servers.rust-docs-tauri.env]
CARGO_INCREMENTAL = "0"
RUSTC = "/absolute/path/to/rustc"
```

Use absolute paths in Codex configuration. Do not put multiple crates in `args`; register another server instead.

## Verify

After changing a Pi extension:

```bash
node --experimental-strip-types --check .pi/extensions/rust-docs-mcp.ts
git diff --check -- .pi/extensions/rust-docs-mcp.ts
```

After changing Codex configuration:

```bash
codex mcp list
codex mcp get <server-name>
codex doctor
```

Confirm that Codex reports the server as enabled and that `config.toml parse` succeeds. State that a new Pi or Codex session is needed for newly registered tools to appear.

## Report

State the crate and pinned version added, the local tool or Codex server name, changed file paths, and the verification result. Mention any initial documentation indexing cost only when it is relevant: the server may need network access and embedding-provider credentials the first time it sees a crate/version/feature combination.
