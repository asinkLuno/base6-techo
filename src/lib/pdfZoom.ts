/**
 * 预览缩放步进：1 = 适应宽度，其余为相对适应宽度的倍率。
 * 纯逻辑抽出来便于单测；PdfViewer 只管渲染。
 */

export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

export const MIN_ZOOM = ZOOM_STEPS[0];
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];

export type ZoomDir = "in" | "out";

/** 取当前倍率相邻档位；已在边界时原样返回，未知值先吸附到最近档位。 */
export function nextZoom(current: number, dir: ZoomDir): number {
  let nearest = 0;
  for (let i = 1; i < ZOOM_STEPS.length; i++) {
    if (
      Math.abs(ZOOM_STEPS[i] - current) <
      Math.abs(ZOOM_STEPS[nearest] - current)
    ) {
      nearest = i;
    }
  }
  if (dir === "in") {
    return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, nearest + 1)];
  }
  return ZOOM_STEPS[Math.max(0, nearest - 1)];
}

/** 百分比展示：1 → "100%"，0.75 → "75%"。 */
export function zoomLabel(current: number): string {
  return `${Math.round(current * 100)}%`;
}
