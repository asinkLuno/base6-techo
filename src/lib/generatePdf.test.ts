import { describe, expect, it } from "vitest";
import { parseCompileResponse } from "./generatePdf";

/** 按约定手工拼一份响应：[u32 log_len LE][log][u32 tex_len LE][tex][pdf bytes]。 */
function buildResponse(log: string, tex: string, pdf: Uint8Array): ArrayBuffer {
  const logBytes = new TextEncoder().encode(log);
  const texBytes = new TextEncoder().encode(tex);
  const out = new Uint8Array(
    8 + logBytes.length + texBytes.length + pdf.length,
  );
  const view = new DataView(out.buffer);
  view.setUint32(0, logBytes.length, true);
  out.set(logBytes, 4);
  view.setUint32(4 + logBytes.length, texBytes.length, true);
  out.set(texBytes, 8 + logBytes.length);
  out.set(pdf, 8 + logBytes.length + texBytes.length);
  return out.buffer;
}

describe("parseCompileResponse", () => {
  it("按 [log_len][log][tex_len][tex][pdf] 切分三段", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
    const buffer = buildResponse(
      "compile log",
      "\\documentclass{article}",
      pdf,
    );
    const out = parseCompileResponse(buffer);
    expect(out.log).toBe("compile log");
    expect(out.tex).toBe("\\documentclass{article}");
    expect(new Uint8Array(out.pdf)).toEqual(pdf);
  });

  it("log/tex 为空串、pdf 为空时照常解析", () => {
    const buffer = buildResponse("", "", new Uint8Array());
    const out = parseCompileResponse(buffer);
    expect(out.log).toBe("");
    expect(out.tex).toBe("");
    expect(out.pdf.byteLength).toBe(0);
  });

  it("长度不足 8 字节头部时抛错", () => {
    expect(() => parseCompileResponse(new ArrayBuffer(4))).toThrow();
  });

  it("声明的 log 长度超出实际数据时抛错而不是读出乱码", () => {
    const buffer = buildResponse("short", "t", new Uint8Array([1]));
    const view = new DataView(buffer);
    view.setUint32(0, 1_000, true); // 伪造超长 log_len
    expect(() => parseCompileResponse(buffer)).toThrow();
  });
});
