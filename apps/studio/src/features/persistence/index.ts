export { FirestorePresentationRepository } from "./firestore-presentation-repository";
export type { PresentationRepository } from "./presentation-repository";
export type {
  PresentationSummary,
  PresentationPersistenceEnvelope,
  PresentationPublicationMetadata,
  PresentationPublicationState,
} from "./presentation-persistence";
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
