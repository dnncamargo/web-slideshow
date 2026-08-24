import type {
  ContainerElement,
  ContainerLayout,
  Length,
} from "@powershow/document-schema";
import {
  normalizeAuthoringLengthValue,
  parseAuthoringLength,
} from "@powershow/theme/element-style-defaults";

import type { CanvasResizeDirection } from "./canvas-resize-helpers";

export interface ContainerCanvasDragGeometry {
  parentWidthPx: number;
  parentHeightPx: number;
  initialLeftPx: number;
  initialTopPx: number;
  initialRightPx: number;
  initialBottomPx: number;
}

export interface ContainerCanvasResizeGeometry {
  parentWidthPx: number;
  parentHeightPx: number;
  initialWidthPx: number;
  initialHeightPx: number;
  initialLeftPx: number;
  initialTopPx: number;
  initialRightPx: number;
  initialBottomPx: number;
}

type PositioningEdge = "left" | "right" | "top" | "bottom";

const MINIMUM_SIZE_PX = 1;

const FLOW_RESIZE_DIRECTIONS: readonly CanvasResizeDirection[] = [
  "e",
  "s",
  "se",
];

const ABSOLUTE_RESIZE_DIRECTIONS: readonly CanvasResizeDirection[] = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
];

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

function serializeCanvasResizedDimension(
  value: number,
  parentDimension: number,
): number | string {
  const normalized = normalizeAuthoringLengthValue(value);

  if (parentDimension > 0) {
    return `${normalizeAuthoringLengthValue(
      (normalized / parentDimension) * 100,
    )}%`;
  }

  return normalized;
}

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

export function getContainerCanvasResizeDirections(
  container: ContainerElement,
): readonly CanvasResizeDirection[] {
  return container.layout?.position === "absolute"
    ? ABSOLUTE_RESIZE_DIRECTIONS
    : FLOW_RESIZE_DIRECTIONS;
}

function updateFlowContainerForCanvasResize(
  container: ContainerElement,
  direction: CanvasResizeDirection,
  deltaX: number,
  deltaY: number,
  geometry: ContainerCanvasResizeGeometry,
): ContainerElement {
  if (direction !== "e" && direction !== "s" && direction !== "se") {
    return container;
  }

  const layout: ContainerLayout = container.layout ?? {};
  const nextLayout: ContainerLayout = { ...layout };
  const widthDelta = includesEast(direction) ? deltaX : 0;
  const heightDelta = includesSouth(direction) ? deltaY : 0;
  let changed = false;

  if (widthDelta !== 0) {
    nextLayout.width = serializeCanvasResizedDimension(
      Math.max(MINIMUM_SIZE_PX, geometry.initialWidthPx + widthDelta),
      geometry.parentWidthPx,
    );
    changed = true;
  }

  if (heightDelta !== 0) {
    nextLayout.height = serializeCanvasResizedDimension(
      Math.max(MINIMUM_SIZE_PX, geometry.initialHeightPx + heightDelta),
      geometry.parentHeightPx,
    );
    changed = true;
  }

  if (!changed) {
    return container;
  }

  return {
    ...container,
    layout: nextLayout,
  };
}

function updateAbsoluteContainerHorizontalAxis(
  layout: ContainerLayout,
  direction: CanvasResizeDirection,
  deltaX: number,
  geometry: ContainerCanvasResizeGeometry,
): ContainerLayout {
  const nextLayout: ContainerLayout = { ...layout };
  const { left, right } = layout;
  const leftPx =
    left === undefined
      ? undefined
      : resolveEdgeLengthPx("left", left, geometry);
  const rightPx =
    right === undefined
      ? undefined
      : resolveEdgeLengthPx("right", right, geometry);
  const movesWest = includesWest(direction);
  const widthDelta = movesWest ? -deltaX : deltaX;
  const resizedWidth = serializeCanvasResizedDimension(
    Math.max(MINIMUM_SIZE_PX, geometry.initialWidthPx + widthDelta),
    geometry.parentWidthPx,
  );

  if (
    leftPx !== undefined &&
    rightPx !== undefined &&
    layout.width === undefined
  ) {
    // STRETCH: both opposite edges exist and no explicit width.
    if (movesWest) {
      nextLayout.left = normalizeAuthoringLengthValue(leftPx + deltaX);
    } else {
      nextLayout.right = normalizeAuthoringLengthValue(rightPx - deltaX);
    }

    return nextLayout;
  }

  if (
    leftPx !== undefined &&
    rightPx !== undefined &&
    layout.width !== undefined
  ) {
    // Unusual authored left + right + width. Deterministic touched-edge +
    // dimension, no new redundant constraint.
    if (movesWest) {
      nextLayout.left = normalizeAuthoringLengthValue(leftPx + deltaX);
    } else {
      nextLayout.right = normalizeAuthoringLengthValue(rightPx - deltaX);
    }

    nextLayout.width = resizedWidth;

    return nextLayout;
  }

  if (leftPx !== undefined && layout.width !== undefined) {
    if (movesWest) {
      nextLayout.left = normalizeAuthoringLengthValue(leftPx + deltaX);
    }

    nextLayout.width = resizedWidth;

    return nextLayout;
  }

  if (rightPx !== undefined && layout.width !== undefined) {
    if (!movesWest) {
      nextLayout.right = normalizeAuthoringLengthValue(rightPx - deltaX);
    }

    nextLayout.width = resizedWidth;

    return nextLayout;
  }

  if (leftPx !== undefined) {
    if (movesWest) {
      nextLayout.left = normalizeAuthoringLengthValue(leftPx + deltaX);
    }

    nextLayout.width = resizedWidth;

    return nextLayout;
  }

  if (rightPx !== undefined) {
    if (!movesWest) {
      nextLayout.right = normalizeAuthoringLengthValue(rightPx - deltaX);
    }

    nextLayout.width = resizedWidth;

    return nextLayout;
  }

  // No authored horizontal edge. Materialize a deterministic left from the
  // rendered geometry so the opposite visual edge does not depend on CSS
  // static-position behavior.
  nextLayout.left = normalizeAuthoringLengthValue(
    movesWest
      ? geometry.initialLeftPx + deltaX
      : geometry.initialLeftPx,
  );
  nextLayout.width = resizedWidth;

  return nextLayout;
}

