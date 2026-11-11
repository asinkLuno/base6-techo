/**
 * 配置文件的系统读写：对话框与文件 I/O 都在 Rust 侧
 * （`save_config_file` / `open_config_file`），webview 不选路径也不碰文件。
 */
import { invoke } from "@tauri-apps/api/core";
import { suggestConfigName } from "./configFile";

export type ConfigExportResult =
  | { ok: true; target: string }
  | { ok: false; cancelled: true };

export type ConfigOpenResult =
  | { ok: true; target: string; contents: string }
  | { ok: false; cancelled: true };

/** 由后端弹出另存为对话框并写入配置文本；用户取消时静默返回 cancelled。 */
export async function exportConfigFile(
  contents: string,
): Promise<ConfigExportResult> {
  const target = await invoke<string | null>("save_config_file", {
    contents,
    name: suggestConfigName(),
  });
  if (!target) return { ok: false, cancelled: true };
  return { ok: true, target };
}

/** 由后端弹出打开对话框并读回配置文本；用户取消时静默返回 cancelled。 */
export async function openConfigFile(): Promise<ConfigOpenResult> {
  const opened = await invoke<{ target: string; contents: string } | null>(
    "open_config_file",
  );
  if (!opened) return { ok: false, cancelled: true };
  return { ok: true, target: opened.target, contents: opened.contents };
}
