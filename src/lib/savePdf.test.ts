import { beforeEach, describe, expect, it, vi } from "vitest";
import { describeTarget, savePdfFile, suggestPdfName } from "./savePdf";

const { saveMock, writeFileMock, invokeMock } = vi.hoisted(() => ({
  saveMock: vi.fn(),
  writeFileMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: saveMock }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeFile: writeFileMock }));
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
  it("用户取消时静默返回 cancelled，不写盘", async () => {
    saveMock.mockResolvedValue(null);
    const out = await savePdfFile(new ArrayBuffer(0));
    expect(out).toEqual({ ok: false, cancelled: true });
    expect(writeFileMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("保存对话框带 PDF 过滤器与默认文件名", async () => {
    saveMock.mockResolvedValue(null);
    await savePdfFile(new ArrayBuffer(0));
    expect(saveMock).toHaveBeenCalledWith({
      defaultPath: expect.stringMatching(/^base6-techo-\d{8}-\d{4}\.pdf$/),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
  });

  it("content:// 目标走 fs 插件 writeFile", async () => {
    const uri =
      "content://com.android.externalstorage.documents/document/primary%3ADownload%2Fx.pdf";
    saveMock.mockResolvedValue(uri);
    writeFileMock.mockResolvedValue(undefined);

    const out = await savePdfFile(PDF.buffer as ArrayBuffer);

    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(writeFileMock.mock.calls[0][0]).toBe(uri);
    expect(
      new Uint8Array(writeFileMock.mock.calls[0][1] as ArrayBuffer),
    ).toEqual(PDF);
    expect(invokeMock).not.toHaveBeenCalled();
    expect(out).toEqual({ ok: true, target: uri });
  });

  it("桌面路径走 write_pdf_file 原始字节 + 编码 path header", async () => {
    saveMock.mockResolvedValue("/home/x/notes.pdf");
    invokeMock.mockResolvedValue(null);

    const out = await savePdfFile(PDF.buffer as ArrayBuffer);

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock.mock.calls[0][0]).toBe("write_pdf_file");
    expect(new Uint8Array(invokeMock.mock.calls[0][1] as ArrayBuffer)).toEqual(
      PDF,
    );
    expect(invokeMock.mock.calls[0][2]).toEqual({
      headers: { path: encodeURIComponent("/home/x/notes.pdf") },
    });
    expect(writeFileMock).not.toHaveBeenCalled();
    expect(out).toEqual({ ok: true, target: "/home/x/notes.pdf" });
  });

  it("桌面路径缺 .pdf 扩展名时补全", async () => {
    saveMock.mockResolvedValue("/home/x/notes");
    invokeMock.mockResolvedValue(null);

    const out = await savePdfFile(new ArrayBuffer(0));

    expect(invokeMock.mock.calls[0][2]).toEqual({
      headers: { path: encodeURIComponent("/home/x/notes.pdf") },
    });
    expect(out).toEqual({ ok: true, target: "/home/x/notes.pdf" });
  });

  it("写盘失败向上抛出，交由调用方展示", async () => {
    saveMock.mockResolvedValue("/home/x/notes.pdf");
    invokeMock.mockRejectedValue(new Error("写入文件失败：disk full"));
    await expect(savePdfFile(new ArrayBuffer(0))).rejects.toThrow("disk full");
  });
});
