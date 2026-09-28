import type { ShapeElement } from "@web-slideshow/document-schema";

export type ShapePreset =
  | "rectangle"
  | "ellipse"
  | "triangle"
  | "polygon"
  | "star"
  | "custom"
  | "qr-code";

export const SHAPE_AUTHORING_PRESETS: readonly Exclude<ShapePreset, "custom" | "qr-code">[] = [
  "rectangle",
  "ellipse",
  "triangle",
  "polygon",
  "star",
];

export function createShapeGeometry(
  preset: Exclude<ShapePreset, "custom" | "qr-code">,
): ShapeElement["geometry"] {
  switch (preset) {
    case "rectangle":
      return {
        mode: "path",
        viewBox: { x: 0, y: 0, width: 100, height: 100 },
        commands: [
          { type: "move", x: 0, y: 0 },
          { type: "line", x: 100, y: 0 },
          { type: "line", x: 100, y: 100 },
          { type: "line", x: 0, y: 100 },
          { type: "close" },
        ],
      };

    case "ellipse":
      return {
        mode: "path",
        viewBox: { x: 0, y: 0, width: 100, height: 100 },
        commands: [
          { type: "move", x: 100, y: 50 },
          { type: "arc", radiusX: 50, radiusY: 50, rotationDeg: 0, largeArc: false, sweep: true, x: 0, y: 50 },
          { type: "arc", radiusX: 50, radiusY: 50, rotationDeg: 0, largeArc: false, sweep: true, x: 100, y: 50 },
          { type: "close" },
        ],
      };

    case "triangle":
      return {
        mode: "generated",
        generator: "triangle",
        config: { apexX: 50 },
      };

    case "polygon":
      return {
        mode: "generated",
        generator: "polygon",
        config: { points: 5, innerRadius: 1 },
      };

    case "star":
      return {
        mode: "generated",
        generator: "polygon",
        config: { points: 5, innerRadius: 0.45 },
      };
  }
}

export function getShapeGeometryPreset(
  geometry: ShapeElement["geometry"],
): ShapePreset {
  if (geometry.mode === "path") {
    const rectangle = createShapeGeometry("rectangle");
    const ellipse = createShapeGeometry("ellipse");
    if (JSON.stringify(geometry) === JSON.stringify(rectangle)) return "rectangle";
    if (JSON.stringify(geometry) === JSON.stringify(ellipse)) return "ellipse";
    return "custom";
  }

  if (geometry.generator === "triangle") {
    return "triangle";
  }

  if (geometry.generator === "qr-code") {
    return "qr-code";
  }

  if (geometry.config.innerRadius === undefined || geometry.config.innerRadius === 1) {
    return "polygon";
  }

  if (geometry.config.innerRadius !== undefined && geometry.config.innerRadius > 0 && geometry.config.innerRadius < 1) {
    return "star";
  }

  return "custom";
}
