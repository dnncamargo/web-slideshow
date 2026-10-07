export { FirestorePresentationRepository } from "./firestore-presentation-repository";
export type {
  PresentationRecoveryInspection,
  PresentationRepairResult,
  PresentationRepository,
  PresentationPublishResult,
  ListPresentationsOptions,
  CreatePresentationOptions,
} from "./presentation-repository";
export { FirestorePresentationNotesRepository } from "./firestore-presentation-notes-repository";
export type { PresentationNotesRepository } from "./presentation-notes-repository";
export { FirestorePresentationFolderRepository } from "./firestore-presentation-folder-repository";
export type { PresentationFolderRepository } from "./presentation-folder-repository";
export { FirestoreCustomLibraryRepository } from "./firestore-custom-library-repository";
export { getDefaultCustomLibraryRepository } from "./custom-library-repository-instance";
export { FirestoreCustomLibraryPaletteRepository } from "./firestore-custom-library-palette-repository";
export { getDefaultCustomLibraryPaletteRepository } from "./custom-library-palette-repository-instance";
export { FirestoreCustomLibraryFontRepository } from "./firestore-custom-library-font-repository";
export { getDefaultCustomLibraryFontRepository } from "./custom-library-font-repository-instance";
export { FirestoreCustomLibraryFileRepository } from "./firestore-custom-library-file-repository";
export { getDefaultCustomLibraryFileRepository } from "./custom-library-file-repository-instance";
export type {
  CustomLibraryItemRecord,
  CustomLibraryRepository,
} from "../custom-library/custom-library-repository";
export type {
  CustomLibraryPaletteRecord,
  CustomLibraryPaletteRepository,
} from "../custom-library/custom-library-palette-repository";
export type {
  CustomLibraryFontDraft,
  CustomLibraryFontRecord,
} from "../custom-library/custom-library-font";
export type { CustomLibraryFontRepository } from "../custom-library/custom-library-font-repository";
export type {
  CustomLibraryFileDraft,
  CustomLibraryFileRecord,
  CustomLibraryFileSource,
  CustomLibraryFileKind,
  CustomLibraryFileRepresentation,
} from "../custom-library/custom-library-file";
export type { CustomLibraryFileRepository } from "../custom-library/custom-library-file-repository";
export {
  MAX_FOLDER_NAME_LENGTH,
  isValidFolderName,
  normalizeFolderName,
  type PresentationFolder,
} from "./presentation-folder";
export {
  appendPointedNote,
  createEmptyNotes,
  getPointedNoteIds,
  makeFirestoreSafeNotes,
  normalizePersistedNotes,
  removePointedNote,
  updatePointedNoteText,
  updateSlideNoteText,
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
  estimatePresentationBytes,
  extractPresentationSummary,
  assertValidPresentationForPersistence,
  normalizeFolderId,
  normalizePersistenceMetadata,
  parsePersistedPresentation,
  resolvePublicationState,
} from "./presentation-persistence";
export {
  analyzePresentationRecovery,
  type PresentationRecoveryAnalysis,
  type PresentationRecoveryStatus,
  type RecoveryIssue,
  type RecoveryIssueAction,
  type RecoveryIssueKind,
} from "./presentation-recovery";
export {
  FirebaseConfigurationError,
  FirebaseAuthenticationError,
  FirestoreOperationError,
  ManagedAssetUploadError,
  InvalidFolderNameError,
  InvalidCustomLibraryItemForPersistenceError,
  InvalidPersistedCustomLibraryItemError,
  InvalidCustomLibraryPaletteForPersistenceError,
  InvalidPersistedCustomLibraryPaletteError,
  InvalidCustomLibraryFontForPersistenceError,
  InvalidPersistedCustomLibraryFontError,
  InvalidCustomLibraryFileForPersistenceError,
  InvalidPersistedCustomLibraryFileError,
  InvalidPersistedPresentationError,
  InvalidPresentationForPersistenceError,
  PresentationRecoveryFailedError,
} from "./persistence-errors";
export {
  uploadManagedAsset,
  type ManagedAssetUploadResult,
  type ManagedAssetUploadOptions,
} from "./managed-asset-storage";
export {
  MANAGED_ASSET_CONTENT_TYPES,
  isManagedAssetContentType,
  type ManagedAssetContentType,
} from "./managed-asset-content-types";
