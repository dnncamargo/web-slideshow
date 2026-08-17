import type { Presentation } from "@powershow/document-schema";

export interface PublishedPresentationPointer {
  currentVersionId: string;
  publishedRevision: number;
}

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
   * Observe the public publication pointer. Missing documents are reported as
   * null. Malformed data and listener failures are reported through onError.
   * The returned function stops the Firestore listener.
   */
  subscribePointer(
    publicationId: string,
    onPointer: (pointer: PublishedPresentationPointer | null) => void,
    onError: (error: Error) => void,
  ): () => void;

  /**
   * Read an immutable published version. Returns the canonical Presentation
   * when the stored data is valid, or null when the document does not exist.
   */
  getVersion(
    publicationId: string,
    versionId: string,
  ): Promise<Presentation | null>;
}
