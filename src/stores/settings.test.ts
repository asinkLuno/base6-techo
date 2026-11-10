import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_THEME,
  isLanguage,
  isThemeName,
  mergeSettingsData,
  normalizeSettingsData,
  useSettingsStore,
} from "./settings";

// persist 中间件在 store 创建时就读 localStorage，vitest node 环境没有，先挂内存实现。
vi.hoisted(() => {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key),
    },
  });
});

describe("偏好边界校验", () => {
  it("语言与主题只接受白名单内的值", () => {
    expect(isLanguage("zh-CN")).toBe(true);
    expect(isLanguage("en")).toBe(true);
    expect(isLanguage("fr")).toBe(false);
    expect(isLanguage(undefined)).toBe(false);

    expect(isThemeName("light")).toBe(true);
    expect(isThemeName("dark")).toBe(true);
    expect(isThemeName("cupcake")).toBe(false);
  });

  it("合法偏好原样保留", () => {
    expect(
      normalizeSettingsData({
        language: "en",
        theme: "dark",
        pdfViewMode: "double",
      }),
    ).toEqual({ language: "en", theme: "dark", pdfViewMode: "double" });
  });

  it("非法或缺失字段逐项回落默认，不整体丢弃", () => {
    expect(
      normalizeSettingsData({
        language: "en",
        theme: "neon",
        pdfViewMode: "booklet",
      }),
    ).toEqual({
      language: "en",
      theme: DEFAULT_THEME,
      pdfViewMode: "continuous",
    });
    expect(normalizeSettingsData(null)).toEqual({
      language: DEFAULT_LANGUAGE,
      theme: DEFAULT_THEME,
      pdfViewMode: "continuous",
    });
  });

  it("水合合并保留 action，并用校验后的数据覆盖偏好", () => {
    const current = useSettingsStore.getState();
    const merged = mergeSettingsData(
      { language: "en", theme: "neon", pdfViewMode: "bogus" },
      current,
    );
    expect(merged).toMatchObject({
      language: "en",
      theme: DEFAULT_THEME,
      pdfViewMode: "continuous",
    });
    expect(typeof merged.setLanguage).toBe("function");
  });
});
