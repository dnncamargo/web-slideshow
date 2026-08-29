import { describe, expect, it } from "vitest";

import {
  fitLogicalSlideGeometry,
  resolveLogicalSlideSize,
} from "../src/slide-geometry";

describe("slide geometry", () => {
  it("resolves the frozen 16:9 logical size", () => {
    expect(resolveLogicalSlideSize("16:9")).toEqual({
      logicalWidth: 960,
      logicalHeight: 540,
    });
  });

  it("resolves the frozen 4:3 logical size", () => {
    expect(resolveLogicalSlideSize("4:3")).toEqual({
      logicalWidth: 960,
      logicalHeight: 720,
    });
  });

  it("fits a 16:9 logical slide at scale 2 in a 1920x1080 viewport", () => {
    expect(fitLogicalSlideGeometry("16:9", 1920, 1080)).toEqual({
      logicalWidth: 960,
      logicalHeight: 540,
      scale: 2,
      physicalWidth: 1920,
      physicalHeight: 1080,
    });
  });

  it("fits a 16:9 logical slide uniformly in a 1280x720 viewport", () => {
    expect(fitLogicalSlideGeometry("16:9", 1280, 720)).toEqual({
      logicalWidth: 960,
      logicalHeight: 540,
      scale: 4 / 3,
      physicalWidth: 1280,
      physicalHeight: 720,
    });
  });

  it("letterboxes a tall viewport using its limiting width", () => {
    expect(fitLogicalSlideGeometry("16:9", 800, 1200)).toEqual({
      logicalWidth: 960,
      logicalHeight: 540,
      scale: 5 / 6,
      physicalWidth: 800,
      physicalHeight: 450,
    });
  });

  it("preserves the 4:3 ratio when fitting", () => {
    expect(fitLogicalSlideGeometry("4:3", 1200, 900)).toEqual({
      logicalWidth: 960,
      logicalHeight: 720,
      scale: 1.25,
      physicalWidth: 1200,
      physicalHeight: 900,
    });
  });

  it("changes fitted geometry without changing logical dimensions", () => {
    const smaller = fitLogicalSlideGeometry("16:9", 960, 540);
    const larger = fitLogicalSlideGeometry("16:9", 1920, 1080);

    expect(smaller.logicalWidth).toBe(larger.logicalWidth);
    expect(smaller.logicalHeight).toBe(larger.logicalHeight);
    expect(smaller.scale).not.toBe(larger.scale);
    expect(smaller.physicalWidth).not.toBe(larger.physicalWidth);
    expect(smaller.physicalHeight).not.toBe(larger.physicalHeight);
  });

  it.each([
    [0, 720],
    [960, 0],
    [0, 0],
  ])("returns zero fitted geometry for an unavailable dimension", (width, height) => {
    const geometry = fitLogicalSlideGeometry("16:9", width, height);

    expect(geometry.scale).toBe(0);
    expect(geometry.physicalWidth).toBe(0);
    expect(geometry.physicalHeight).toBe(0);
    expect(Number.isFinite(geometry.scale)).toBe(true);
    expect(Number.isFinite(geometry.physicalWidth)).toBe(true);
    expect(Number.isFinite(geometry.physicalHeight)).toBe(true);
  });
});
