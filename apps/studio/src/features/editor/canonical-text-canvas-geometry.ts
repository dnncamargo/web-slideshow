import type { BlocksElement, CodeElement, DividerElement, ElementLayout, EmbedElement, GalleryElement, ImageElement, ImageLayout, ResizablePositionedLayout, ScriptedElement, TableElement, TerminalElement, TextElement, TextboxElement, TopicsElement } from "@powershow/document-schema";
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
type CanonicalElement = TextFamilyElement | ImageElement | GalleryElement | EmbedElement | ScriptedElement | CodeElement | TerminalElement | TableElement | BlocksElement | DividerElement | TopicsElement;
type PositioningEdge = "left" | "right" | "top" | "bottom";

function includes(direction: CanvasResizeDirection, value: string): boolean {
  return direction.includes(value);
}

function initialEdgeDistance(edge: PositioningEdge, geometry: CanonicalTextCanvasGeometry): number {
  switch (edge) {
    case "left": return geometry.initialLeftPx;
    case "right": return geometry.initialRightPx;
    case "top": return geometry.initialTopPx;
    case "bottom": return geometry.initialBottomPx;
  }
}

function resolveEdgePx(edge: PositioningEdge, value: string | number, geometry: CanonicalTextCanvasGeometry): number {
  if (typeof value === "number") return value;
  const parsed = parseAuthoringLength(value);
  if (!parsed) return initialEdgeDistance(edge, geometry);
  if (parsed.unit === "px") return parsed.value;
  if (parsed.unit === "%") {
    const parent = edge === "left" || edge === "right" ? geometry.parentWidthPx : geometry.parentHeightPx;
    return (parsed.value / 100) * parent;
  }
  return initialEdgeDistance(edge, geometry);
}

export function updateCanonicalElementForCanvasDrag(
  element: CanonicalElement,
  deltaX: number,
  deltaY: number,
  geometry: CanonicalTextCanvasGeometry,
): CanonicalElement {
  if (element.layout?.position !== "absolute" || (deltaX === 0 && deltaY === 0)) return element as CanonicalElement;

  const layout = element.layout;
  const next: ElementLayout | ImageLayout = { ...layout };
  if (deltaX !== 0) {
    if (layout.left !== undefined) {
      next.left = normalizeAuthoringLengthValue(resolveEdgePx("left", layout.left, geometry) + deltaX);
      if (layout.right !== undefined) next.right = normalizeAuthoringLengthValue(resolveEdgePx("right", layout.right, geometry) - deltaX);
    } else if (layout.right !== undefined) {
      next.right = normalizeAuthoringLengthValue(resolveEdgePx("right", layout.right, geometry) - deltaX);
    } else {
      next.left = normalizeAuthoringLengthValue(geometry.initialLeftPx + deltaX);
    }
  }
  if (deltaY !== 0) {
    if (layout.top !== undefined) {
      next.top = normalizeAuthoringLengthValue(resolveEdgePx("top", layout.top, geometry) + deltaY);
      if (layout.bottom !== undefined) next.bottom = normalizeAuthoringLengthValue(resolveEdgePx("bottom", layout.bottom, geometry) - deltaY);
    } else if (layout.bottom !== undefined) {
      next.bottom = normalizeAuthoringLengthValue(resolveEdgePx("bottom", layout.bottom, geometry) - deltaY);
    } else {
      next.top = normalizeAuthoringLengthValue(geometry.initialTopPx + deltaY);
    }
  }
  return { ...element, layout: next } as CanonicalElement;
}

export function updateCanonicalTextForCanvasDrag(
  element: TextFamilyElement,
  deltaX: number,
  deltaY: number,
  geometry: CanonicalTextCanvasGeometry,
): TextFamilyElement {
  return updateCanonicalElementForCanvasDrag(element, deltaX, deltaY, geometry) as TextFamilyElement;
}

export function updateCanonicalImageForCanvasDrag(
  element: ImageElement,
  deltaX: number,
  deltaY: number,
  geometry: CanonicalTextCanvasGeometry,
): ImageElement {
  return updateCanonicalElementForCanvasDrag(element, deltaX, deltaY, geometry) as ImageElement;
}

export function updateCanonicalSurfaceForCanvasDrag(
  element: GalleryElement | EmbedElement | ScriptedElement | CodeElement | TerminalElement | TableElement | BlocksElement,
  deltaX: number,
  deltaY: number,
  geometry: CanonicalTextCanvasGeometry,
): GalleryElement | EmbedElement | ScriptedElement | CodeElement | TerminalElement | TableElement | BlocksElement {
  return updateCanonicalElementForCanvasDrag(element, deltaX, deltaY, geometry) as GalleryElement | EmbedElement | ScriptedElement | CodeElement | TerminalElement | TableElement | BlocksElement;
}

function serializeSize(value: number, original: string | number | undefined, parent: number): string | number {
  const normalized = normalizeAuthoringLengthValue(value);
  const parsed = original === undefined ? undefined : parseAuthoringLength(original);
  if (parsed?.unit === "%" && parent > 0) return `${normalizeAuthoringLengthValue((normalized / parent) * 100)}%`;
  return normalized;
}

