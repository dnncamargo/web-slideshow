import { describe, expect, it } from "vitest";

import {
  moveCrop,
  normalizeCropCanvasValue,
  resolveCropCanvasRect,
  resolveSourcePreviewBounds,
  updateCropFromHandle,
} from "../src/features/editor/crop-canvas-geometry";

const square = { left: 0, top: 0, width: 400, height: 400 };
const crop = { x: 20, y: 25, width: 50, height: 40 } as const;

describe("crop canvas source preview", () => {
  it("contains landscape, portrait, and matching sources", () => {
    expect(resolveSourcePreviewBounds(square, 1600, 800)).toEqual({ left: 0, top: 100, width: 400, height: 200 });
    expect(resolveSourcePreviewBounds(square, 800, 1600)).toEqual({ left: 100, top: 0, width: 200, height: 400 });
    expect(resolveSourcePreviewBounds(square, 400, 400)).toEqual(square);
  });

  it("respects a non-zero box origin and finite dimensions", () => {
    const result = resolveSourcePreviewBounds({ left: 20, top: 30, width: 300, height: 200 }, 600, 300);
    expect(result).toEqual({ left: 20, top: 55, width: 300, height: 150 });
    expect(result?.width).not.toBeNaN();
    expect(result?.height).not.toBe(Infinity);
  });
});

describe("crop canvas rectangle and handles", () => {
  const preview = { left: 100, top: 50, width: 400, height: 200 };

  it("maps full and partial crops over the preview", () => {
    expect(resolveCropCanvasRect(preview, { x: 0, y: 0, width: 100, height: 100 })).toEqual(preview);
    expect(resolveCropCanvasRect(preview, crop)).toEqual({ left: 180, top: 100, width: 200, height: 80 });
  });

  it("handles west/east/north/south and corners", () => {
    expect(updateCropFromHandle(crop, "w", 40, 0, preview)).toMatchObject({ x: 30, width: 40 });
    expect(updateCropFromHandle(crop, "e", 40, 0, preview)).toMatchObject({ width: 60 });
    expect(updateCropFromHandle(crop, "n", 0, 20, preview)).toMatchObject({ y: 35, height: 30 });
    expect(updateCropFromHandle(crop, "s", 0, 20, preview)).toMatchObject({ height: 50 });
    expect(updateCropFromHandle(crop, "se", 40, 20, preview)).toMatchObject({ width: 60, height: 50 });
    expect(updateCropFromHandle(crop, "ne", 40, -20, preview)).toMatchObject({ width: 60, y: 15, height: 50 });
    expect(updateCropFromHandle(crop, "sw", -40, 20, preview)).toMatchObject({ x: 10, width: 60, height: 50 });
    expect(updateCropFromHandle(crop, "nw", -40, -20, preview)).toMatchObject({ x: 10, y: 15, width: 60, height: 50 });
  });

  it("enforces one percent minimums, bounds, and tenth precision", () => {
    expect(updateCropFromHandle(crop, "nw", -1000, -1000, preview)).toEqual({ x: 0, y: 0, width: 70, height: 65 });
    expect(updateCropFromHandle(crop, "se", -1000, -1000, preview).width).toBe(1);
    expect(updateCropFromHandle(crop, "se", 13.6, 0, preview).width).toBe(53.4);
  });
});

describe("crop canvas move and normalization", () => {
  const preview = { left: 0, top: 0, width: 1000, height: 1000 };

  it("preserves size and clamps all movement edges", () => {
    expect(moveCrop(crop, 100, 100, preview)).toEqual({ x: 30, y: 35, width: 50, height: 40 });
    expect(moveCrop(crop, -1000, -1000, preview)).toMatchObject({ x: 0, y: 0, width: 50, height: 40 });
    expect(moveCrop(crop, 1000, 1000, preview)).toMatchObject({ x: 50, y: 60, width: 50, height: 40 });
  });

  it("collapses exact full frame to undefined", () => {
    expect(normalizeCropCanvasValue({ x: 0, y: 0, width: 100, height: 100 })).toBeUndefined();
  });

  it("protects invalid preview dimensions and compares full-frame canonically", () => {
    expect(moveCrop(crop, 10, 10, { left: 0, top: 0, width: 0, height: 100 })).toEqual(crop);
    expect(normalizeCropCanvasValue({ x: 0, y: 0, width: 100, height: 100 })).toBeUndefined();
  });
});
