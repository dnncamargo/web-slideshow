import type { Presentation } from "@powershow/document-schema";
import { PresentationSchema } from "@powershow/document-schema";

import { FirestorePresentationRepository } from "./firestore-presentation-repository";
import type { PresentationRepository } from "./presentation-repository";

const defaultRepository = new FirestorePresentationRepository();

export function getDefaultPresentationRepository(): PresentationRepository {
  return defaultRepository;
}

/**
 * Create a new canonical Presentation using the existing schema. This is the
 * single source for the Library "New" action.
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
    slides: [],
  });
}

function createDefaultPresentationId(): string {
  return `presentation-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
