import { beforeEach, describe, expect, it, vi } from "vitest";
import { describeTarget, savePdfFile, suggestPdfName } from "./savePdf";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

beforeEach(() => {
  vi.clearAllMocks();
});

describe("suggestPdfName", () => {
  it("按 base6-techo-YYYYMMDD-HHmm.pdf 生成，补零", () => {
    // 2026-11-07 09:05
    expect(suggestPdfName(new Date(2026, 10, 7, 9, 5))).toBe(
      "base6-techo-20261107-0905.pdf",
    );
  });
});

describe("describeTarget", () => {
  it("桌面路径原样展示", () => {
    expect(describeTarget("/home/x/notes.pdf")).toBe("/home/x/notes.pdf");
  });

  it("Android SAF URI 解码 document id，取冒号后路径", () => {
    expect(
      describeTarget(
        "content://com.android.externalstorage.documents/document/primary%3ADocuments%2Fbase6-techo.pdf",
      ),
    ).toBe("Documents/base6-techo.pdf");
  });

  it("无冒号的 URI 段原样返回", () => {
    expect(describeTarget("content://org.example/documents/file.pdf")).toBe(
      "file.pdf",
    );
  });

  it("畸形编码不抛错", () => {
    expect(describeTarget("content://org.example/doc/%E2%28")).toBe("%E2%28");
  });
});

describe("savePdfFile", () => {
  it("用户取消时静默返回 cancelled", async () => {
    invokeMock.mockResolvedValue(null);

    const out = await savePdfFile(new ArrayBuffer(0));

    expect(out).toEqual({ ok: false, cancelled: true });
  });

  it("把原始字节和编码后的建议文件名交给后端，返回选定的目标", async () => {
    invokeMock.mockResolvedValue("/home/x/notes.pdf");

    const out = await savePdfFile(PDF.buffer as ArrayBuffer);

    expect(invokeMock).toHaveBeenCalledTimes(1);
    const [command, body, options] = invokeMock.mock.calls[0];
    expect(command).toBe("save_pdf_file");
    expect(new Uint8Array(body as Uint8Array)).toEqual(PDF);
    const name = decodeURIComponent(
      (options as { headers: { name: string } }).headers.name,
    );
    expect(name).toMatch(/^base6-techo-\d{8}-\d{4}\.pdf$/);
    expect(out).toEqual({ ok: true, target: "/home/x/notes.pdf" });
  });

  it("Android SAF URI 原样作为目标返回", async () => {
    const uri =
      "content://com.android.externalstorage.documents/document/primary%3ADownload%2Fx.pdf";
    invokeMock.mockResolvedValue(uri);

    await expect(savePdfFile(PDF.buffer as ArrayBuffer)).resolves.toEqual({
      ok: true,
      target: uri,
    });
  });

  it("写盘失败向上抛出，交由调用方展示", async () => {
    invokeMock.mockRejectedValue(new Error("写入文件失败：disk full"));
    await expect(savePdfFile(new ArrayBuffer(0))).rejects.toThrow("disk full");
  });
});
