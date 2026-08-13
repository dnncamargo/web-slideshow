import type { Presentation } from "@powershow/document-schema";

import type { PresentationSummary } from "./presentation-persistence";

/**
 * Domain-facing Presentation repository abstraction.
 *
 * Callers must not import firebase/firestore directly; Firebase implementation
 * details stay behind this interface.
 */
export interface PresentationRepository {
  listPresentations(): Promise<PresentationSummary[]>;
  getPresentation(id: string): Promise<Presentation | null>;
  createPresentation(presentation: Presentation): Promise<void>;
  savePresentation(presentation: Presentation): Promise<void>;
  archivePresentation(id: string): Promise<void>;
}
