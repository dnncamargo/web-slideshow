import type { ElementLayout, TextElement, TextboxElement } from "@powershow/document-schema";
import { normalizeAuthoringLengthValue, parseAuthoringLength } from "@powershow/theme/element-style-defaults";
import type { CanvasResizeDirection } from "./canvas-resize-helpers";

export interface CanonicalTextCanvasGeometry {
  parentWidthPx: number;
  parentHeightPx: number;
  initialLeftPx: number;
  initialTopPx: number;
  initialRightPx: number;
  initialBottomPx: number;
  initialWidthPx: number;
  initialHeightPx: number;
}

type TextFamilyElement = TextElement | TextboxElement;

function edgePx(value: string | number | undefined, fallback: number, parent: number): number {
  const parsed = value === undefined ? undefined : parseAuthoringLength(value);
  if (!parsed) return fallback;
  return parsed.unit === "%" ? (parsed.value / 100) * parent : parsed.value;
}

function edgeValue(value: string | number | undefined, fallback: number, parent: number): number {
  return edgePx(value, fallback, parent);
}

export function updateCanonicalTextForCanvasDrag(
  element: TextFamilyElement,
  deltaX: number,
  deltaY: number,
  geometry: CanonicalTextCanvasGeometry,
): TextFamilyElement {
  if (element.layout?.position !== "absolute") return element;
  const layout = element.layout;
  const next: ElementLayout = { ...layout };

  if (deltaX !== 0) {
    if (layout.left !== undefined) {
      next.left = normalizeAuthoringLengthValue(edgeValue(layout.left, geometry.initialLeftPx, geometry.parentWidthPx) + deltaX);
      if (layout.right !== undefined) next.right = normalizeAuthoringLengthValue(edgeValue(layout.right, geometry.initialRightPx, geometry.parentWidthPx) - deltaX);
    } else if (layout.right !== undefined) {
      next.right = normalizeAuthoringLengthValue(edgeValue(layout.right, geometry.initialRightPx, geometry.parentWidthPx) - deltaX);
    } else {
      next.left = normalizeAuthoringLengthValue(geometry.initialLeftPx + deltaX);
    }
  }

  if (deltaY !== 0) {
    if (layout.top !== undefined) {
      next.top = normalizeAuthoringLengthValue(edgeValue(layout.top, geometry.initialTopPx, geometry.parentHeightPx) + deltaY);
      if (layout.bottom !== undefined) next.bottom = normalizeAuthoringLengthValue(edgeValue(layout.bottom, geometry.initialBottomPx, geometry.parentHeightPx) - deltaY);
    } else if (layout.bottom !== undefined) {
      next.bottom = normalizeAuthoringLengthValue(edgeValue(layout.bottom, geometry.initialBottomPx, geometry.parentHeightPx) - deltaY);
    } else {
      next.top = normalizeAuthoringLengthValue(geometry.initialTopPx + deltaY);
    }
  }

  return { ...element, layout: next };
}

function includes(direction: CanvasResizeDirection, value: string): boolean {
  return direction.includes(value);
}

function serializeSize(value: number, original: string | number | undefined): string | number {
  if (typeof original === "string" && original.endsWith("%")) return `${value}%`;
  return value;
}

function updateAxis(
  layout: ElementLayout,
  axis: "horizontal" | "vertical",
  direction: CanvasResizeDirection,
  delta: number,
  geometry: CanonicalTextCanvasGeometry,
): ElementLayout {
  const isHorizontal = axis === "horizontal";
  const start = isHorizontal ? layout.left : layout.top;
  const end = isHorizontal ? layout.right : layout.bottom;
  const dimension = isHorizontal ? layout.width : layout.height;
  const parent = isHorizontal ? geometry.parentWidthPx : geometry.parentHeightPx;
  const initialDimension = isHorizontal ? geometry.initialWidthPx : geometry.initialHeightPx;
  const initialStart = isHorizontal ? geometry.initialLeftPx : geometry.initialTopPx;
  const movesStart = isHorizontal ? includes(direction, "w") : includes(direction, "n");
  const next = { ...layout };
  const startPx = start === undefined ? undefined : edgeValue(start, initialStart, parent);
  const endPx = end === undefined ? undefined : edgeValue(end, isHorizontal ? geometry.initialRightPx : geometry.initialBottomPx, parent);
  const resized = serializeSize(Math.max(1, initialDimension + (movesStart ? -delta : delta)), dimension);
  const setStart = (value: number) => { if (isHorizontal) next.left = normalizeAuthoringLengthValue(value); else next.top = normalizeAuthoringLengthValue(value); };
  const setEnd = (value: number) => { if (isHorizontal) next.right = normalizeAuthoringLengthValue(value); else next.bottom = normalizeAuthoringLengthValue(value); };
  const setDimension = (value: string | number) => { if (isHorizontal) next.width = value; else next.height = value; };

  if (startPx !== undefined && endPx !== undefined && dimension === undefined) {
    if (movesStart) setStart(startPx + delta); else setEnd(endPx - delta);
    return next;
  }
  if (startPx !== undefined && movesStart) setStart(startPx + delta);
  if (endPx !== undefined && !movesStart) setEnd(endPx - delta);
  setDimension(resized);
  if (startPx === undefined && endPx === undefined) setStart(movesStart ? initialStart + delta : initialStart);
  return next;
}

export function updateTextboxForCanvasResize(
  element: TextboxElement,
  direction: CanvasResizeDirection,
  deltaX: number,
  deltaY: number,
  geometry: CanonicalTextCanvasGeometry,
): TextboxElement {
  const layout = element.layout ?? {};
  const next = element.layout?.position === "absolute"
    ? updateAxis(updateAxis(layout, "horizontal", direction, deltaX, geometry), "vertical", direction, deltaY, geometry)
    : {
        ...layout,
        ...(includes(direction, "e") || includes(direction, "w")
          ? { width: serializeSize(Math.max(1, geometry.initialWidthPx + (includes(direction, "w") ? -deltaX : deltaX)), layout.width) }
          : {}),
        ...(includes(direction, "n") || includes(direction, "s")
          ? { height: serializeSize(Math.max(1, geometry.initialHeightPx + (includes(direction, "n") ? -deltaY : deltaY)), layout.height) }
          : {}),
      };
  return { ...element, layout: next };
}
