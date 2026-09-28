import { describe, expect, it } from "vitest";

import {
  PresentationElementSchema,
  PresentationSchema,
  ShapeElementSchema,
  linkColorToPalette,
  removePresentationPaletteColor,
} from "../src";
import { defaultsInput } from "./fixtures/schema-fixtures";

const pathGeometry = {
  mode: "path" as const,
  viewBox: { x: 0, y: 0, width: 100, height: 100 },
  commands: [
    { type: "move" as const, x: 10, y: 10 },
    { type: "line" as const, x: 90, y: 10 },
    { type: "quadratic" as const, controlX: 95, controlY: 50, x: 90, y: 90 },
    { type: "cubic" as const, control1X: 70, control1Y: 95, control2X: 30, control2Y: 95, x: 10, y: 90 },
    { type: "arc" as const, radiusX: 10, radiusY: 20, rotationDeg: 15, largeArc: false, sweep: true, x: 10, y: 10 },
    { type: "close" as const },
    { type: "move" as const, x: 35, y: 35 },
    { type: "line" as const, x: 65, y: 35 },
    { type: "close" as const },
  ],
  fillRule: "evenodd" as const,
};

const shape = {
  id: "shape-1",
  type: "shape" as const,
  geometry: pathGeometry,
};

describe("Shape geometry contract", () => {
  it("accepts path geometry with every command and multiple subpaths", () => {
    const parsed = ShapeElementSchema.parse(shape);

    expect(parsed.geometry).toEqual(pathGeometry);
  });

  it.each([
    { mode: "generated", generator: "polygon", config: { points: 5 } },
    { mode: "generated", generator: "polygon", config: { points: 5, innerRadius: 0.45, rotationDeg: 18 } },
    { mode: "generated", generator: "triangle", config: { apexX: 50 } },
    { mode: "generated", generator: "qr-code", config: { value: "https://example.com" } },
  ] as const)("accepts generated geometry %j", (geometry) => {
    const parsed = ShapeElementSchema.parse({ ...shape, geometry });

    expect(parsed.geometry).toMatchObject(geometry);
    if (geometry.generator === "qr-code") {
      expect(parsed.geometry).toEqual({
        mode: "generated",
        generator: "qr-code",
        config: { value: "https://example.com", errorCorrection: "M", quietZone: 4 },
      });
    }
  });

  it("rejects unknown geometry and command fields", () => {
    expect(ShapeElementSchema.safeParse({
      ...shape,
      unknown: true,
    }).success).toBe(false);
    expect(ShapeElementSchema.safeParse({
      ...shape,
      geometry: {
        ...pathGeometry,
        unknown: true,
      },
    }).success).toBe(false);
    expect(ShapeElementSchema.safeParse({
      ...shape,
      geometry: {
        ...pathGeometry,
        commands: [{ ...pathGeometry.commands[0], unknown: true }],
      },
    }).success).toBe(false);
  });

  it.each([
    { viewBox: { x: 0, y: 0, width: 0, height: 100 } },
    { viewBox: { x: 0, y: 0, width: 100, height: Number.POSITIVE_INFINITY } },
    { commands: [{ type: "line", x: 0, y: 0 }] },
    { commands: [{ type: "move", x: Number.NaN, y: 0 }] },
    { commands: [{ type: "arc", radiusX: 0, radiusY: 1, rotationDeg: 0, largeArc: false, sweep: false, x: 0, y: 0 }] },
    { commands: [{ type: "arc", radiusX: 1, radiusY: Number.NEGATIVE_INFINITY, rotationDeg: 0, largeArc: false, sweep: false, x: 0, y: 0 }] },
  ])("rejects invalid path geometry %j", (change) => {
    expect(ShapeElementSchema.safeParse({
      ...shape,
      geometry: { ...pathGeometry, ...change },
    }).success).toBe(false);
  });

  it.each([
    { generator: "polygon", config: { points: 2 } },
    { generator: "polygon", config: { points: 13 } },
    { generator: "polygon", config: { points: 5, innerRadius: 0 } },
    { generator: "polygon", config: { points: 5, innerRadius: 1.1 } },
    { generator: "triangle", config: { apexX: -1 } },
    { generator: "triangle", config: { apexX: 101 } },
    { generator: "qr-code", config: { value: "" } },
    { generator: "qr-code", config: { value: "x", errorCorrection: "Z" } },
    { generator: "qr-code", config: { value: "x", quietZone: -1 } },
  ])("rejects invalid generated geometry %j", (geometry) => {
    expect(ShapeElementSchema.safeParse({
      ...shape,
      geometry: { mode: "generated", ...geometry },
    }).success).toBe(false);
  });
});