function updateAbsoluteContainerVerticalAxis(
  layout: ContainerLayout,
  direction: CanvasResizeDirection,
  deltaY: number,
  geometry: ContainerCanvasResizeGeometry,
): ContainerLayout {
  const nextLayout: ContainerLayout = { ...layout };
  const { top, bottom } = layout;
  const topPx =
    top === undefined
      ? undefined
      : resolveEdgeLengthPx("top", top, geometry);
  const bottomPx =
    bottom === undefined
      ? undefined
      : resolveEdgeLengthPx("bottom", bottom, geometry);
  const movesNorth = includesNorth(direction);
  const heightDelta = movesNorth ? -deltaY : deltaY;
  const resizedHeight = serializeCanvasResizedDimension(
    Math.max(MINIMUM_SIZE_PX, geometry.initialHeightPx + heightDelta),
    geometry.parentHeightPx,
  );

  if (
    topPx !== undefined &&
    bottomPx !== undefined &&
    layout.height === undefined
  ) {
    // STRETCH: both opposite edges exist and no explicit height.
    if (movesNorth) {
      nextLayout.top = normalizeAuthoringLengthValue(topPx + deltaY);
    } else {
      nextLayout.bottom = normalizeAuthoringLengthValue(bottomPx - deltaY);
    }

    return nextLayout;
  }

  if (
    topPx !== undefined &&
    bottomPx !== undefined &&
    layout.height !== undefined
  ) {
    // Unusual authored top + bottom + height. Deterministic touched-edge +
    // dimension, no new redundant constraint.
    if (movesNorth) {
      nextLayout.top = normalizeAuthoringLengthValue(topPx + deltaY);
    } else {
      nextLayout.bottom = normalizeAuthoringLengthValue(bottomPx - deltaY);
    }

    nextLayout.height = resizedHeight;

    return nextLayout;
  }

  if (topPx !== undefined && layout.height !== undefined) {
    if (movesNorth) {
      nextLayout.top = normalizeAuthoringLengthValue(topPx + deltaY);
    }

    nextLayout.height = resizedHeight;

    return nextLayout;
  }

  if (bottomPx !== undefined && layout.height !== undefined) {
    if (!movesNorth) {
      nextLayout.bottom = normalizeAuthoringLengthValue(bottomPx - deltaY);
    }

    nextLayout.height = resizedHeight;

    return nextLayout;
  }

  if (topPx !== undefined) {
    if (movesNorth) {
      nextLayout.top = normalizeAuthoringLengthValue(topPx + deltaY);
    }

    nextLayout.height = resizedHeight;

    return nextLayout;
  }

  if (bottomPx !== undefined) {
    if (!movesNorth) {
      nextLayout.bottom = normalizeAuthoringLengthValue(bottomPx - deltaY);
    }

    nextLayout.height = resizedHeight;

    return nextLayout;
  }

  // No authored vertical edge. Materialize a deterministic top from the
  // rendered geometry so the opposite visual edge does not depend on CSS
  // static-position behavior.
  nextLayout.top = normalizeAuthoringLengthValue(
    movesNorth
      ? geometry.initialTopPx + deltaY
      : geometry.initialTopPx,
  );
  nextLayout.height = resizedHeight;

  return nextLayout;
}

function updateAbsoluteContainerForCanvasResize(
  container: ContainerElement,
  direction: CanvasResizeDirection,
  deltaX: number,
  deltaY: number,
  geometry: ContainerCanvasResizeGeometry,
): ContainerElement {
  const layout = container.layout;

  if (!layout) {
    return container;
  }

  const widthDelta = includesEast(direction)
    ? deltaX
    : includesWest(direction)
      ? -deltaX
      : 0;
  const heightDelta = includesSouth(direction)
    ? deltaY
    : includesNorth(direction)
      ? -deltaY
      : 0;

  if (widthDelta === 0 && heightDelta === 0) {
    return container;
  }

  let nextLayout: ContainerLayout = layout;

  if (widthDelta !== 0) {
    nextLayout = updateAbsoluteContainerHorizontalAxis(
      nextLayout,
      direction,
      deltaX,
      geometry,
    );
  }

  if (heightDelta !== 0) {
    nextLayout = updateAbsoluteContainerVerticalAxis(
      nextLayout,
      direction,
      deltaY,
      geometry,
    );
  }

  return {
    ...container,
    layout: nextLayout,
  };
}

export function updateContainerForCanvasResize(
  container: ContainerElement,
  direction: CanvasResizeDirection,
  deltaX: number,
  deltaY: number,
  geometry: ContainerCanvasResizeGeometry,
): ContainerElement {
  if (deltaX === 0 && deltaY === 0) {
    return container;
  }

  if (container.layout?.position === "absolute") {
    return updateAbsoluteContainerForCanvasResize(
      container,
      direction,
      deltaX,
      deltaY,
      geometry,
    );
  }

  return updateFlowContainerForCanvasResize(
    container,
    direction,
    deltaX,
    deltaY,
    geometry,
  );
}
