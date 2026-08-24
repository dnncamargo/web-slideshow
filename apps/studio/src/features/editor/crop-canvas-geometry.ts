import type { ImageCrop } from "@powershow/document-schema";

import { normalizeImageCrop } from "./inspector/sections/image-crop-helpers";

export interface CropCanvasBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type CropCanvasHandle =
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "nw";

export function resolveSourcePreviewBounds(
  box: CropCanvasBounds,
  naturalWidth: number,
  naturalHeight: number,
): CropCanvasBounds | null {
  if (
    !Number.isFinite(naturalWidth) ||
    !Number.isFinite(naturalHeight) ||
    naturalWidth <= 0 ||
    naturalHeight <= 0 ||
    !Number.isFinite(box.width) ||
    !Number.isFinite(box.height) ||
    box.width <= 0 ||
    box.height <= 0
  ) {
    return null;
  }

  const scale = Math.min(box.width / naturalWidth, box.height / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;

  return {
    left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2,
    width,
    height,
  };
}

export function resolveCropCanvasRect(
  preview: CropCanvasBounds,
  crop: ImageCrop,
): CropCanvasBounds {
  return {
    left: preview.left + (crop.x / 100) * preview.width,
    top: preview.top + (crop.y / 100) * preview.height,
    width: (crop.width / 100) * preview.width,
    height: (crop.height / 100) * preview.height,
  };
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function cropFromEdges(
  initial: ImageCrop,
  direction: CropCanvasHandle,
  deltaX: number,
  deltaY: number,
  preview: CropCanvasBounds,
): ImageCrop {
  const dx = (deltaX / preview.width) * 100;
  const dy = (deltaY / preview.height) * 100;
  let left = initial.x;
  let top = initial.y;
  let right = initial.x + initial.width;
  let bottom = initial.y + initial.height;

  if (direction.includes("w")) left += dx;
  if (direction.includes("e")) right += dx;
  if (direction.includes("n")) top += dy;
  if (direction.includes("s")) bottom += dy;

  if (direction.includes("w")) left = Math.min(left, right - 1);
  if (direction.includes("e")) right = Math.max(right, left + 1);
  if (direction.includes("n")) top = Math.min(top, bottom - 1);
  if (direction.includes("s")) bottom = Math.max(bottom, top + 1);

  left = Math.max(0, Math.min(99, left));
  top = Math.max(0, Math.min(99, top));
  right = Math.max(left + 1, Math.min(100, right));
  bottom = Math.max(top + 1, Math.min(100, bottom));

  return {
    x: roundTenth(left),
    y: roundTenth(top),
    width: roundTenth(right - left),
    height: roundTenth(bottom - top),
  };
}

export function updateCropFromHandle(
  initial: ImageCrop,
  direction: CropCanvasHandle,
  deltaX: number,
  deltaY: number,
  preview: CropCanvasBounds,
): ImageCrop {
  return cropFromEdges(initial, direction, deltaX, deltaY, preview);
}

export function moveCrop(
  initial: ImageCrop,
  deltaX: number,
  deltaY: number,
  preview: CropCanvasBounds,
): ImageCrop {
  const dx = roundTenth((deltaX / preview.width) * 100);
  const dy = roundTenth((deltaY / preview.height) * 100);

  return {
    x: roundTenth(Math.max(0, Math.min(100 - initial.width, initial.x + dx))),
    y: roundTenth(Math.max(0, Math.min(100 - initial.height, initial.y + dy))),
    width: initial.width,
    height: initial.height,
  };
}

export function normalizeCropCanvasValue(crop: ImageCrop): ImageCrop | undefined {
  return normalizeImageCrop({
    x: roundTenth(crop.x),
    y: roundTenth(crop.y),
    width: roundTenth(crop.width),
    height: roundTenth(crop.height),
  });
}
