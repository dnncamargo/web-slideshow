import { describe, expect, it } from "vitest";

import {
  DEFAULT_IMAGE_CROP,
  getEffectiveImageCrop,
  isImageCropResetAvailable,
  normalizeImageCrop,
  updateImageCropField,
} from "../src/features/editor/inspector/sections/image-crop-helpers";

describe("image crop helpers", () => {
  it("uses an effective full frame without mutating an undefined crop", () => {
    const effective = getEffectiveImageCrop(undefined);

    expect(effective).toEqual(DEFAULT_IMAGE_CROP);
    expect(effective).not.toBe(DEFAULT_IMAGE_CROP);
  });

  it("updates each full-frame field without persisting unrelated defaults", () => {
    expect(updateImageCropField(undefined, "x", 10)).toEqual({
      x: 10,
      y: 0,
      width: 90,
      height: 100,
    });
    expect(updateImageCropField(undefined, "y", 20)).toEqual({
      x: 0,
      y: 20,
      width: 100,
      height: 80,
    });
    expect(updateImageCropField(undefined, "width", 80)).toEqual({
      x: 0,
      y: 0,
      width: 80,
      height: 100,
    });
    expect(updateImageCropField(undefined, "height", 70)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 70,
    });
  });

  it("constrains dimensions to the current origin", () => {
    expect(updateImageCropField({ x: 30, y: 20, width: 60, height: 70 }, "x", 50)).toEqual({
      x: 50,
      y: 20,
      width: 50,
      height: 70,
    });
    expect(updateImageCropField({ x: 30, y: 20, width: 60, height: 70 }, "y", 40)).toEqual({
      x: 30,
      y: 40,
      width: 60,
      height: 60,
    });
    expect(updateImageCropField({ x: 30, y: 20, width: 60, height: 70 }, "width", 90)).toEqual({
      x: 30,
      y: 20,
      width: 70,
      height: 70,
    });
    expect(updateImageCropField({ x: 30, y: 20, width: 60, height: 70 }, "height", 90)).toEqual({
      x: 30,
      y: 20,
      width: 60,
      height: 80,
    });
  });

  it("keeps edits bounded and rejects non-finite values", () => {
    expect(updateImageCropField(undefined, "x", -10)).toBeUndefined();
    expect(updateImageCropField(undefined, "y", 120)).toMatchObject({ y: 99, height: 1 });
    expect(updateImageCropField({ x: 10, y: 20, width: 60, height: 50 }, "width", Number.NaN)).toEqual({
      x: 10,
      y: 20,
      width: 60,
      height: 50,
    });
  });

  it("collapses exact full frame to undefined and preserves other crop values", () => {
    expect(normalizeImageCrop({ x: 0, y: 0, width: 100, height: 100 })).toBeUndefined();
    expect(normalizeImageCrop({ x: 10, y: 20, width: 60, height: 50 })).toEqual({
      x: 10,
      y: 20,
      width: 60,
      height: 50,
    });
    expect(isImageCropResetAvailable(undefined)).toBe(false);
    expect(isImageCropResetAvailable({ x: 10, y: 20, width: 60, height: 50 })).toBe(true);
  });
});
