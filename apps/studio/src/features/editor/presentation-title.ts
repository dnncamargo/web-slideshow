import type { Presentation } from "@powershow/document-schema";

/** Updates only the canonical Presentation title, preserving every slide. */
export function updatePresentationTitle(
  presentation: Presentation,
  title: string,
): Presentation {
  return presentation.title === title ? presentation : { ...presentation, title };
}
