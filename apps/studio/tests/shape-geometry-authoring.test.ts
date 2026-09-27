import { describe, expect, it } from "vitest";

import type { ShapeElement } from "@web-slideshow/document-schema";

import {
  createShapeGeometry,
  getShapeGeometryPreset,
} from "../src/features/editor/shape-geometry-authoring";

describe("Shape authoring geometry", () => {
  it("materializes the five initial presets without adding schema types", () => {
    expect(createShapeGeometry("rectangle")).toMatchObject({ mode: "path" });
    expect(createShapeGeometry("ellipse")).toMatchObject({ mode: "path" });
    expect(createShapeGeometry("triangle")).toEqual({
      mode: "generated",
      generator: "triangle",
      config: { apexX: 50 },
    });
    expect(createShapeGeometry("polygon")).toEqual({
      mode: "generated",
      generator: "polygon",
      config: { points: 5, innerRadius: 1 },
    });
    expect(createShapeGeometry("star")).toEqual({
      mode: "generated",
      generator: "polygon",
      config: { points: 5, innerRadius: 0.45 },
    });
  });

  it("uses neutral identification for custom, QR, and non-default polygon geometry", () => {
    const custom: ShapeElement["geometry"] = {
      mode: "path",
      viewBox: { x: 0, y: 0, width: 10, height: 10 },
      commands: [{ type: "move", x: 0, y: 0 }],
    };
    expect(getShapeGeometryPreset(custom)).toBe("custom");
    expect(getShapeGeometryPreset({ mode: "generated", generator: "qr-code", config: { value: "x", errorCorrection: "M", quietZone: 4 } })).toBe("qr-code");
    expect(getShapeGeometryPreset({ mode: "generated", generator: "polygon", config: { points: 8, innerRadius: 0.6 } })).toBe("custom");
  });

  it("recognizes only the semantic generated presets", () => {
    expect(getShapeGeometryPreset({ mode: "generated", generator: "triangle", config: { apexX: 0 } })).toBe("triangle");
    expect(getShapeGeometryPreset({ mode: "generated", generator: "polygon", config: { points: 6 } })).toBe("polygon");
    expect(getShapeGeometryPreset({ mode: "generated", generator: "polygon", config: { points: 5, innerRadius: 0.45, rotationDeg: 30 } })).toBe("star");
  });
});
