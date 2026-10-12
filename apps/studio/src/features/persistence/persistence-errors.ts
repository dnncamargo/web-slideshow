import {
  BlobAccessError,
  BlobClientTokenExpiredError,
  BlobContentTypeNotAllowedError,
  BlobFileTooLargeError,
  BlobPreconditionFailedError,
  BlobPathnameMismatchError,
  BlobRequestAbortedError,
  BlobServiceNotAvailable,
  BlobServiceRateLimited,
  BlobStoreSuspendedError,
  BlobStoreNotFoundError,
} from "@vercel/blob";
import type { FirebaseError } from "firebase/app";
export { PresentationTooLargeError } from "@web-slideshow/firebase";

/**
 * Persistence-layer error model.
 *
 * These are the public error categories the Studio can rely on. Raw Firebase
 * exceptions are translated into these by the repository so callers do not
 * depend on the Firebase SDK.
 */

export abstract class PersistenceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.cause = cause;
  }
}

export class FirebaseConfigurationError extends PersistenceError {}

export class FirebaseAuthenticationError extends PersistenceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "FirebaseAuthenticationError";
  }
}

export class FirestoreOperationError extends PersistenceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "FirestoreOperationError";
  }
}

export class ManagedAssetUploadError extends PersistenceError {
  readonly category: ManagedAssetUploadErrorCategory;

  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "ManagedAssetUploadError";
    this.category = classifyManagedAssetUploadError(cause);
  }
}

export type ManagedAssetUploadErrorCategory =
  | "unsupported_type"
  | "file_too_large"
  | "quota_exceeded"
  | "store_suspended"
  | "authentication"
  | "authorization"
  | "rate_limited"
  | "network"
  | "service_unavailable"
  | "uncertain_completion"
  | "unknown";

export function classifyManagedAssetUploadError(
  error: unknown,
): ManagedAssetUploadErrorCategory {
  if (error instanceof BlobContentTypeNotAllowedError) return "unsupported_type";
  if (error instanceof BlobFileTooLargeError) return "file_too_large";
  if (error instanceof BlobStoreSuspendedError) return "store_suspended";
  if (error instanceof BlobAccessError) return "authorization";
  if (error instanceof BlobPathnameMismatchError) return "authorization";
  if (error instanceof BlobStoreNotFoundError) return "service_unavailable";
  if (error instanceof BlobClientTokenExpiredError) return "authentication";
  if (error instanceof BlobServiceRateLimited) return "rate_limited";
  if (error instanceof BlobServiceNotAvailable) return "service_unavailable";
  if (error instanceof BlobPreconditionFailedError) return "uncertain_completion";
  if (error instanceof BlobRequestAbortedError) return "uncertain_completion";
  if (error instanceof TypeError) return "uncertain_completion";
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  ) return "uncertain_completion";
  return "unknown";
}

export class InvalidPersistedPresentationError extends PersistenceError {}

export class PresentationRecoveryFailedError extends PersistenceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "PresentationRecoveryFailedError";
  }
}

export class InvalidPresentationForPersistenceError extends PersistenceError {}

export class InvalidCustomLibraryItemForPersistenceError extends PersistenceError {}

export class InvalidPersistedCustomLibraryItemError extends PersistenceError {}

export class InvalidCustomLibraryPaletteForPersistenceError extends PersistenceError {}

export class InvalidPersistedCustomLibraryPaletteError extends PersistenceError {}

export class InvalidCustomLibraryFontForPersistenceError extends PersistenceError {}

export class InvalidPersistedCustomLibraryFontError extends PersistenceError {}

export class InvalidCustomLibraryFileForPersistenceError extends PersistenceError {}

export class InvalidPersistedCustomLibraryFileError extends PersistenceError {}

export class InvalidFolderNameError extends PersistenceError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFolderNameError";
  }
}

export function isFirebaseError(error: unknown): error is FirebaseError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  );
}
