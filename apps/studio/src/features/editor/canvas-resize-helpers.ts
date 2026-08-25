import type {
  PowerShowElement,
} from "@powershow/document-schema";

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
  "image",
  "code",
  "terminal",
  "table",
  "gallery",
  "embed",
  "blocks",
  "scripted",
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

export function getCanvasResizeCursor(direction: CanvasResizeDirection): string {
  if (direction === "n" || direction === "s") {
    return "ns-resize";
  }

  if (direction === "e" || direction === "w") {
    return "ew-resize";
  }

  return direction === "ne" || direction === "sw" ? "nesw-resize" : "nwse-resize";
}
