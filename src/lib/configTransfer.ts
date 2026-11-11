/**
 * 配置文件的系统读写：dialog 插件选文件，fs 插件读写文本。
 * dialog 会把用户选中的路径加入 fs scope，因此不需要在 capabilities 里放宽目录权限。
 * Android 的 SAF content:// URI 由 fs 插件经 ContentResolver 处理，与 savePdf 同理。
 */
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { suggestConfigName } from "./configFile";

const FILTERS = [{ name: "JSON", extensions: ["json"] }];

export type ConfigExportResult =
  | { ok: true; target: string }
  | { ok: false; cancelled: true };

export type ConfigOpenResult =
  | { ok: true; target: string; contents: string }
  | { ok: false; cancelled: true };

/** 弹出另存为对话框并写入配置文本；用户取消时静默返回 cancelled。 */
export async function exportConfigFile(
  contents: string,
): Promise<ConfigExportResult> {
  const target = await save({
    defaultPath: suggestConfigName(),
    filters: FILTERS,
  });
  if (!target) return { ok: false, cancelled: true };
  // 不改写路径：dialog 只把原样返回的路径加进 fs scope，补扩展名会写到 scope 之外。
  await writeTextFile(target, contents);
  return { ok: true, target };
}

/** 弹出打开对话框并读回配置文本；用户取消时静默返回 cancelled。 */
export async function openConfigFile(): Promise<ConfigOpenResult> {
  const target = await open({
    multiple: false,
    directory: false,
    filters: FILTERS,
  });
  if (!target) return { ok: false, cancelled: true };
  const contents = await readTextFile(target);
  return { ok: true, target, contents };
}
