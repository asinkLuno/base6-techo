/**
 * 「另存为」保存 PDF：dialog 插件选位置，fs 插件或自定义命令写盘。
 * - 桌面：save() 返回文件路径 → write_pdf_file 命令收原始字节落盘（不放宽 fs scope）。
 * - Android：save() 走 SAF ACTION_CREATE_DOCUMENT 返回 content:// URI →
 *   writeFile(uri) 由 fs 插件经 ContentResolver 写入（移动端对 URI 不做 scope 校验）。
 */
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

export type SavePdfResult =
  | { ok: true; target: string }
  | { ok: false; cancelled: true };

const PDF_EXT = /\.pdf$/i;

/** 默认文件名：base6-techo-YYYYMMDD-HHmm.pdf（Document 无标题字段，用时间戳区分）。 */
export function suggestPdfName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const hm = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `base6-techo-${ymd}-${hm}.pdf`;
}

/** toast 展示名：桌面显示完整路径；Android SAF URI 解码后取文件名段展示。 */
export function describeTarget(target: string): string {
  if (!target.startsWith("content://")) return target;
  const tail = target.split("/").pop() ?? target;
  let decoded = tail;
  try {
    decoded = decodeURIComponent(tail);
  } catch {
    // 畸形编码就原样展示
  }
  // document id 形如 primary:Documents/xxx.pdf，冒号后才是对用户有意义的路径
  const id = decoded.includes(":")
    ? (decoded.split(":").pop() ?? decoded)
    : decoded;
  return id || target;
}

/** 弹出另存为对话框并把 PDF 字节写到选定位置；用户取消时静默返回 cancelled。 */
export async function savePdfFile(pdf: ArrayBuffer): Promise<SavePdfResult> {
  const target = await save({
    defaultPath: suggestPdfName(),
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!target) return { ok: false, cancelled: true };
  const bytes = new Uint8Array(pdf);
  if (target.startsWith("content://")) {
    await writeFile(target, bytes);
    return { ok: true, target };
  }
  // Linux 对话框不强制补扩展名，缺了就补上再落盘
  const path = PDF_EXT.test(target) ? target : `${target}.pdf`;
  await invoke("write_pdf_file", bytes, {
    headers: { path: encodeURIComponent(path) },
  });
  return { ok: true, target: path };
}
