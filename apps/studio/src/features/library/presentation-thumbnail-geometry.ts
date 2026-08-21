import type { PresentationThumbnailPreview } from "../persistence/presentation-persistence";

/**
 * Logical preview canvas width. Matches the Editor's nominal slide width so
 * px/rem-based authored content renders at the same visual scale before the
 * whole canvas is uniformly scaled down to the Library thumbnail slot.
 */
export const THUMBNAIL_LOGICAL_WIDTH = 960;

export const THUMBNAIL_LOGICAL_HEIGHT_16_9 = 540;
export const THUMBNAIL_LOGICAL_HEIGHT_4_3 = 720;

export function thumbnailLogicalHeight(
  aspectRatio: PresentationThumbnailPreview["aspectRatio"],
): number {
  return aspectRatio === "4:3"
    ? THUMBNAIL_LOGICAL_HEIGHT_4_3
    : THUMBNAIL_LOGICAL_HEIGHT_16_9;
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
