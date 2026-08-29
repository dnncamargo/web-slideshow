import { describe, expect, it } from "vitest";

import { resolveContainerFitGeometry } from "../src/container-fit";

describe("Container children fit geometry", () => {
  it("resolves contain with a matching aspect ratio", () => {
    expect(resolveContainerFitGeometry({
      mode: "contain",
      sourceWidth: 800,
      sourceHeight: 400,
      targetWidth: 400,
      targetHeight: 200,
    })).toEqual({
      scaleX: 0.5,
      scaleY: 0.5,
      offsetX: 0,
      offsetY: 0,
      fittedWidth: 400,
      fittedHeight: 200,
    });
  });

  it("resolves contain with letterboxing", () => {
    expect(resolveContainerFitGeometry({
      mode: "contain",
      sourceWidth: 800,
      sourceHeight: 400,
      targetWidth: 400,
      targetHeight: 300,
    })).toEqual({
      scaleX: 0.5,
      scaleY: 0.5,
      offsetX: 0,
      offsetY: 50,
      fittedWidth: 400,
      fittedHeight: 200,
    });
  });

  it("resolves cover with centered crop", () => {
    expect(resolveContainerFitGeometry({
      mode: "cover",
      sourceWidth: 800,
      sourceHeight: 400,
      targetWidth: 400,
      targetHeight: 300,
    })).toEqual({
      scaleX: 0.75,
      scaleY: 0.75,
      offsetX: -100,
      offsetY: 0,
      fittedWidth: 600,
      fittedHeight: 300,
    });
  });

  it("resolves fill with independent axis scaling", () => {
    expect(resolveContainerFitGeometry({
      mode: "fill",
      sourceWidth: 800,
      sourceHeight: 400,
      targetWidth: 400,
      targetHeight: 300,
    })).toEqual({
      scaleX: 0.5,
      scaleY: 0.75,
      offsetX: 0,
      offsetY: 0,
      fittedWidth: 400,
      fittedHeight: 300,
    });
  });

  it("supports enlargement and fractional dimensions", () => {
    expect(resolveContainerFitGeometry({
      mode: "contain",
      sourceWidth: 100,
      sourceHeight: 50,
      targetWidth: 300,
      targetHeight: 200,
    })).toMatchObject({ scaleX: 3, scaleY: 3, fittedWidth: 300, fittedHeight: 150, offsetY: 25 });

    const geometry = resolveContainerFitGeometry({
      mode: "fill",
      sourceWidth: 333.3,
      sourceHeight: 111.1,
      targetWidth: 222.2,
      targetHeight: 77.7,
    });
    expect(geometry).not.toBeNull();
    expect(geometry?.scaleX).toBeCloseTo(2 / 3);
    expect(geometry?.scaleY).toBeCloseTo(0.7);
  });

  it.each([
    [0, 100, 100, 100],
    [100, -1, 100, 100],
    [100, 100, 0, 100],
    [100, 100, 100, -1],
    [Number.NaN, 100, 100, 100],
    [100, Number.POSITIVE_INFINITY, 100, 100],
    [100, 100, Number.NaN, 100],
    [100, 100, 100, Number.POSITIVE_INFINITY],
  ])("returns null for invalid dimensions %#", (sourceWidth, sourceHeight, targetWidth, targetHeight) => {
    expect(resolveContainerFitGeometry({
      mode: "contain",
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
    })).toBeNull();
  });
});