function updateAxis(
  layout: ElementLayout,
  axis: "horizontal" | "vertical",
  direction: CanvasResizeDirection,
  delta: number,
  geometry: CanonicalTextCanvasGeometry,
): ElementLayout {
  const isHorizontal = axis === "horizontal";
  const touched = isHorizontal ? includes(direction, "e") || includes(direction, "w") : includes(direction, "n") || includes(direction, "s");
  if (!touched || delta === 0) return layout;

  const startEdge: PositioningEdge = isHorizontal ? "left" : "top";
  const endEdge: PositioningEdge = isHorizontal ? "right" : "bottom";
  const start = isHorizontal ? layout.left : layout.top;
  const end = isHorizontal ? layout.right : layout.bottom;
  const dimension = isHorizontal ? layout.width : layout.height;
  const parent = isHorizontal ? geometry.parentWidthPx : geometry.parentHeightPx;
  const initialDimension = isHorizontal ? geometry.initialWidthPx : geometry.initialHeightPx;
  const initialStart = initialEdgeDistance(startEdge, geometry);
  const startPx = start === undefined ? undefined : resolveEdgePx(startEdge, start, geometry);
  const endPx = end === undefined ? undefined : resolveEdgePx(endEdge, end, geometry);
  const movesStart = isHorizontal ? includes(direction, "w") : includes(direction, "n");
  const resized = serializeSize(Math.max(1, initialDimension + (movesStart ? -delta : delta)), dimension, parent);
  const next = { ...layout };
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
  if (deltaX === 0 && deltaY === 0) return element;
  const layout = element.layout ?? {};
  const next = element.layout?.position === "absolute"
    ? updateAxis(updateAxis(layout, "horizontal", direction, deltaX, geometry), "vertical", direction, deltaY, geometry)
    : {
        ...layout,
        ...(deltaX !== 0 && (includes(direction, "e") || includes(direction, "w"))
          ? { width: serializeSize(Math.max(1, geometry.initialWidthPx + (includes(direction, "w") ? -deltaX : deltaX)), layout.width, geometry.parentWidthPx) }
          : {}),
        ...(deltaY !== 0 && (includes(direction, "n") || includes(direction, "s"))
          ? { height: serializeSize(Math.max(1, geometry.initialHeightPx + (includes(direction, "n") ? -deltaY : deltaY)), layout.height, geometry.parentHeightPx) }
          : {}),
      };
  return { ...element, layout: next };
}

export function updateImageForCanvasResize(
  element: ImageElement,
  direction: CanvasResizeDirection,
  deltaX: number,
  deltaY: number,
  geometry: CanonicalTextCanvasGeometry,
  proportionalSize?: { width: number; height: number },
): ImageElement {
  if (deltaX === 0 && deltaY === 0) return element;
  const layout = (element.layout ?? {}) as ElementLayout;
  if (element.layout?.position !== "absolute") {
    const next = { ...layout };
    if (proportionalSize) {
      next.width = serializeSize(proportionalSize.width, layout.width, geometry.parentWidthPx);
      next.height = serializeSize(proportionalSize.height, layout.height, geometry.parentHeightPx);
    } else {
      if (deltaX !== 0 && (includes(direction, "e") || includes(direction, "w"))) {
        next.width = serializeSize(Math.max(1, geometry.initialWidthPx + (includes(direction, "w") ? -deltaX : deltaX)), layout.width, geometry.parentWidthPx);
      }
      if (deltaY !== 0 && (includes(direction, "n") || includes(direction, "s"))) {
        next.height = serializeSize(Math.max(1, geometry.initialHeightPx + (includes(direction, "n") ? -deltaY : deltaY)), layout.height, geometry.parentHeightPx);
      }
    }
    return { ...element, layout: next } as ImageElement;
  }

  const widthDelta = proportionalSize
    ? (includes(direction, "w") ? geometry.initialWidthPx - proportionalSize.width : proportionalSize.width - geometry.initialWidthPx)
    : deltaX;
  const heightDelta = proportionalSize
    ? (includes(direction, "n") ? geometry.initialHeightPx - proportionalSize.height : proportionalSize.height - geometry.initialHeightPx)
    : deltaY;
  const next = updateAxis(updateAxis(layout, "horizontal", direction, widthDelta, geometry), "vertical", direction, heightDelta, geometry);
  return { ...element, layout: next } as ImageElement;
}

export function updateSurfaceForCanvasResize(
  element: GalleryElement | EmbedElement | ScriptedElement | CodeElement | TerminalElement | TableElement | BlocksElement,
  direction: CanvasResizeDirection,
  deltaX: number,
  deltaY: number,
  geometry: CanonicalTextCanvasGeometry,
): GalleryElement | EmbedElement | ScriptedElement | CodeElement | TerminalElement | TableElement | BlocksElement {
  if (deltaX === 0 && deltaY === 0) return element;
  const layout = element.layout ?? {};
  const next = element.layout?.position === "absolute"
    ? updateAxis(layout as ElementLayout, "horizontal", direction, deltaX, geometry)
    : {
        ...layout,
        ...(deltaX !== 0 && (includes(direction, "e") || includes(direction, "w"))
          ? { width: serializeSize(Math.max(1, geometry.initialWidthPx + (includes(direction, "w") ? -deltaX : deltaX)), layout.width, geometry.parentWidthPx) }
          : {}),
        ...(deltaY !== 0 && (includes(direction, "n") || includes(direction, "s"))
          ? { height: serializeSize(Math.max(1, geometry.initialHeightPx + (includes(direction, "n") ? -deltaY : deltaY)), layout.height, geometry.parentHeightPx) }
          : {}),
      };
  const vertical = element.layout?.position === "absolute"
    ? updateAxis(next, "vertical", direction, deltaY, geometry)
    : next;
  return { ...element, layout: vertical as ResizablePositionedLayout } as GalleryElement | EmbedElement | ScriptedElement | CodeElement | TerminalElement | TableElement | BlocksElement;
}
