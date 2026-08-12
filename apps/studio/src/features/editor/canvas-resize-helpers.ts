import type {
  ElementStyle,
  PositionAnchor,
  PowerShowElement,
} from "@powershow/document-schema";
import {
  normalizeAuthoringLengthValue,
  parseAuthoringLength,
} from "@powershow/theme/element-style-defaults";

export type CanvasResizeDirection =
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "nw";

const RESIZABLE_ELEMENT_TYPES = new Set<PowerShowElement["type"]>([
  "container",
  "textbox",
  "image",
  "code",
  "terminal",
  "table",
]);

const MINIMUM_SIZE_PX = 1;

function includesWest(direction: CanvasResizeDirection): boolean {
  return direction === "w" || direction === "nw" || direction === "sw";
}

function includesEast(direction: CanvasResizeDirection): boolean {
  return direction === "e" || direction === "ne" || direction === "se";
}

function includesNorth(direction: CanvasResizeDirection): boolean {
  return direction === "n" || direction === "nw" || direction === "ne";
}

function includesSouth(direction: CanvasResizeDirection): boolean {
  return direction === "s" || direction === "sw" || direction === "se";
}

function serializeResizedDimension(
  value: number,
  original: number | string | undefined,
  parentDimension: number,
): number | string {
  const parsed = original === undefined ? undefined : parseAuthoringLength(original);
  const normalized = normalizeAuthoringLengthValue(value);

  if (parsed?.unit === "%" && parentDimension > 0) {
    return `${normalizeAuthoringLengthValue((normalized / parentDimension) * 100)}%`;
  }

  return normalized;
}

export function isCanvasResizable(element: PowerShowElement): boolean {
  return RESIZABLE_ELEMENT_TYPES.has(element.type);
}

export function getCanvasResizeDeltas(
  direction: CanvasResizeDirection,
  deltaX: number,
  deltaY: number,
): { width: number; height: number; offsetX: number; offsetY: number } {
  const width = includesEast(direction)
    ? deltaX
    : includesWest(direction)
      ? -deltaX
      : 0;
  const height = includesSouth(direction)
    ? deltaY
    : includesNorth(direction)
      ? -deltaY
      : 0;

  return {
    width,
    height,
    offsetX: includesWest(direction) ? deltaX : 0,
    offsetY: includesNorth(direction) ? deltaY : 0,
  };
}

export function toLogicalCanvasResizeDelta(
  clientDelta: number,
  scale: number,
): number {
  return clientDelta / (scale || 1);
}

export function updateStyleForCanvasResize(
  style: ElementStyle | undefined,
  direction: CanvasResizeDirection,
  deltaX: number,
  deltaY: number,
  initialWidthPx: number,
  initialHeightPx: number,
  parentWidthPx: number,
  parentHeightPx: number,
): ElementStyle | undefined {
  const deltas = getCanvasResizeDeltas(direction, deltaX, deltaY);

  if (deltas.width === 0 && deltas.height === 0) {
    return style;
  }

  const width = deltas.width === 0
    ? style?.width
    : serializeResizedDimension(
        Math.max(MINIMUM_SIZE_PX, initialWidthPx + deltas.width),
        style?.width,
        parentWidthPx,
      );
  const height = deltas.height === 0
    ? style?.height
    : serializeResizedDimension(
        Math.max(MINIMUM_SIZE_PX, initialHeightPx + deltas.height),
        style?.height,
        parentHeightPx,
      );

  return {
    ...style,
    ...(deltas.width === 0 ? {} : { width }),
    ...(deltas.height === 0 ? {} : { height }),
  };
}

export function getCanvasResizeCursor(direction: CanvasResizeDirection): string {
  if (direction === "n" || direction === "s") {
    return "ns-resize";
  }

  if (direction === "e" || direction === "w") {
    return "ew-resize";
  }

  return direction === "ne" || direction === "sw" ? "nesw-resize" : "nwse-resize";
}

export function getCanvasResizePlacementAdjustment(
  direction: CanvasResizeDirection,
  deltaX: number,
  deltaY: number,
  anchor: PositionAnchor | undefined,
): { x: number; y: number } {
  const deltas = getCanvasResizeDeltas(direction, deltaX, deltaY);
  const effectiveAnchor = anchor ?? "center";
  const xFactor = effectiveAnchor.includes("left")
    ? 1
    : effectiveAnchor.includes("right")
      ? 0
      : 0.5;
  const yFactor = effectiveAnchor.startsWith("top")
    ? 1
    : effectiveAnchor.startsWith("bottom")
      ? 0
      : 0.5;

  return {
    x: deltas.offsetX * xFactor,
    y: deltas.offsetY * yFactor,
  };
}
