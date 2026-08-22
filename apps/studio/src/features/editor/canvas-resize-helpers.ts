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
  "gallery",
  "embed",
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
): number | string {  const parsed = original === undefined ? undefined : parseAuthoringLength(original);
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

const RATIO_EPSILON = 1e-9;

export const DEFAULT_IMAGE_PROPORTION_PRESERVED = true as const;

export const CANVAS_IMAGE_CORNER_DIRECTIONS: readonly CanvasResizeDirection[] = [
  "nw",
  "ne",
  "sw",
  "se",
];

export interface ProportionalResizeResult {
  width: number;
  height: number;
  ratio: number;
}

/**
 * Compute a deterministic proportional result for a locked corner resize.
 *
 * The gesture provides both horizontal and vertical logical deltas. The
 * primary dimension is the one whose relative change is larger; the secondary
 * dimension is derived from the fixed ratio. This keeps locking predictable
 * and never distorts the box.
 */
export function resolveProportionalResize(
  direction: CanvasResizeDirection,
  deltaX: number,
  deltaY: number,
  initialWidthPx: number,
  initialHeightPx: number,
): ProportionalResizeResult {
  const deltas = getCanvasResizeDeltas(direction, deltaX, deltaY);
  const candidateWidth = Math.max(MINIMUM_SIZE_PX, initialWidthPx + deltas.width);
  const candidateHeight = Math.max(
    MINIMUM_SIZE_PX,
    initialHeightPx + deltas.height,
  );
  const ratio =
    initialHeightPx > RATIO_EPSILON
      ? initialWidthPx / initialHeightPx
      : 1;
  const relativeWidth = (candidateWidth - initialWidthPx) / initialWidthPx;
  const relativeHeight =
    (candidateHeight - initialHeightPx) / initialHeightPx;
  const primaryIsWidth = Math.abs(relativeWidth) >= Math.abs(relativeHeight);

  let width: number;
  let height: number;

  if (primaryIsWidth) {
    width = candidateWidth;
    height = width / ratio;
  } else {
    height = candidateHeight;
    width = height * ratio;
  }

  if (width < MINIMUM_SIZE_PX) {
    width = MINIMUM_SIZE_PX;
    height = width / ratio;
  } else if (height < MINIMUM_SIZE_PX) {
    height = MINIMUM_SIZE_PX;
    width = height * ratio;
  }

  return { width, height, ratio };
}

export function updateStyleForProportionalResize(
  style: ElementStyle | undefined,
  direction: CanvasResizeDirection,
  deltaX: number,
  deltaY: number,
  initialWidthPx: number,
  initialHeightPx: number,
  parentWidthPx: number,
  parentHeightPx: number,
): ElementStyle | undefined {
  if (deltaX === 0 && deltaY === 0) {
    return style;
  }

  const { width, height } = resolveProportionalResize(
    direction,
    deltaX,
    deltaY,
    initialWidthPx,
    initialHeightPx,
  );

  return {
    ...style,
    width: serializeResizedDimension(width, style?.width, parentWidthPx),
    height: serializeResizedDimension(height, style?.height, parentHeightPx),
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
