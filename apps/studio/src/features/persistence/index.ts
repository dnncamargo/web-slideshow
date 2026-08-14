export { FirestorePresentationRepository } from "./firestore-presentation-repository";
export type { PresentationRepository } from "./presentation-repository";
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
  assertPresentationWithinSizeLimit,
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
  PresentationTooLargeError,
} from "./persistence-errors";
