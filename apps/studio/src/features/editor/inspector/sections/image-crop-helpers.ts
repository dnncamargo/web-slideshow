import type { ImageElement } from "@powershow/document-schema";

export type ImageCropField = "x" | "y" | "width" | "height";

export interface ImageCropValues {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DEFAULT_IMAGE_CROP: Readonly<ImageCropValues> = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
};

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function getEffectiveImageCrop(
  crop: ImageElement["crop"],
): ImageCropValues {
  return crop === undefined ? { ...DEFAULT_IMAGE_CROP } : { ...crop };
}

export function normalizeImageCrop(
  crop: ImageElement["crop"],
): ImageElement["crop"] {
  if (crop === undefined) {
    return undefined;
  }

  const x = clamp(finiteOr(crop.x, 0), 0, 99);
  const y = clamp(finiteOr(crop.y, 0), 0, 99);
  const width = clamp(finiteOr(crop.width, 1), 1, 100 - x);
  const height = clamp(finiteOr(crop.height, 1), 1, 100 - y);

  if (x === 0 && y === 0 && width === 100 && height === 100) {
    return undefined;
  }

  return { x, y, width, height };
}

export function updateImageCropField(
  crop: ImageElement["crop"],
  field: ImageCropField,
  value: number,
): ImageElement["crop"] {
  const current = getEffectiveImageCrop(crop);

  if (!Number.isFinite(value)) {
    return normalizeImageCrop(crop);
  }

  const next = { ...current };

  if (field === "x") {
    next.x = clamp(value, 0, 99);
    next.width = Math.min(next.width, 100 - next.x);
  } else if (field === "y") {
    next.y = clamp(value, 0, 99);
    next.height = Math.min(next.height, 100 - next.y);
  } else if (field === "width") {
    next.width = clamp(value, 1, 100 - next.x);
  } else {
    next.height = clamp(value, 1, 100 - next.y);
  }

  return normalizeImageCrop(next);
}

export function isImageCropResetAvailable(
  crop: ImageElement["crop"],
): boolean {
  return crop !== undefined;
}
