export { FirestorePresentationRepository } from "./firestore-presentation-repository";
export type {
  PresentationRepository,
  PresentationPublishResult,
  ListPresentationsOptions,
  CreatePresentationOptions,
} from "./presentation-repository";
export { FirestorePresentationNotesRepository } from "./firestore-presentation-notes-repository";
export type { PresentationNotesRepository } from "./presentation-notes-repository";
export { FirestorePresentationFolderRepository } from "./firestore-presentation-folder-repository";
export type { PresentationFolderRepository } from "./presentation-folder-repository";
export {
  MAX_FOLDER_NAME_LENGTH,
  isValidFolderName,
  normalizeFolderName,
  type PresentationFolder,
} from "./presentation-folder";
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
export {
  MAX_PRESENTATION_SAFE_BYTES,
  MAX_FIRESTORE_NESTING_DEPTH,
  assertPresentationWithinSizeLimit,
  assertPresentationWithinFirestoreNestingDepth,
  estimateFirestoreNestingDepth,
  estimatePresentationBytes,
  extractPresentationSummary,
  makeFirestoreSafePresentation,
  assertValidPresentationForPersistence,
  normalizeFolderId,
  normalizePersistenceMetadata,
  parsePersistedPresentation,
  resolvePublicationState,
} from "./presentation-persistence";
export {
  FirebaseConfigurationError,
  FirebaseAuthenticationError,
  FirestoreOperationError,
  InvalidFolderNameError,
  InvalidPersistedPresentationError,
  InvalidPresentationForPersistenceError,
  PresentationTooDeepError,
  PresentationTooLargeError,
} from "./persistence-errors";
