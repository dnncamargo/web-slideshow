import type { ImageElement } from "@powershow/document-schema";

export interface ImageFocalPoint {
  x: number;
  y: number;
}

export const DEFAULT_IMAGE_FOCAL_POINT: Readonly<ImageFocalPoint> = {
  x: 50,
  y: 50,
};

export const IMAGE_FOCAL_POINT_PRESETS: readonly ImageFocalPoint[] = [
  { x: 0, y: 0 },
  { x: 50, y: 0 },
  { x: 100, y: 0 },
  { x: 0, y: 50 },
  { x: 50, y: 50 },
  { x: 100, y: 50 },
  { x: 0, y: 100 },
  { x: 50, y: 100 },
  { x: 100, y: 100 },
];

export function getEffectiveImageFocalPoint(
  focalPoint: ImageElement["focalPoint"],
): ImageFocalPoint {
  return focalPoint ?? DEFAULT_IMAGE_FOCAL_POINT;
}

export function clampImageFocalPointValue(value: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 50));
}

export function getImageFocalPointPresetIndex(
  focalPoint: ImageFocalPoint,
): number | null {
  const index = IMAGE_FOCAL_POINT_PRESETS.findIndex(
    (preset) => preset.x === focalPoint.x && preset.y === focalPoint.y,
  );

  return index === -1 ? null : index;
}

export function updateImageFocalPoint(
  focalPoint: ImageElement["focalPoint"],
  axis: "x" | "y",
  value: number,
): ImageFocalPoint {
  const current = getEffectiveImageFocalPoint(focalPoint);

  return axis === "x"
    ? { ...current, x: clampImageFocalPointValue(value) }
    : { ...current, y: clampImageFocalPointValue(value) };
}

export function getImageFocalPointFromClientPosition(
  bounds: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): ImageFocalPoint {
  return {
    x: clampImageFocalPointValue(((clientX - bounds.left) / bounds.width) * 100),
    y: clampImageFocalPointValue(((clientY - bounds.top) / bounds.height) * 100),
  };
}

export function getImageFocalPointUntilFit(
  focalPoint: ImageElement["focalPoint"],
): ImageElement["focalPoint"] {
  return focalPoint;
}

export function isImageFocalPointResetAvailable(
  focalPoint: ImageElement["focalPoint"],
): boolean {
  return focalPoint !== undefined;
}
