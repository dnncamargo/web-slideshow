import type { Presentation } from "@powershow/document-schema";

/**
 * Domain-facing read-only abstraction for immutable published presentation
 * versions.
 *
 * This is a separate boundary from PresentationRepository, which owns private
 * mutable drafts. Callers must not import firebase/firestore directly; Firebase
 * implementation details stay behind this interface.
 */
export interface PublishedPresentationReader {
  /**
   * Read an immutable published version. Returns the canonical Presentation
   * when the stored data is valid, or null when the document does not exist.
   */
  getVersion(
    publicationId: string,
    versionId: string,
  ): Promise<Presentation | null>;
}
