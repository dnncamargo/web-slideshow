import type { ContainerChildrenFit } from "@powershow/document-schema";

export interface ContainerFitGeometryInput {
  mode: ContainerChildrenFit["mode"];
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
}

export interface ContainerFitGeometry {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  fittedWidth: number;
  fittedHeight: number;
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function resolveContainerFitGeometry({
  mode,
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
}: ContainerFitGeometryInput): ContainerFitGeometry | null {
  if (
    !isPositiveFinite(sourceWidth) ||
    !isPositiveFinite(sourceHeight) ||
    !isPositiveFinite(targetWidth) ||
    !isPositiveFinite(targetHeight)
  ) {
    return null;
  }

  const widthScale = targetWidth / sourceWidth;
  const heightScale = targetHeight / sourceHeight;
  const uniformScale = mode === "cover"
    ? Math.max(widthScale, heightScale)
    : Math.min(widthScale, heightScale);
  const scaleX = mode === "fill" ? widthScale : uniformScale;
  const scaleY = mode === "fill" ? heightScale : uniformScale;
  const fittedWidth = sourceWidth * scaleX;
  const fittedHeight = sourceHeight * scaleY;

  return {
    scaleX,
    scaleY,
    offsetX: (targetWidth - fittedWidth) / 2,
    offsetY: (targetHeight - fittedHeight) / 2,
    fittedWidth,
    fittedHeight,
  };
}
