export { FirestorePresentationRepository } from "./firestore-presentation-repository";
export type { PresentationRepository } from "./presentation-repository";
export { FirestorePresentationNotesRepository } from "./firestore-presentation-notes-repository";
export type { PresentationNotesRepository } from "./presentation-notes-repository";
export {
  applySlideNote,
  createEmptyNotes,
  makeFirestoreSafeNotes,
  normalizePersistedNotes,
  type PresentationNotes,
} from "./presentation-notes";
export type {
  PresentationSummary,
  PresentationPersistenceEnvelope,
  PresentationPublicationMetadata,
  PresentationPublicationState,
  PublishedPresentationVersion,
} from "./presentation-persistence";
export type { PresentationPublishResult } from "./presentation-repository";
export {
  MAX_PRESENTATION_SAFE_BYTES,
  MAX_FIRESTORE_NESTING_DEPTH,
  assertPresentationWithinSizeLimit,
  assertPresentationWithinFirestoreNestingDepth,
  estimateFirestoreNestingDepth,
  estimatePresentationBytes,
  extractPresentationSummary,
  makeFirestoreSafePresentation,
  normalizePersistenceMetadata,
  parsePersistedPresentation,
  resolvePublicationState,
} from "./presentation-persistence";
export {
  FirebaseConfigurationError,
  FirebaseAuthenticationError,
  FirestoreOperationError,
  InvalidPersistedPresentationError,
  PresentationTooDeepError,
  PresentationTooLargeError,
} from "./persistence-errors";
