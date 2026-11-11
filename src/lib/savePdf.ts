/**
 * 「另存为」保存 PDF：对话框和写盘都在 Rust 侧（`save_pdf_file`）完成，
 * 目标路径不经过 webview；桌面写普通路径，Android 由 fs 插件写 SAF URI。
 */
import { invoke } from "@tauri-apps/api/core";

export type SavePdfResult =
  | { ok: true; target: string }
  | { ok: false; cancelled: true };

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

/** 由后端弹出另存为对话框并写盘；用户取消时静默返回 cancelled。 */
export async function savePdfFile(pdf: ArrayBuffer): Promise<SavePdfResult> {
  // 建议文件名走 header：非 ASCII 不适合放 header 原文，先 percent-encode
  const target = await invoke<string | null>(
    "save_pdf_file",
    new Uint8Array(pdf),
    {
      headers: { name: encodeURIComponent(suggestPdfName()) },
    },
  );
  if (!target) return { ok: false, cancelled: true };
  return { ok: true, target };
}