describe("Shape appearance and intent", () => {
  it("accepts color, gradient, and image fills with stroke, effect, link, and animation", () => {
    const parsed = ShapeElementSchema.parse({
      ...shape,
      style: {
        fill: { type: "color", color: "#ff0000" },
        stroke: { width: 2, color: "#000000", style: "solid" },
        borderRadius: "1rem",
      },
      effect: {
        opacity: 0.8,
        shadow: { x: 1, y: 2, blur: 4, color: "#000000" },
      },
      link: { kind: "url", href: "https://example.com" },
      animation: {
        durationMs: 1000,
        loop: true,
        autoplay: false,
        rotate: { fromDeg: 0, toDeg: 360 },
        translate: { fromXPercent: 0, fromYPercent: 0, toXPercent: 25, toYPercent: -10 },
        skew: { fromXDeg: 0, fromYDeg: 0, toXDeg: 10, toYDeg: -5 },
      },
      transform: { translateXPercent: 12.5, translateYPercent: -8, rotationDeg: 30 },
    });

    expect(parsed.style?.fill).toEqual({ type: "color", color: "#ff0000" });
    expect(parsed.style?.borderRadius).toBe("1rem");
    expect(parsed.transform).toEqual({ translateXPercent: 12.5, translateYPercent: -8, rotationDeg: 30 });
    expect(ShapeElementSchema.safeParse({ ...shape, style: { fill: { type: "gradient", gradient: {
      type: "linear",
      stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 100 }],
    } } } }).success).toBe(true);
    expect(ShapeElementSchema.safeParse({ ...shape, style: { fill: {
      type: "image", src: "/assets/fill.webp", fit: "cover", focalPoint: { x: 50, y: 50 },
      crop: { x: 10, y: 10, width: 80, height: 80 },
    } } }).success).toBe(true);
  });

  it.each([
    { animation: { durationMs: 0, rotate: { fromDeg: 0, toDeg: 1 } } },
    { animation: { durationMs: -1, rotate: { fromDeg: 0, toDeg: 1 } } },
    { animation: { durationMs: 1.5, rotate: { fromDeg: 0, toDeg: 1 } } },
    { animation: { durationMs: 1000 } },
    { animation: { durationMs: 1000, rotate: { fromDeg: Number.NaN, toDeg: 1 } } },
    { animation: { durationMs: 1000, translate: { fromXPercent: 0, fromYPercent: 0, toXPercent: Number.POSITIVE_INFINITY, toYPercent: 0 } } },
    { animation: { durationMs: 1000, unknown: true, rotate: { fromDeg: 0, toDeg: 1 } } },
    { style: { unknown: true } },
    { style: { borderRadius: true } },
    { transform: { translateXPercent: Number.NaN } },
    { transform: { rotationDeg: Number.POSITIVE_INFINITY } },
    { transform: { unknown: 1 } },
  ])("rejects invalid Shape appearance or animation %j", (change) => {
    expect(ShapeElementSchema.safeParse({ ...shape, ...change }).success).toBe(false);
  });

  it("keeps authored transform sparse and accepts length-based corner radius", () => {
    const parsed = ShapeElementSchema.parse({
      ...shape,
      style: { borderRadius: 12 },
      transform: { rotationDeg: -45 },
    });

    expect(parsed.style).toEqual({ borderRadius: 12 });
    expect(parsed.transform).toEqual({ rotationDeg: -45 });
  });
});

describe("Shape element integration", () => {
  it("accepts Shape as a normal element and inside a Container", () => {
    const result = PresentationElementSchema.safeParse({
      id: "container-1",
      type: "container",
      children: [shape],
    });

    expect(result.success).toBe(true);
    if (result.success && result.data.type === "container") {
      expect(result.data.children[0]).toMatchObject({ type: "shape", id: "shape-1" });
    }
  });

  it("roundtrips Shape intent through canonical presentation JSON", () => {
    const presentation = PresentationSchema.parse({
      ...defaultsInput,
      slides: [{ id: "slide-1", elements: [shape] }],
    });
    const restored = PresentationSchema.parse(JSON.parse(JSON.stringify(presentation)));

    expect(restored).toEqual(presentation);
    expect(restored.schemaVersion).toBe(1);
  });
});

describe("Shape palette integration", () => {
  const accent = linkColorToPalette("accent");
  const presentationInput = {
    schemaVersion: 1 as const,
    id: "palette-shape",
    title: "Palette Shape",
    palette: {
      colors: [
        { id: "accent", name: "Accent", value: "#ff0000" },
        { id: "shadow", name: "Shadow", value: "#000000" },
      ],
    },
    slides: [{
      id: "slide-1",
      elements: [{
        ...shape,
        style: {
          fill: { type: "color", color: accent },
          stroke: { width: 2, gradient: {
            type: "linear",
            stops: [{ color: accent, position: 0 }, { color: "#ffffff", position: 100 }],
          } },
        },
        effect: { shadow: { x: 1, y: 1, blur: 2, color: accent } },
      }],
    }],
  };

  it("accepts resolved Shape palette references", () => {
    expect(PresentationSchema.safeParse(presentationInput).success).toBe(true);
  });

  it("rejects a missing Shape palette reference", () => {
    expect(PresentationSchema.safeParse({
      ...presentationInput,
      palette: { colors: [] },
    }).success).toBe(false);
  });

  it("detaches Shape colors when a palette color is removed", () => {
    const presentation = PresentationSchema.parse(presentationInput);
    const result = removePresentationPaletteColor(presentation, "accent");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detachedCount).toBe(3);
    const detached = result.presentation.slides[0]?.elements[0];
    expect(detached).toMatchObject({
      style: {
        fill: { type: "color", color: "#ff0000" },
      },
    });
    if (detached?.type === "shape") {
      expect(detached.style?.stroke?.gradient?.stops[0]?.color).toBe("#ff0000");
    }
    expect(detached).toMatchObject({ effect: { shadow: { color: "#ff0000" } } });
  });
});
