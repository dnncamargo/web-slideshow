import type { PresentationNotes } from "./presentation-notes";

/**
 * Domain-facing speaker-note repository abstraction.
 *
 * Notes are stored in a private per-presentation Firestore document separate
 * from the canonical Presentation document. Callers must not import
 * firebase/firestore directly; Firebase implementation details stay behind
 * this interface.
 */
export interface PresentationNotesRepository {
  getNotes(presentationId: string): Promise<PresentationNotes>;
  setSlideNote(
    presentationId: string,
    slideId: string,
    note: string,
  ): Promise<void>;
}