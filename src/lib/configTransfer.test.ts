import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportConfigFile, openConfigFile } from "./configTransfer";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("exportConfigFile", () => {
  it("用户取消时静默返回 cancelled", async () => {
    invokeMock.mockResolvedValue(null);

    const out = await exportConfigFile("{}");

    expect(out).toEqual({ ok: false, cancelled: true });
  });

  it("把配置文本和建议文件名交给后端，返回选定的目标", async () => {
    invokeMock.mockResolvedValue("/home/x/config.json");

    const out = await exportConfigFile("{}");

    expect(invokeMock).toHaveBeenCalledTimes(1);
    const [command, args] = invokeMock.mock.calls[0];
    expect(command).toBe("save_config_file");
    expect(args).toEqual({
      contents: "{}",
      name: expect.stringMatching(/^base6-techo-config-\d{8}-\d{4}\.json$/),
    });
    expect(out).toEqual({ ok: true, target: "/home/x/config.json" });
  });

  it("Android SAF URI 原样作为目标返回", async () => {
    const uri =
      "content://com.android.externalstorage.documents/document/primary%3ADownload%2Fconfig.json";
    invokeMock.mockResolvedValue(uri);

    await expect(exportConfigFile("{}")).resolves.toEqual({
      ok: true,
      target: uri,
    });
  });

  it("写盘失败向上抛出，交由调用方展示", async () => {
    invokeMock.mockRejectedValue(new Error("写入文件失败：disk full"));
    await expect(exportConfigFile("{}")).rejects.toThrow("disk full");
  });
});

describe("openConfigFile", () => {
  it("用户取消时静默返回 cancelled", async () => {
    invokeMock.mockResolvedValue(null);

    const out = await openConfigFile();

    expect(out).toEqual({ ok: false, cancelled: true });
  });

  it("返回后端读到的目标与内容", async () => {
    invokeMock.mockResolvedValue({
      target: "/home/x/config.json",
      contents: '{"format":"x"}',
    });

    const out = await openConfigFile();

    expect(invokeMock).toHaveBeenCalledWith("open_config_file");
    expect(out).toEqual({
      ok: true,
      target: "/home/x/config.json",
      contents: '{"format":"x"}',
    });
  });

  it("读取失败向上抛出，交由调用方展示", async () => {
    invokeMock.mockRejectedValue(new Error("配置文件不是有效的 UTF-8 文本"));
    await expect(openConfigFile()).rejects.toThrow("UTF-8");
  });
});
