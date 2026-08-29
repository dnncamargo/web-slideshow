import type { PresentationThumbnailPreview } from "../persistence/presentation-persistence";
import { resolveLogicalSlideSize } from "@powershow/renderer";

export function thumbnailLogicalHeight(
  aspectRatio: PresentationThumbnailPreview["aspectRatio"],
): number {
  return resolveLogicalSlideSize(aspectRatio).logicalHeight;
}

/**
 * Uniform scale that fits a logical canvas fully inside the thumbnail host.
 *
 * Returns 0 for any non-finite or non-positive dimension, which lets the
 * caller keep the preview hidden until real measurements are available.
 */
export function computeThumbnailScale(
  hostWidth: number,
  hostHeight: number,
  logicalWidth: number,
  logicalHeight: number,
): number {
  if (
    !Number.isFinite(hostWidth) ||
    !Number.isFinite(hostHeight) ||
    !Number.isFinite(logicalWidth) ||
    !Number.isFinite(logicalHeight) ||
    hostWidth <= 0 ||
    hostHeight <= 0 ||
    logicalWidth <= 0 ||
    logicalHeight <= 0
  ) {
    return 0;
  }

  return Math.min(hostWidth / logicalWidth, hostHeight / logicalHeight);
}
