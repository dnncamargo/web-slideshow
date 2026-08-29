import type { Presentation } from "@powershow/document-schema";

export interface LogicalSlideSize {
  logicalWidth: number;
  logicalHeight: number;
}

export interface FittedSlideGeometry extends LogicalSlideSize {
  scale: number;
  physicalWidth: number;
  physicalHeight: number;
}

export function resolveLogicalSlideSize(
  aspectRatio: Presentation["aspectRatio"],
): LogicalSlideSize {
  return aspectRatio === "4:3"
    ? { logicalWidth: 960, logicalHeight: 720 }
    : { logicalWidth: 960, logicalHeight: 540 };
}

function normalizeAvailableDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function fitLogicalSlideGeometry(
  aspectRatio: Presentation["aspectRatio"],
  availableWidth: number,
  availableHeight: number,
): FittedSlideGeometry {
  const { logicalWidth, logicalHeight } = resolveLogicalSlideSize(aspectRatio);
  const width = normalizeAvailableDimension(availableWidth);
  const height = normalizeAvailableDimension(availableHeight);
  const scale = Math.min(width / logicalWidth, height / logicalHeight);

  return {
    logicalWidth,
    logicalHeight,
    scale,
    physicalWidth: logicalWidth * scale,
    physicalHeight: logicalHeight * scale,
  };
}
