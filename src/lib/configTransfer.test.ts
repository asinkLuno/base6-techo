import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportConfigFile, openConfigFile } from "./configTransfer";

const { openMock, saveMock, readTextFileMock, writeTextFileMock } = vi.hoisted(
  () => ({
    openMock: vi.fn(),
    saveMock: vi.fn(),
    readTextFileMock: vi.fn(),
    writeTextFileMock: vi.fn(),
  }),
);

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: openMock,
  save: saveMock,
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: readTextFileMock,
  writeTextFile: writeTextFileMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("exportConfigFile", () => {
  it("用户取消时静默返回 cancelled，不写盘", async () => {
    saveMock.mockResolvedValue(null);
    const out = await exportConfigFile("{}");
    expect(out).toEqual({ ok: false, cancelled: true });
    expect(writeTextFileMock).not.toHaveBeenCalled();
  });

  it("对话框带 JSON 过滤器与默认文件名", async () => {
    saveMock.mockResolvedValue(null);
    await exportConfigFile("{}");
    expect(saveMock).toHaveBeenCalledWith({
      defaultPath: expect.stringMatching(
        /^base6-techo-config-\d{8}-\d{4}\.json$/,
      ),
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
  });

  it("原样写入 dialog 返回的路径，不改写扩展名", async () => {
    // dialog 只把返回路径加入 fs scope，补 .json 会写到 scope 之外。
    saveMock.mockResolvedValue("/home/x/my-config");
    writeTextFileMock.mockResolvedValue(undefined);

    const out = await exportConfigFile("{}");

    expect(writeTextFileMock).toHaveBeenCalledWith("/home/x/my-config", "{}");
    expect(out).toEqual({ ok: true, target: "/home/x/my-config" });
  });

  it("Android SAF URI 原样写入", async () => {
    const uri =
      "content://com.android.externalstorage.documents/document/primary%3ADownload%2Fconfig.json";
    saveMock.mockResolvedValue(uri);
    writeTextFileMock.mockResolvedValue(undefined);
    expect(await exportConfigFile("{}")).toEqual({ ok: true, target: uri });
  });

  it("写盘失败向上抛出，交由调用方展示", async () => {
    saveMock.mockResolvedValue("/home/x/config.json");
    writeTextFileMock.mockRejectedValue(new Error("写入文件失败：disk full"));
    await expect(exportConfigFile("{}")).rejects.toThrow("disk full");
  });
});

describe("openConfigFile", () => {
  it("用户取消时静默返回 cancelled，不读文件", async () => {
    openMock.mockResolvedValue(null);
    const out = await openConfigFile();
    expect(out).toEqual({ ok: false, cancelled: true });
    expect(readTextFileMock).not.toHaveBeenCalled();
  });

  it("返回选中路径与文件内容", async () => {
    openMock.mockResolvedValue("/home/x/config.json");
    readTextFileMock.mockResolvedValue('{"format":"x"}');

    const out = await openConfigFile();

    expect(openMock).toHaveBeenCalledWith({
      multiple: false,
      directory: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    expect(readTextFileMock).toHaveBeenCalledWith("/home/x/config.json");
    expect(out).toEqual({
      ok: true,
      target: "/home/x/config.json",
      contents: '{"format":"x"}',
    });
  });

  it("读取失败向上抛出，交由调用方展示", async () => {
    openMock.mockResolvedValue("/home/x/config.json");
    readTextFileMock.mockRejectedValue(new Error("没有读取权限"));
    await expect(openConfigFile()).rejects.toThrow("没有读取权限");
  });
});
