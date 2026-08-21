import { describe, expect, it } from "vitest";

import {
  DEFAULT_IMAGE_PROPORTION_PRESERVED,
  getCanvasResizeDeltas,
  getCanvasResizePlacementAdjustment,
  isCanvasResizable,
  resolveProportionalResize,
  toLogicalCanvasResizeDelta,
  updateStyleForCanvasResize,
  updateStyleForProportionalResize,
} from "../src/features/editor/canvas-resize-helpers";

describe("canvas resize helpers", () => {
  it("defaults image proportion preservation to on", () => {
    expect(DEFAULT_IMAGE_PROPORTION_PRESERVED).toBe(true);
  });

  it("does not author dimensions when there is no movement", () => {
    expect(updateStyleForProportionalResize({ width: 200, height: 100 }, "se", 0, 0, 200, 100, 400, 200)).toEqual({ width: 200, height: 100 });
  });

  it("limits direct resize to existing size-capable visual elements", () => {
    expect(isCanvasResizable({ type: "image", id: "image", hidden: false, src: "/image.png", alt: "", fit: "contain" })).toBe(true);
    expect(isCanvasResizable({ type: "text", id: "text", hidden: false, content: "Text", variant: "body" })).toBe(false);
  });

  it("treats a Gallery as canvas-resizable", () => {
    expect(
      isCanvasResizable({
        type: "gallery",
        id: "gallery",
        hidden: false,
        fit: "contain",
        items: [],
      }),
    ).toBe(true);
  });

  it("maps edge and corner directions to semantic size deltas", () => {
    expect(getCanvasResizeDeltas("e", 20, 10)).toMatchObject({ width: 20, height: 0 });
    expect(getCanvasResizeDeltas("s", 20, -10)).toMatchObject({ width: 0, height: -10 });
    expect(getCanvasResizeDeltas("nw", 20, 10)).toMatchObject({ width: -20, height: -10, offsetX: 20, offsetY: 10 });
  });

  it("preserves pixel dimensions and unrelated style", () => {
    expect(updateStyleForCanvasResize({ color: "#ffffff", width: 100, height: 50 }, "se", 20, -10, 100, 50, 400, 200)).toEqual({ color: "#ffffff", width: 120, height: 40 });
  });

  it("preserves percentages using the direct parent dimensions", () => {
    expect(updateStyleForCanvasResize({ width: "50%", height: "25%" }, "se", 40, 20, 200, 50, 400, 200)).toEqual({ width: "60%", height: "35%" });
  });

  it("converts client deltas through the Canvas preview scale", () => {
    expect(toLogicalCanvasResizeDelta(30, 0.5)).toBe(60);
    expect(toLogicalCanvasResizeDelta(-20, 2)).toBe(-10);
  });

  it("adjusts only semantic absolute offsets needed to retain opposite edges", () => {
    expect(getCanvasResizePlacementAdjustment("w", 20, 0, "center")).toEqual({ x: 10, y: 0 });
    expect(getCanvasResizePlacementAdjustment("nw", 20, 10, "top-left")).toEqual({ x: 20, y: 10 });
    expect(getCanvasResizePlacementAdjustment("se", 20, 10, "bottom-right")).toEqual({ x: 0, y: 0 });
  });

  it("authors missing dimensions in pixels only after movement and clamps to a valid minimum", () => {
    const style = { color: "#ffffff" };
    expect(updateStyleForCanvasResize(style, "e", 0, 0, 120, 40, 400, 200)).toBe(style);
    expect(updateStyleForCanvasResize(style, "w", 200, 0, 120, 40, 400, 200)).toEqual({ color: "#ffffff", width: 1 });
  });

  it("resolves corner proportions and preserves px units", () => {
    const se = resolveProportionalResize("se", 100, 25, 200, 100);
    expect(se.width / se.height).toBeCloseTo(2, 5);
    expect(updateStyleForProportionalResize({ width: 200, height: 100 }, "se", 100, 25, 200, 100, 400, 200)).toMatchObject({ width: 300, height: 150 });
  });

  it("keeps ratio on NW/NE/SW like opposite-corner resizes", () => {
    for (const direction of ["nw", "ne", "sw"] as const) {
      const result = resolveProportionalResize(direction, -200, 50, 200, 100);
      expect(result.width / result.height).toBeCloseTo(2, 5);
      expect(result.width).toBeGreaterThanOrEqual(1);
      expect(result.height).toBeGreaterThanOrEqual(1);
    }
  });

  it("clamps to minimum while keeping proportion", () => {
    const tiny = resolveProportionalResize("se", -5000, -10, 200, 100);
    expect(tiny.width).toBeGreaterThanOrEqual(1);
    expect(tiny.height).toBeGreaterThanOrEqual(1);
    expect(tiny.width / tiny.height).toBeCloseTo(2, 3);
  });
});
