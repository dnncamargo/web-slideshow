import { describe, expect, it } from "vitest";

import {
  DEFAULT_IMAGE_FOCAL_POINT,
  getEffectiveImageFocalPoint,
  getImageFocalPointPresetIndex,
  IMAGE_FOCAL_POINT_PRESETS,
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
