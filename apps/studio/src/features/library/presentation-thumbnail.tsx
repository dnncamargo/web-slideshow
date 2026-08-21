"use client";

import type { PresentationSummary } from "../persistence/presentation-persistence";

import { PresentationThumbnailFallback } from "./presentation-thumbnail-fallback";
import { PresentationThumbnailPreview } from "./presentation-thumbnail-preview";

interface PresentationThumbnailProps {
  summary: PresentationSummary;
}

/**
 * Chooses between a rendered first-slide preview and the decorative fallback.
 *
 * The preview is only used when a valid thumbnailPreview projection exists AND
 * its first slide has at least one authored element; every other case
 * (including an empty first slide) preserves the fallback appearance.
 */
export function PresentationThumbnail({
  summary,
}: PresentationThumbnailProps) {
  const preview = summary.thumbnailPreview;

  if (preview && preview.firstSlide.elements.length > 0) {
    return <PresentationThumbnailPreview preview={preview} />;
  }

  return <PresentationThumbnailFallback />;
}