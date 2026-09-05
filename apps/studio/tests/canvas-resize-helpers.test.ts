import { describe, expect, it } from "vitest";

import {
  DEFAULT_IMAGE_PROPORTION_PRESERVED,
  getCanvasResizeDeltas,
  getCanvasResizeCursor,
  isCanvasResizable,
  resolveProportionalResize,
  toLogicalCanvasResizeDelta,
} from "../src/features/editor/canvas-resize-helpers";

describe("canonical canvas resize helpers", () => {
  it("keeps image proportion preservation enabled by default", () => {
    expect(DEFAULT_IMAGE_PROPORTION_PRESERVED).toBe(true);
  });

  it("maps directions to canonical geometry deltas", () => {
    expect(getCanvasResizeDeltas("e", 20, 10)).toEqual({ width: 20, height: 0, offsetX: 0, offsetY: 0 });
    expect(getCanvasResizeDeltas("nw", 20, 10)).toEqual({ width: -20, height: -10, offsetX: 20, offsetY: 10 });
  });

  it("keeps unsupported semantic elements non-resizable", () => {
    expect(isCanvasResizable({ type: "chart", id: "chart", hidden: false, source: "" })).toBe(false);
    expect(isCanvasResizable({ type: "interactive", id: "interactive", hidden: false, widget: "function-plot", config: {} })).toBe(false);
  });

  it("preserves proportional geometry", () => {
    const result = resolveProportionalResize("se", 100, 25, 200, 100);
    expect(result.width / result.height).toBeCloseTo(2, 5);
  });

  it("converts client deltas and exposes canonical cursors", () => {
    expect(toLogicalCanvasResizeDelta(30, 0.5)).toBe(60);
    expect(getCanvasResizeCursor("nw")).toBe("nwse-resize");
  });
});
