import type {
  ContainerElement,
  ContainerLayout,
  Length,
} from "@powershow/document-schema";
import {
  normalizeAuthoringLengthValue,
  parseAuthoringLength,
} from "@powershow/theme/element-style-defaults";

export interface ContainerCanvasDragGeometry {
  parentWidthPx: number;
  parentHeightPx: number;
  initialLeftPx: number;
  initialTopPx: number;
  initialRightPx: number;
  initialBottomPx: number;
}

type PositioningEdge = "left" | "right" | "top" | "bottom";

function initialEdgeDistance(
  edge: PositioningEdge,
  geometry: ContainerCanvasDragGeometry,
): number {
  switch (edge) {
    case "left":
      return geometry.initialLeftPx;
    case "right":
      return geometry.initialRightPx;
    case "top":
      return geometry.initialTopPx;
    case "bottom":
      return geometry.initialBottomPx;
  }
}

function resolveEdgeLengthPx(
  edge: PositioningEdge,
  value: Length,
  geometry: ContainerCanvasDragGeometry,
): number {
  if (typeof value === "number") {
    return value;
  }

  const parsed = parseAuthoringLength(value);

  if (!parsed) {
    return initialEdgeDistance(edge, geometry);
  }

  if (parsed.unit === "px") {
    return parsed.value;
  }

  if (parsed.unit === "%") {
    const parentDimension =
      edge === "left" || edge === "right"
        ? geometry.parentWidthPx
        : geometry.parentHeightPx;

    return (parsed.value / 100) * parentDimension;
  }

  // rem/em and any other unit this authoring helper cannot resolve
  // deterministically falls back to the initial rendered logical distance.
  return initialEdgeDistance(edge, geometry);
}

export function isContainerCanvasDraggable(
  container: ContainerElement,
): boolean {
  return container.layout?.position === "absolute";
}

export function updateContainerForCanvasDrag(
  container: ContainerElement,
  deltaX: number,
  deltaY: number,
  geometry: ContainerCanvasDragGeometry,
): ContainerElement {
  const layout = container.layout;

  if (layout?.position !== "absolute") {
    return container;
  }

  if (deltaX === 0 && deltaY === 0) {
    return container;
  }

  const { left, right, top, bottom } = layout;
  const nextLayout: ContainerLayout = { ...layout };

  if (deltaX !== 0) {
    if (left !== undefined) {
      nextLayout.left = normalizeAuthoringLengthValue(
        resolveEdgeLengthPx("left", left, geometry) + deltaX,
      );

      if (right !== undefined) {
        nextLayout.right = normalizeAuthoringLengthValue(
          resolveEdgeLengthPx("right", right, geometry) - deltaX,
        );
      }
    } else if (right !== undefined) {
      nextLayout.right = normalizeAuthoringLengthValue(
        resolveEdgeLengthPx("right", right, geometry) - deltaX,
      );
    } else {
      nextLayout.left = normalizeAuthoringLengthValue(
        geometry.initialLeftPx + deltaX,
      );
    }
  }

  if (deltaY !== 0) {
    if (top !== undefined) {
      nextLayout.top = normalizeAuthoringLengthValue(
        resolveEdgeLengthPx("top", top, geometry) + deltaY,
      );

      if (bottom !== undefined) {
        nextLayout.bottom = normalizeAuthoringLengthValue(
          resolveEdgeLengthPx("bottom", bottom, geometry) - deltaY,
        );
      }
    } else if (bottom !== undefined) {
      nextLayout.bottom = normalizeAuthoringLengthValue(
        resolveEdgeLengthPx("bottom", bottom, geometry) - deltaY,
      );
    } else {
      nextLayout.top = normalizeAuthoringLengthValue(
        geometry.initialTopPx + deltaY,
      );
    }
  }

  return {
    ...container,
    layout: nextLayout,
  };
}
