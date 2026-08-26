import { spawn, execSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

type RpcResponse = { id?: number; result?: any; error?: { message?: string } };

type Pending = { resolve: (value: any) => void; reject: (error: Error) => void };
type DocsClient = { start: () => Promise<void>; request: (method: string, params: unknown) => Promise<any>; stop: () => void };

export default function (pi: ExtensionAPI) {
  const pytauriClient = createClient(env("RUSTDOCS_PYTAURI_PACKAGE_SPEC", "pytauri@0.8.0"));
  const tauriClient = createClient(env("RUSTDOCS_TAURI_PACKAGE_SPEC", "tauri@2.11.5"));

  registerDocsTool(pi, "query_pytauri_docs", "Query pytauri docs", pytauriClient);
  registerDocsTool(pi, "query_tauri_docs", "Query tauri docs", tauriClient);

  pi.on("session_shutdown", async () => {
    pytauriClient.stop();
    tauriClient.stop();
  });
}

function createClient(packageSpec: string): DocsClient {
  let child: ChildProcessWithoutNullStreams | undefined;
  let nextId = 1;
  let buffer = "";
  const pending = new Map<number, Pending>();

  const request = (method: string, params: unknown): Promise<any> => {
    if (!child?.stdin.writable) return Promise.reject(new Error("rust-docs MCP process is not running"));
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  };

  const start = async () => {
    if (child) return;
    child = spawn(env("RUSTDOCS_MCP_SERVER", "target/release/rustdocs_mcp_server"), [packageSpec], {
      cwd: env("RUSTDOCS_CWD", "../rust-docs-mcp-server"),
      env: {
        ...globalThis.process.env,
        // cargo-lib in the server resolves the wrong rustc without this pin
        RUSTC: env("RUSTC", execSync("rustup which rustc").toString().trim()),
        CARGO_INCREMENTAL: env("CARGO_INCREMENTAL", "0"),
      },
      stdio: ["pipe", "pipe", "inherit"],
    });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        try {
          const message = JSON.parse(line) as RpcResponse;
          if (message.id === undefined) continue;
          const waiter = pending.get(message.id);
          if (!waiter) continue;
          pending.delete(message.id);
          message.error ? waiter.reject(new Error(message.error.message ?? "MCP request failed")) : waiter.resolve(message.result);
        } catch (error) {
          for (const waiter of pending.values()) waiter.reject(error as Error);
          pending.clear();
        }
      }
    });
    child.on("exit", () => {
      for (const waiter of pending.values()) waiter.reject(new Error("rust-docs MCP process exited"));
      pending.clear();
      child = undefined;
      buffer = "";
    });

    await request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "pi-rust-docs", version: "1.0.0" },
    });
    child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
  };

  return { start, request, stop: () => child?.kill() };
}

function registerDocsTool(pi: ExtensionAPI, name: string, label: string, client: DocsClient) {
  pi.registerTool({
    name,
    label,
    description: "Query crate documentation through the rust-docs MCP server.",
    parameters: Type.Object({ question: Type.String() }),
    async execute(_toolCallId, params) {
      try {
        await client.start();
        const result = await client.request("tools/call", { name: "query_rust_docs", arguments: params });
        return { content: result?.content ?? [{ type: "text", text: JSON.stringify(result) }], details: {} };
      } catch (error) {
        return { content: [{ type: "text", text: String(error) }], isError: true, details: {} };
      }
    },
  });
}

function env(name: string, fallback: string) {
  return globalThis.process.env[name] || fallback;
}
