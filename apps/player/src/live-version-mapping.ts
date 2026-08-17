import type { Presentation } from "@powershow/document-schema";

function clampIndex(index: number, slideCount: number): number {
  if (slideCount === 0) return 0;
  return Math.min(Math.max(index, 0), slideCount - 1);
}

/** Preserve the confirmed logical slide across immutable live versions. */
export function mapPromotedSlideIndex(
  oldPresentation: Presentation,
  newPresentation: Presentation,
  confirmedIndex: number,
): number {
  const oldSlide = oldPresentation.slides[confirmedIndex];

  if (oldSlide) {
    const matchingIndex = newPresentation.slides.findIndex(
      (slide) => slide.id === oldSlide.id,
    );

    if (matchingIndex >= 0) return matchingIndex;
  }

  return clampIndex(confirmedIndex, newPresentation.slides.length);
}
