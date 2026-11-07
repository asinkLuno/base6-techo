import { describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, nextZoom, ZOOM_STEPS, zoomLabel } from "./pdfZoom";

describe("nextZoom", () => {
  it("从适应宽度向内/向外各走一档", () => {
    expect(nextZoom(1, "in")).toBe(1.25);
    expect(nextZoom(1, "out")).toBe(0.75);
  });

  it("到边界后停住不再放大/缩小", () => {
    expect(nextZoom(MAX_ZOOM, "in")).toBe(MAX_ZOOM);
    expect(nextZoom(MIN_ZOOM, "out")).toBe(MIN_ZOOM);
  });

  it("未知值先吸附到最近档位再步进", () => {
    expect(nextZoom(0.8, "in")).toBe(1);
    expect(nextZoom(0.8, "out")).toBe(0.5);
  });

  it("档位表首尾即边界", () => {
    expect(MIN_ZOOM).toBe(ZOOM_STEPS[0]);
    expect(MAX_ZOOM).toBe(ZOOM_STEPS[ZOOM_STEPS.length - 1]);
  });
});

describe("zoomLabel", () => {
  it("整倍率与小数倍率都取整百分比", () => {
    expect(zoomLabel(1)).toBe("100%");
    expect(zoomLabel(0.75)).toBe("75%");
    expect(zoomLabel(1.25)).toBe("125%");
  });
});
