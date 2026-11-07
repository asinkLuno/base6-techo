import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Imposition, PageSettings, SectionSpec } from "../types/document";

/** 发给 Rust 的整本文档，形状对齐 serde Document（均为 camelCase）。 */
export interface DocumentPayload {
  page: PageSettings;
  imposition: Imposition;
  sections: SectionSpec[];
}

export interface CompileOutput {
  /** Tectonic 编译日志（成功时也可能带警告） */
  log: string;
  /** 生成的 LaTeX 源码 */
  tex: string;
  pdf: ArrayBuffer;
}

/**
 * 解析 IPC 二进制响应：
 * `[u32 log_len LE][log utf8][u32 tex_len LE][tex utf8][pdf bytes]`
 * （与 src-tauri/src/lib.rs 的 generate_pdf 约定一致）。
 */
export function parseCompileResponse(buffer: ArrayBuffer): CompileOutput {
  if (buffer.byteLength < 8) {
    throw new Error("生成响应格式非法：缺少长度头部");
  }
  const view = new DataView(buffer);
  const logLen = view.getUint32(0, true);
  const texOffset = 4 + logLen;
  if (texOffset + 4 > buffer.byteLength) {
    throw new Error("生成响应格式非法：log 长度越界");
  }
  const texLen = view.getUint32(texOffset, true);
  const pdfOffset = texOffset + 4 + texLen;
  if (pdfOffset > buffer.byteLength) {
    throw new Error("生成响应格式非法：tex 长度越界");
  }
  const decoder = new TextDecoder();
  return {
    log: decoder.decode(new Uint8Array(buffer, 4, logLen)),
    tex: decoder.decode(new Uint8Array(buffer, texOffset + 4, texLen)),
    pdf: buffer.slice(pdfOffset),
  };
}

/** 调用 Rust 侧 Tectonic 编译整本文档，返回编译输出。非 Tauri 环境直接抛错。 */
export async function generatePdf(payload: DocumentPayload): Promise<CompileOutput> {
  if (!isTauri()) {
    throw new Error("not-tauri");
  }
  const response = await invoke<ArrayBuffer>("generate_document_pdf", { document: payload });
  return parseCompileResponse(response);
}
