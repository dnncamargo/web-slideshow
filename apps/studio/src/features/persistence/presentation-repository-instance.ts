import type { Presentation, Slide } from "@powershow/document-schema";
import { PresentationSchema, SlideSchema } from "@powershow/document-schema";

import { FirestorePresentationRepository } from "./firestore-presentation-repository";
import type { PresentationRepository } from "./presentation-repository";

const defaultRepository = new FirestorePresentationRepository();

export function getDefaultPresentationRepository(): PresentationRepository {
  return defaultRepository;
}

/**
 * Create a canonically valid blank Slide with no authored content. This is the
 * single source for new Presentation initial slides.
 */
export function createBlankSlide(id?: string): Slide {
  return SlideSchema.parse({
    id: id ?? createDefaultSlideId(),
  });
}

/**
 * Create a new canonical Presentation using the existing schema. This is the
 * single source for the Library "New" action.
 *
 * New presentations always start with exactly one blank Slide so the Editor
 * has a valid canvas to render.
 */
export function createBlankPresentation(
  id?: string,
  title = "Untitled presentation",
): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: id ?? createDefaultPresentationId(),
    title,
    description: "",
    aspectRatio: "16:9",
    slides: [createBlankSlide(createDefaultSlideId())],
  });
}

function createDefaultPresentationId(): string {
  return `presentation-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createDefaultSlideId(): string {
  return `slide-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
