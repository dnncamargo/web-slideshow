import { describe, expect, it } from "vitest";

import {
  DEFAULT_IMAGE_FOCAL_POINT,
  getEffectiveImageFocalPoint,
  getImageFocalPointFromClientPosition,
  getImageFocalPointPresetIndex,
  getImageFocalPointUntilFit,
  IMAGE_FOCAL_POINT_PRESETS,
  isImageFocalPointResetAvailable,
  updateImageFocalPoint,
} from "../src/features/editor/inspector/sections/image-focal-point-helpers";

describe("image focal point helpers", () => {
  it("uses effective center without persisting an undefined focal point", () => {
    expect(getEffectiveImageFocalPoint(undefined)).toEqual(
      DEFAULT_IMAGE_FOCAL_POINT,
    );
  });

  it("maps all nine presets and detects active presets", () => {
    expect(IMAGE_FOCAL_POINT_PRESETS).toHaveLength(9);
    expect(getImageFocalPointPresetIndex({ x: 0, y: 0 })).toBe(0);
    expect(getImageFocalPointPresetIndex({ x: 50, y: 50 })).toBe(4);
    expect(getImageFocalPointPresetIndex({ x: 100, y: 100 })).toBe(8);
  });

  it("does not report a custom focal point as a preset", () => {
    expect(getImageFocalPointPresetIndex({ x: 37, y: 62 })).toBeNull();
  });

  it("persists custom values in range from an effective center", () => {
    expect(updateImageFocalPoint(undefined, "x", 60)).toEqual({ x: 60, y: 50 });
    expect(updateImageFocalPoint({ x: 60, y: 50 }, "y", 70)).toEqual({ x: 60, y: 70 });
  });

  it("clamps numeric values to valid focal point bounds", () => {
    expect(updateImageFocalPoint(undefined, "x", -10)).toEqual({ x: 0, y: 50 });
    expect(updateImageFocalPoint(undefined, "y", 120)).toEqual({ x: 50, y: 100 });
  });
});

describe("focal point canvas geometry", () => {
  const bounds = { left: 100, top: 40, width: 400, height: 200 };

  it("maps corners and center from client coordinates", () => {
    expect(getImageFocalPointFromClientPosition(bounds, 100, 40)).toEqual({ x: 0, y: 0 });
    expect(getImageFocalPointFromClientPosition(bounds, 300, 140)).toEqual({ x: 50, y: 50 });
    expect(getImageFocalPointFromClientPosition(bounds, 500, 240)).toEqual({ x: 100, y: 100 });
  });

  it("maps arbitrary pointer positions to percentages", () => {
    expect(getImageFocalPointFromClientPosition(bounds, 200, 100)).toEqual({ x: 25, y: 30 });
    expect(getImageFocalPointFromClientPosition(bounds, 460, 220)).toEqual({ x: 90, y: 90 });
  });

  it("clamps coordinates outside bounds to 0 and 100", () => {
    expect(getImageFocalPointFromClientPosition(bounds, 20, 10)).toEqual({ x: 0, y: 0 });
    expect(getImageFocalPointFromClientPosition(bounds, 900, 600)).toEqual({ x: 100, y: 100 });
  });

  it("works with scaled Canvas bounds in the same client coordinate space", () => {
    const scaled = { left: 200, top: 80, width: 800, height: 400 };
    expect(getImageFocalPointFromClientPosition(scaled, 600, 280)).toEqual({ x: 50, y: 50 });
    expect(getImageFocalPointFromClientPosition(scaled, 200, 80)).toEqual({ x: 0, y: 0 });
  });
});

describe("focal point reset and fit preservation", () => {
  it("enables reset only when a focal override exists", () => {
    expect(isImageFocalPointResetAvailable(undefined)).toBe(false);
    expect(isImageFocalPointResetAvailable({ x: 25, y: 70 })).toBe(true);
  });

  it("preserves focalPoint across fit changes", () => {
    const authored = { x: 25, y: 70 };
    expect(getImageFocalPointUntilFit(authored)).toEqual({ x: 25, y: 70 });
    expect(getImageFocalPointUntilFit(undefined)).toBeUndefined();
  });
});
